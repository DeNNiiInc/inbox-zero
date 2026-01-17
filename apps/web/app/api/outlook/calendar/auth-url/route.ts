import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import { getCalendarOAuth2Url } from "@/utils/outlook/calendar-client";
import { CALENDAR_STATE_COOKIE_NAME } from "@/utils/calendar/constants";
import {
  generateOAuthState,
  oauthStateCookieOptions,
} from "@/utils/oauth/state";
import prisma from "@/utils/prisma";

export type GetCalendarAuthUrlResponse = { url: string };

const getAuthUrl = ({ emailAccountId, mailboxAddress }: { emailAccountId: string; mailboxAddress?: string }) => {
  const state = generateOAuthState({
    emailAccountId,
    type: "calendar",
    mailboxAddress,
  });

  const url = getCalendarOAuth2Url(state);

  return { url, state };
};

export const GET = withEmailAccount(async (request) => {
  const { emailAccountId } = request.auth;
  
  // Look up the email account's mailboxAddress for shared mailbox support
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
    select: { mailboxAddress: true },
  });
  
  const mailboxAddress = emailAccount?.mailboxAddress !== "me" 
    ? emailAccount?.mailboxAddress 
    : undefined;
  
  const { url, state } = getAuthUrl({ emailAccountId, mailboxAddress });

  const res: GetCalendarAuthUrlResponse = { url };
  const response = NextResponse.json(res);

  response.cookies.set(
    CALENDAR_STATE_COOKIE_NAME,
    state,
    oauthStateCookieOptions,
  );

  return response;
});
