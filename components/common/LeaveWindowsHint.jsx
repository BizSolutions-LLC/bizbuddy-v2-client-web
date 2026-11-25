"use client";

// BB-124 (added task): the small times line under a leave day's date, with the full
// shift names (and zone when different) in a hover tooltip. See lib/leaveWindows.js.
import React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { leaveWindowsSummary } from "@/lib/leaveWindows";

export default function LeaveWindowsHint({ windows, companyTz }) {
  const summary = leaveWindowsSummary(windows, companyTz);
  if (!summary) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-[10px] leading-tight text-muted-foreground cursor-help whitespace-nowrap">
            {summary.short}
            <Info className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          {summary.detail.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
