import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/auth/middleware";
import { 
  getBulkProcessingStatus, 
  pauseBulkProcessing 
} from "@/utils/bulk/bulk-processing";

const actionSchema = z.object({
  action: z.enum(["pause"]).optional(),
  jobId: z.string().optional(),
});

export const GET = withEmailAccount(async (request) => {
  const { emailAccountId } = request.auth;
  const status = await getBulkProcessingStatus(emailAccountId);
  return NextResponse.json({ job: status });
});

export const POST = withEmailAccount(async (request) => {
  const { emailAccountId } = request.auth;
  const json = await request.json();
  const body = actionSchema.parse(json);

  if (body.action === "pause" && body.jobId) {
    try {
      const job = await pauseBulkProcessing(emailAccountId, body.jobId);
      return NextResponse.json(job);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: "Invalid action" },
    { status: 400 }
  );
});
