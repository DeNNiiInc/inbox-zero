"use client";

import { env } from "@/env";
import { useAccount } from "@/providers/EmailAccountProvider";
import { formatDistanceToNow, parseISO } from "date-fns";

function formatGitAge(gitDateStr: string | undefined): string {
  if (!gitDateStr) return "";
  try {
    // Parse date string like "2026-01-17 09:33:02 +1100"
    const cleanedDate = gitDateStr.replace(/\s+\+\d{4}$/, "").replace(" ", "T");
    const date = parseISO(cleanedDate);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

export function VersionInfo() {
  const { emailAccount } = useAccount();
  
  const gitCommit = env.NEXT_PUBLIC_GIT_COMMIT;
  const gitDate = env.NEXT_PUBLIC_GIT_DATE;
  const gitAge = formatGitAge(gitDate);

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
      {emailAccount && (
        <span>{emailAccount.email}</span>
      )}
      {emailAccount && gitCommit && <span className="text-border">|</span>}
      {gitCommit && (
        <span className="font-mono">
          {gitCommit.substring(0, 10)}
        </span>
      )}
      {gitAge && (
        <span className="text-muted-foreground/70">({gitAge})</span>
      )}
    </div>
  );
}
