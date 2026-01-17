import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { getBulkProcessingStatus, pauseBulkProcessing } from "@/utils/bulk/bulk-processing";

export const GET = withEmailAccount("bulk-process/status", async (request) => {
  const status = await getBulkProcessingStatus(request.auth.emailAccountId);
  return NextResponse.json({ job: status });
}, { allowOrgAdmins: true });

const actionSchema = z.object({
  action: z.literal("pause"),
  jobId: z.string(),
});

export const POST = withEmailAccount("bulk-process/status/action", async (request) => {
  const body = await request.json();
  const validation = actionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { action, jobId } = validation.data;
  
  if (action === "pause") {
      await pauseBulkProcessing(jobId, request.auth.emailAccountId);
  }

  return NextResponse.json({ success: true });
}, { allowOrgAdmins: true });
