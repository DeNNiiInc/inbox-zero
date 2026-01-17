"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toastError } from "@/components/Toast";
import Image from "next/image";
import { MutedText } from "@/components/Typography";
import { getAccountLinkingUrl } from "@/utils/account-linking";
import { isGoogleProvider } from "@/utils/email/provider-types";
import { Input } from "@/components/Input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function AddAccount() {
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingMicrosoft, setIsLoadingMicrosoft] = useState(false);
  const [isSharedMailbox, setIsSharedMailbox] = useState(false);
  const [sharedMailboxEmail, setSharedMailboxEmail] = useState("");

  const handleAddAccount = async (provider: "google" | "microsoft") => {
    const setLoading = isGoogleProvider(provider)
      ? setIsLoadingGoogle
      : setIsLoadingMicrosoft;
    setLoading(true);

    try {
      const url = await getAccountLinkingUrl(
        provider,
        provider === "microsoft" && isSharedMailbox ? sharedMailboxEmail : undefined
      );
      window.location.href = url;
    } catch (error) {
      console.error(`Error initiating ${provider} link:`, error);
      toastError({
        title: `Error initiating ${isGoogleProvider(provider) ? "Google" : "Microsoft"} link`,
        description: "Please try again or contact support",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 min-h-[90px]">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleAddAccount("google")}
          loading={isLoadingGoogle}
          disabled={isLoadingGoogle || isLoadingMicrosoft}
        >
          <Image
            src="/images/google.svg"
            alt=""
            width={24}
            height={24}
            unoptimized
          />
          <span className="ml-2">Add Google</span>
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleAddAccount("microsoft")}
          loading={isLoadingMicrosoft}
          disabled={isLoadingGoogle || isLoadingMicrosoft}
        >
          <Image
            src="/images/microsoft.svg"
            alt=""
            width={24}
            height={24}
            unoptimized
          />
          <span className="ml-2">Add Microsoft</span>
        </Button>
      </div>

      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="shared-mailbox"
            checked={isSharedMailbox}
            onCheckedChange={(checked) => setIsSharedMailbox(!!checked)}
          />
          <Label htmlFor="shared-mailbox" className="text-sm cursor-pointer">
            Add a shared mailbox (delegated access)
          </Label>
        </div>

        {isSharedMailbox && (
          <div className="mt-1">
            <Input
              type="email"
              name="sharedMailboxEmail"
              placeholder="shared-mailbox@company.com"
              registerProps={{
                value: sharedMailboxEmail,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setSharedMailboxEmail(e.target.value),
              }}
              className="w-full"
              explainText="Enter the email address of the shared mailbox you want to access."
            />
          </div>
        )}
      </div>

      <MutedText>You will be billed for each account.</MutedText>
    </div>
  );
}
