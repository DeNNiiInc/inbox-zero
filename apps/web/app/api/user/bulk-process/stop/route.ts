import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/auth/middleware";
import { stopBulkProcessing } from "@/utils/bulk/bulk-processing";

const stopSchema = z.object({
  jobId: z.string(),
});

export const POST = withEmailAccount(async (request) => {
  const { emailAccountId } = request.auth;
  const json = await request.json();
  const body = stopSchema.parse(json);

  try {
    const job = await stopBulkProcessing(emailAccountId, body.jobId);
    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
});
