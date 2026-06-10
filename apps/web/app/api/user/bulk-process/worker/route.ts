import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import prisma from "@/utils/prisma";
import { createEmailProvider } from "@/utils/email/provider";
import { runRules } from "@/utils/ai/choose-rule/run-rules";
import { createScopedLogger } from "@/utils/logger";
import { redis } from "@/utils/redis";
import { bulkPublishToQstash } from "@/utils/upstash";
import type { ParsedMessage } from "@/utils/types";
import { ExecutedRuleStatus } from "@/generated/prisma/enums";

const BATCH_SIZE = 50;

function formatErrorMessage(error: unknown): string {
  let msg = "";
  if (error instanceof Error) {
    msg = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    msg = String((error as { message: unknown }).message);
  } else {
    msg = typeof error === 'object' ? JSON.stringify(error) : String(error);
  }

  try {
    // Attempt to parse AI SDK JSON error strings
    const parsed = JSON.parse(msg);
    if (parsed.error?.lastError?.data?.error?.message) {
      return parsed.error.lastError.data.error.message;
    }
    if (parsed.lastError?.data?.error?.message) {
      return parsed.lastError.data.error.message;
    }
    if (parsed.error?.message && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
  } catch {
    // Ignore JSON parse errors
  }

  if (msg.length > 500) {
    return msg.substring(0, 500) + "...";
  }
  return msg;
}

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

    const fetchLimit = BATCH_SIZE * 3; 
    
    const isArchiving = !job.skipArchive;
    const pageTokenKey = `bulk-process:pageToken:${jobId}`;
    let pageToken: string | undefined = undefined;

    if (!isArchiving) {
      pageToken = await redis.get<string>(pageTokenKey) || undefined;
    }

    const { messages, nextPageToken } = await emailProvider.getMessagesWithPagination({
      inboxOnly: true,
      maxResults: fetchLimit,
      pageToken,
    });

    if (messages.length === 0) {
      // No messages found, we are done
      await completeJob(jobId);
      if (!isArchiving) await redis.del(pageTokenKey);
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
    
    // Only process up to BATCH_SIZE
    const batch = messagesToProcess.slice(0, BATCH_SIZE);
    
    if (batch.length === 0) {
      if (isArchiving) {
         await completeJob(jobId);
         return NextResponse.json({ status: "COMPLETED", reason: "No new messages in fetch window" });
      } else {
         if (nextPageToken) {
            // All messages on this page are processed, move to next page
            await redis.set(pageTokenKey, nextPageToken, { ex: 60 * 60 * 24 });
            // Queue next worker iteration
            await bulkPublishToQstash({
              items: [{
                path: "/api/user/bulk-process/worker",
                body: { jobId },
              }],
            });
            return NextResponse.json({ status: "CONTINUED", reason: "Page fully processed, moving to next page" });
         } else {
            // No more pages
            await completeJob(jobId);
            await redis.del(pageTokenKey);
            return NextResponse.json({ status: "COMPLETED", reason: "All pages processed (non-archiving mode)" });
         }
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
               lastError: formatErrorMessage(error)
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
          path: "/api/user/bulk-process/worker",
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
