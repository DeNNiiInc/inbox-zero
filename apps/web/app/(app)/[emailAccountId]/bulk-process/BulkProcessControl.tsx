"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PlayIcon, PauseIcon, StopIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface BulkProcessControlProps {
  emailAccountId: string;
}

export function BulkProcessControl({ emailAccountId }: BulkProcessControlProps) {
  const [selectedCount, setSelectedCount] = useState<string>("5000");
  const [skipArchive, setSkipArchive] = useState<boolean>(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);

  const { data, error, mutate } = useSWR<{ job: any }>(
    `/api/user/bulk-process/status`,
    { refreshInterval: 2000 }
  );

  const job = data?.job;
  const isProcessing = job?.status === "PROCESSING" || job?.status === "PENDING";
  const isPaused = job?.status === "PAUSED";
  
  const processedCount = job?.processedCount || 0;
  const totalEmails = job?.totalEmails || 0;
  const progress = totalEmails > 0 ? (processedCount / totalEmails) * 100 : 0;
  const errorCount = job?.errorCount || 0;

  const handleStart = async () => {
    setIsLoadingAction(true);
    try {
      const res = await fetch(`/api/user/bulk-process/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          maxEmails: selectedCount,
          skipArchive
        }),
      });
      
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to start");
      }
      
      mutate();
      toast.success("Bulk processing started in background");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handlePause = async () => {
    if (!job?.id) return;
    setIsLoadingAction(true);
    try {
      const res = await fetch(`/api/user/bulk-process/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", jobId: job.id }),
      });
      if (!res.ok) throw new Error("Failed to pause");
      mutate();
      toast.info("Paused processing");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleResume = async () => {
    if (!job?.id) return;
    setIsLoadingAction(true);
    try {
      const res = await fetch(`/api/user/bulk-process/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) throw new Error("Failed to resume");
      mutate();
      toast.success("Resumed processing");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  const handleStop = async () => {
    if (!job?.id) return;
    setIsLoadingAction(true);
    try {
      const res = await fetch(`/api/user/bulk-process/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (!res.ok) throw new Error("Failed to stop");
      mutate();
      toast.info("Stopped processing");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoadingAction(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Email Processing</CardTitle>
          <CardDescription>
            Process existing emails with your active rules in the background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(!job || job.status === "COMPLETED" || job.status === "FAILED") && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Number of emails to process</Label>
                <Select value={selectedCount} onValueChange={setSelectedCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">Recent 5,000 Emails</SelectItem>
                    <SelectItem value="10000">Recent 10,000 Emails</SelectItem>
                    <SelectItem value="all">Check All Emails (Lookahead)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  "All Emails" will scan your inbox until no new emails are found.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="skip-archive" 
                  checked={skipArchive}
                  onCheckedChange={(checked) => setSkipArchive(Boolean(checked))}
                />
                <Label htmlFor="skip-archive">Skip archiving (Process only)</Label>
              </div>

              <Button 
                onClick={handleStart} 
                className="w-full" 
                disabled={isLoadingAction}
              >
                <PlayIcon className="mr-2 h-4 w-4" />
                Start Processing
              </Button>
            </div>
          )}

          {job && (job.status === "PROCESSING" || job.status === "PENDING" || job.status === "PAUSED") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    Status: <Badge variant={isPaused ? "secondary" : "default"}>{job.status}</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground">Started at {new Date(job.startedAt).toLocaleString()}</p>
                </div>
                {isPaused ? (
                  <Button size="sm" onClick={handleResume} disabled={isLoadingAction}>
                    <PlayIcon className="mr-2 h-4 w-4" /> Resume
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handlePause} disabled={isLoadingAction}>
                    <PauseIcon className="mr-2 h-4 w-4" /> Pause
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress ({processedCount} / {job.maxEmails ? job.maxEmails : "unknown"})</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                   <span className="font-medium text-foreground">{processedCount}</span> processed
                </div>
                <div className="flex items-center gap-1">
                   <span className="font-medium text-red-500">{errorCount}</span> errors
                </div>
              </div>

              <CardFooter className="px-0 pt-4 flex justify-between">
                 <Button 
                   variant="destructive" 
                   size="sm" 
                   onClick={handleStop}
                   disabled={isLoadingAction}
                 >
                   <StopIcon className="mr-2 h-4 w-4" /> Stop Job
                 </Button>
                 {isProcessing && (
                   <div className="flex items-center text-xs text-muted-foreground animate-pulse">
                     <UpdateIcon className="mr-1 h-3 w-3 animate-spin" /> Processing in background...
                   </div>
                 )}
              </CardFooter>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
