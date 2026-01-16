"use client";

import { env } from "@/env";
import { FormSection } from "@/components/Form";
import { useAccount } from "@/providers/EmailAccountProvider";
import { formatDistanceToNow, parseISO } from "date-fns";

function formatGitAge(gitDateStr: string | undefined): string {
  if (!gitDateStr) return "Unknown";
  try {
    // Parse date string like "2026-01-17 09:33:02 +1100"
    const cleanedDate = gitDateStr.replace(/\s+\+\d{4}$/, "").replace(" ", "T");
    const date = parseISO(cleanedDate);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return gitDateStr;
  }
}

export function VersionSection() {
  const { emailAccount } = useAccount();
  
  const gitCommit = env.NEXT_PUBLIC_GIT_COMMIT;
  const gitDate = env.NEXT_PUBLIC_GIT_DATE;
  const gitAge = formatGitAge(gitDate);

  if (!emailAccount) return null;

  return (
    <FormSection>
      <div className="flex flex-col gap-1 text-muted-foreground text-xs">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">User:</span>
          <span>{emailAccount.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground">Version:</span>
          <span className="font-mono">
            {gitCommit ? gitCommit.substring(0, 10) : "dev"}
          </span>
          {gitAge && (
            <span className="text-muted-foreground/70">({gitAge})</span>
          )}
        </div>
      </div>
    </FormSection>
  );
}
