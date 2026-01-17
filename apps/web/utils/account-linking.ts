import type { GetAuthLinkUrlResponse } from "@/app/api/google/linking/auth-url/route";
import type { GetOutlookAuthLinkUrlResponse } from "@/app/api/outlook/linking/auth-url/route";
import { isGoogleProvider } from "@/utils/email/provider-types";

/**
 * Initiates the OAuth account linking flow for Google or Microsoft.
 * Returns the OAuth URL to redirect the user to.
 * @throws Error if the request fails
 */
export async function getAccountLinkingUrl(
  provider: "google" | "microsoft",
  mailboxAddress?: string,
): Promise<string> {
  const apiProvider = provider === "microsoft" ? "outlook" : "google";

  const searchParams = new URLSearchParams();
  if (mailboxAddress) {
    searchParams.set("sharedMailboxAddress", mailboxAddress);
  }

  const query = searchParams.toString();
  const url = `/api/${apiProvider}/linking/auth-url${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to initiate ${isGoogleProvider(provider) ? "Google" : "Microsoft"} account linking`,
    );
  }

  const data: GetAuthLinkUrlResponse | GetOutlookAuthLinkUrlResponse =
    await response.json();

  return data.url;
}
