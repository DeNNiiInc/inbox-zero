import prisma from "@/utils/prisma";
import type { BulkProcessingJob, BulkProcessingStatus } from "@/generated/prisma";
import { bulkPublishToQstash } from "@/utils/upstash";

export interface StartBulkProcessParams {
  emailAccountId: string;
  maxEmails?: number;
  skipArchive?: boolean;
}

export async function startBulkProcessing({
  emailAccountId,
  maxEmails,
  skipArchive = false,
}: StartBulkProcessParams) {
  // Check if there's already an active job
  const existingJob = await prisma.bulkProcessingJob.findFirst({
    where: {
      emailAccountId,
      status: {
        in: ["PENDING", "PROCESSING", "PAUSED"],
      },
    },
  });

  if (existingJob) {
    if (existingJob.status === "PAUSED") {
      // If paused, we can resume it, or return it as is
      return existingJob;
    }
    throw new Error("A bulk processing job is already active for this account");
  }

  // Create new job
  const job = await prisma.bulkProcessingJob.create({
    data: {
      emailAccountId,
      status: "PENDING",
      totalEmails: maxEmails || 0, // 0 means unknown/all until we count them
      maxEmails,
      skipArchive,
      startedAt: new Date(),
    },
  });

  // Queue first batch
  await bulkPublishToQstash({
    items: [{
      body: { jobId: job.id },
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/user/bulk-process/worker`,
    }],
  });

  return job;
}

export async function getBulkProcessingStatus(emailAccountId: string) {
  const job = await prisma.bulkProcessingJob.findFirst({
    where: {
      emailAccountId,
      status: {
        in: ["PENDING", "PROCESSING", "PAUSED"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // If no active job, get the last completed/failed one
  if (!job) {
    return prisma.bulkProcessingJob.findFirst({
      where: {
        emailAccountId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  return job;
}

export async function pauseBulkProcessing(emailAccountId: string, jobId: string) {
  const job = await prisma.bulkProcessingJob.findFirst({
    where: {
      id: jobId,
      emailAccountId,
    },
  });

  if (!job) throw new Error("Job not found");

  return prisma.bulkProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "PAUSED",
    },
  });
}

export async function resumeBulkProcessing(emailAccountId: string, jobId: string) {
  const job = await prisma.bulkProcessingJob.findFirst({
    where: {
      id: jobId,
      emailAccountId,
    },
  });

  if (!job) throw new Error("Job not found");

  // Queue next batch to restart processing
  await bulkPublishToQstash({
    items: [{
      body: { jobId: job.id },
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/user/bulk-process/worker`,
    }],
  });

  return prisma.bulkProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
    },
  });
}

export async function stopBulkProcessing(emailAccountId: string, jobId: string) {
  const job = await prisma.bulkProcessingJob.findFirst({
    where: {
      id: jobId,
      emailAccountId,
    },
  });

  if (!job) throw new Error("Job not found");

  return prisma.bulkProcessingJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED", // Or failed/cancelled if we want to distinguish
      completedAt: new Date(),
    },
  });
}
