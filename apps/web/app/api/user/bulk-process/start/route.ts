import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { startBulkProcessing } from "@/utils/bulk/bulk-processing";

const startSchema = z.object({
  maxEmails: z.union([z.literal("all"), z.string().regex(/^\d+$/), z.number()]),
  skipArchive: z.boolean().optional(),
});

export const POST = withEmailAccount("bulk-process/start", async (request) => {
  const body = await request.json();
  const validation = startSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { maxEmails, skipArchive } = validation.data;

  const limit = maxEmails === "all" ? undefined : (typeof maxEmails === 'string' ? parseInt(maxEmails) : maxEmails);
  
  const jobId = await startBulkProcessing({
    emailAccountId: request.auth.emailAccountId,
    maxEmails: limit,
    skipArchive: skipArchive
  });

  return NextResponse.json({ jobId });
});
