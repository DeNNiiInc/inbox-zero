import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/auth/middleware";
import { startBulkProcessing } from "@/utils/bulk/bulk-processing";

const startSchema = z.object({
  maxEmails: z.enum(["5000", "10000", "all"]).optional(),
  skipArchive: z.boolean().optional(),
});

export const POST = withEmailAccount(async (request) => {
  const { emailAccountId } = request.auth;
  const json = await request.json();
  const body = startSchema.parse(json);

  let maxEmails: number | undefined;
  if (body.maxEmails === "5000") maxEmails = 5000;
  if (body.maxEmails === "10000") maxEmails = 10000;
  // "all" leaves maxEmails as undefined

  try {
    const job = await startBulkProcessing({
      emailAccountId,
      maxEmails,
      skipArchive: body.skipArchive,
    });

    return NextResponse.json(job);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
});
