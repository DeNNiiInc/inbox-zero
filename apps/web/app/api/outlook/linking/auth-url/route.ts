import { NextResponse } from "next/server";
import { withAuth } from "@/utils/middleware";
import { getLinkingOAuth2Url } from "@/utils/outlook/client";
import { OUTLOOK_LINKING_STATE_COOKIE_NAME } from "@/utils/outlook/constants";
import {
  generateOAuthState,
  oauthStateCookieOptions,
} from "@/utils/oauth/state";

export type GetOutlookAuthLinkUrlResponse = { url: string };

const getAuthUrl = ({
  userId,
  sharedMailboxAddress,
}: {
  userId: string;
  sharedMailboxAddress?: string | null;
}) => {
  const state = generateOAuthState({ userId, sharedMailboxAddress });

  const baseUrl = getLinkingOAuth2Url();
  const url = `${baseUrl}&state=${state}`;

  return { url, state };
};

export const GET = withAuth("outlook/linking/auth-url", async (request) => {
  const userId = request.auth.userId;
  const sharedMailboxAddress =
    request.nextUrl.searchParams.get("sharedMailboxAddress");
  const { url: authUrl, state } = getAuthUrl({ userId, sharedMailboxAddress });

  const response = NextResponse.json({ url: authUrl });

  response.cookies.set(
    OUTLOOK_LINKING_STATE_COOKIE_NAME,
    state,
    oauthStateCookieOptions,
  );

  return response;
});
