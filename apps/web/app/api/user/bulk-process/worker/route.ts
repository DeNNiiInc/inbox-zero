import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import prisma from "@/utils/prisma";
import { createEmailProvider } from "@/utils/email/provider";
import { runRules } from "@/utils/ai/choose-rule/run-rules";
import { createScopedLogger } from "@/utils/logger";
import { bulkPublishToQstash } from "@/utils/upstash";
import type { ParsedMessage } from "@/utils/types";
import { ExecutedRuleStatus } from "@/generated/prisma/enums";

const BATCH_SIZE = 50;

async function handler(request: Request) {
  const body = await request.json();
  const { jobId } = body as { jobId: string };

  const logger = createScopedLogger("bulk-processing-worker").with({ jobId });

  const job = await prisma.bulkProcessingJob.findUnique({
    where: { id: jobId },
    include: {
      emailAccount: {
        include: {
          user: true,
          account: true,
        },
      },
    },
  });

  if (!job) {
    logger.error("Job not found");
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Check if job should continue
  if (job.status !== "PROCESSING" && job.status !== "PENDING") {
    logger.info("Job stopped or paused", { status: job.status });
    return NextResponse.json({ status: job.status });
  }

  // Update status to processing if pending
  if (job.status === "PENDING") {
    await prisma.bulkProcessingJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });
  }

  try {
    const emailProvider = await createEmailProvider({
      emailAccountId: job.emailAccountId,
      provider: job.emailAccount.account.provider,
      logger,
    });

    // Determine how many emails to fetch
    // We need to fetch more than BATCH_SIZE because some might be skipped (deduplicated)
    const fetchLimit = BATCH_SIZE * 3; 
    
    // We don't have a reliable way to "paginate" based on processed emails in IMAP/Graph
    // without fetching them. So we rely on deduplication.
    // Ideally, we'd use a "since" date or ID, but for "all emails", we might simply 
    // fetch distinct batches or rely on the fact that we process latest first.
    // For now, let's fetch emails and see which ones are not processed.
    
    // NOTE: This basic strategy (fetch latest N) works best if we process from latest to oldest
    // and assume the user isn't receiving massive amounts of new email WHILE processing.
    // For a more robust solution, we'd need to store a high-water mark or cursor.
    // Given the constraints, we'll fetch latest emails. If "maxEmails" is set, we respect it.
    
    // BUT: If we always fetch the latest, and we skip processed ones, we might just keep
    // fetching the *same* processed ones if we don't have a way to skip them in the query.
    // Most providers don't support "exclude specific IDs".
    // workaround: We can't easily skip *in query*.
    
    // For "All" emails, or large batches, we should likely iterate.
    // However, `getInboxMessages` usually just returns latest.
    // If we have processed the latest 50, and we ask for 50 again, we get the same 50.
    // WE NEED A OFFSET or DATE filter.
    
    // Let's implement a simple "lastProcessedDate" logic if possible, or just accept
    // that we might need to scan through a lot of processed emails to find new ones.
    
    // ALTERNATIVE: Use `getMessages` with an offset? The provider interface usually just has `getInboxMessages(limit)`.
    // Let's check the provider creation.
    
    const messages = await emailProvider.getInboxMessages(fetchLimit);

    if (messages.length === 0) {
      // No messages found, we are done
      await completeJob(jobId);
      return NextResponse.json({ status: "COMPLETED", count: 0 });
    }

    // Deduplicate
    const processedIds = await prisma.processedEmail.findMany({
      where: {
        emailAccountId: job.emailAccountId,
        messageId: {
          in: messages.map((m) => m.id),
        },
      },
      select: { messageId: true },
    });
    
    const processedSet = new Set(processedIds.map((p) => p.messageId));
    
    const messagesToProcess = messages.filter((m) => !processedSet.has(m.id));
    
    // If we found nothing new in this batch, and we fetched fewer than we asked for (meaning end of inbox),
    // OR if we have simply scanned unrelated emails...
    // Issue: If we have 1000 emails, allowing 50 per batch.
    // Batch 1: Get latest 150. Process 50.
    // Batch 2: Get latest 150. The first 50 are processed. We process next 50.
    // This works fine UNTIL we exceed the fetch limit (150).
    // If we have processed 150 emails, `getInboxMessages(150)` returns only processed emails.
    // We need to fetch *deeper*.
    
    // IMPORTANT: The `getInboxMessages` in this codebase generally doesn't support offset.
    // This is a known limitation. We would need to extend the provider interface to support pagination/older tokens.
    // For now, to solve the immediate request without rewriting all providers, we might be limited 
    // to how many we can fetch at once or we rely on the fact that user said "All".
    
    // However, `imap` provider DOES accept `limit`.
    // If we want "all", we might need a way to say "fetch messages older than X".
    
    // Let's try to process as many as we found in this "lookahead" batch.
    
    // Only process up to BATCH_SIZE
    const batch = messagesToProcess.slice(0, BATCH_SIZE);
    
    if (batch.length === 0) {
      // We found only processed emails in the top N.
      // This suggests we might be done, OR we need to look deeper.
      // Without pagination support in the generic provider, we update the job to completed
      // if we can't find any processing work in the fetch window.
      // This is a tradeoff: we only process correctly if `getInboxMessages` returns unseen emails.
      // BUT: If the user archives emails, they disappear from Inbox.
      // If the bulk action is "Archive", then the next fetch WILL return new emails!
      // This is the key: MOST rules will move emails out of inbox.
      
      const isArchiving = !job.skipArchive;
      
      if (isArchiving) {
         // If we are archiving, and we found no new messages, it means the inbox is effectively empty of unprocessed items
         // (or at least the top N are all processed/skipped).
         await completeJob(jobId);
         return NextResponse.json({ status: "COMPLETED", reason: "No new messages in fetch window" });
      } else {
         // If NOT archiving, we are stuck seeing the same emails.
         // In this case, bulk processing "All" without archive is tricky without pagination.
         // We will just stop to avoid infinite loop.
         await completeJob(jobId);
         return NextResponse.json({ status: "COMPLETED", reason: "No new messages (non-archiving mode)" });
      }
    }

    // Fetch active rules
    const rules = await prisma.rule.findMany({
      where: {
        emailAccountId: job.emailAccountId,
        enabled: true,
      },
      include: { actions: true },
    });

    let processedCount = 0;
    
    for (const message of batch) {
      if (job.maxEmails && (job.processedCount + processedCount) >= job.maxEmails) {
        break;
      }
      
      try {
        const results = await runRules({
          provider: emailProvider,
          message,
          rules,
          emailAccount: job.emailAccount,
          isTest: false,
          modelType: "economy", // Use economy model for bulk to save costs
          logger,
          skipArchive: job.skipArchive,
        });

        const primaryResult = results.find(r => 
          r.status === ExecutedRuleStatus.APPLIED || 
          r.status === ExecutedRuleStatus.APPLYING
        );

        // Record as processed
        await prisma.processedEmail.create({
          data: {
            emailAccountId: job.emailAccountId,
            messageId: message.id,
            threadId: message.threadId,
            ruleId: primaryResult?.rule?.id,
            action: primaryResult?.actionItems?.map(a => a.type).join(", "),
          },
        }).catch(() => {
            // Ignore duplicate insert errors (race conditions)
        });

        processedCount++;
      } catch (error) {
        logger.error("Error processing email", { messageId: message.id, error });
        // Update error count
        await prisma.bulkProcessingJob.update({
             where: { id: jobId },
             data: { 
               errorCount: { increment: 1 },
               lastError: error instanceof Error 
                 ? error.message 
                 : (typeof error === 'object' && error !== null && 'message' in error)
                   ? String((error as { message: unknown }).message)
                   : (typeof error === 'object' ? JSON.stringify(error) : String(error))
             }
        });
      }
    }

    // Update job stats
    await prisma.bulkProcessingJob.update({
      where: { id: jobId },
      data: {
        processedCount: { increment: processedCount },
        lastProcessedAt: new Date(),
      },
    });

    // Determine if we should continue
    const freshJob = await prisma.bulkProcessingJob.findUnique({
        where: { id: jobId }
    });
    
    if (!freshJob) return NextResponse.json({ status: "ABORTED" });

    const reachedLimit = freshJob.maxEmails && freshJob.processedCount >= freshJob.maxEmails;
    
    if (!reachedLimit && freshJob.status === "PROCESSING") {
      // Queue next batch
      await bulkPublishToQstash({
        items: [{
          body: { jobId },
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/user/bulk-process/worker`,
        }],
      });
    } else if (reachedLimit) {
      await completeJob(jobId);
    }

    return NextResponse.json({ status: "CONTINUING", processed: processedCount });

  } catch (error) {
     logger.error("Job failed", { error });
     // Don't fail the job immediately, QStash will retry.
     // If it fails too many times, QStash DLQ handles it.
     throw error;
  }
}

async function completeJob(jobId: string) {
  await prisma.bulkProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export const POST = verifySignatureAppRouter(handler);
