import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { stopBulkProcessing } from "@/utils/bulk/bulk-processing";

const stopSchema = z.object({
  jobId: z.string(),
});

export const POST = withEmailAccount("bulk-process/stop", async (request) => {
  const body = await request.json();
  const validation = stopSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { jobId } = validation.data;
  
  await stopBulkProcessing(jobId, request.auth.emailAccountId);

  return NextResponse.json({ success: true });
}, { allowOrgAdmins: true });
