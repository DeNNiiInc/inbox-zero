import { z } from "zod";

export const updateReferralSignatureBody = z.object({
  enabled: z.boolean(),
});

export const updateHiddenAiDraftLinksBody = z.object({
  enabled: z.boolean(),
});

export const updateMailboxAddressBody = z.object({
  mailboxAddress: z.string().min(1, "Mailbox address is required"),
});
