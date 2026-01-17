import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { resumeBulkProcessing } from "@/utils/bulk/bulk-processing";

const resumeSchema = z.object({
  jobId: z.string(),
});

export const POST = withEmailAccount("bulk-process/resume", async (request) => {
  const body = await request.json();
  const validation = resumeSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { jobId } = validation.data;
  
  await resumeBulkProcessing(jobId, request.auth.emailAccountId);

  return NextResponse.json({ success: true });
});
