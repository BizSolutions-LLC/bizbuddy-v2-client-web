"use client";
// components/Dashboard/SetupGuide/SetupGuideCard.jsx
// BB-115 — compact "Set up your business" card at the top of the sidebar (admin / superadmin).
// Shows progress and the "Up next" step; the full checklist opens in SetupGuideSheet.
// Once hidden or fully finished it shrinks to a one-line "Setup guide (36%)" entry.

import { useState } from "react";
import { ArrowRight, CheckCircle2, ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import useAuthStore from "@/store/useAuthStore";
import useSetupGuide from "./useSetupGuide";
import SetupGuideSheet, { ProgressSummary } from "./SetupGuideSheet";
import { resolveStepPage } from "./setupRoutes";

export default function SetupGuideCard({ enabled, isLocked, onNavigate }) {
  const { token } = useAuthStore();
  const { checklist, busy, error, act } = useSetupGuide(token, enabled);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!enabled || !checklist) return null;

  const sheet = (
    <SetupGuideSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      checklist={checklist}
      busy={busy}
      error={error}
      act={act}
      isLocked={isLocked}
      onNavigate={onNavigate}
    />
  );

  // Hidden or everything finished → small entry. Reopening a dismissed guide also opens it.
  if (checklist.dismissed || checklist.allFinished) {
    return (
      <>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={async () => {
            if (checklist.dismissed && !(await act("reopen"))) return;
            setSheetOpen(true);
          }}
          className="w-full flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
        >
          {busy === "reopen:" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
          <span>Setup guide ({checklist.progress?.percent ?? 0}%)</span>
        </button>
        {sheet}
      </>
    );
  }

  const next   = checklist.steps?.find((s) => s.key === checklist.nextStepKey);
  const target = next ? resolveStepPage(next.page) : null;
  const canGo  = target && !isLocked(target.navId);

  return (
    <>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            {checklist.isComplete && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            {checklist.isComplete ? "You're all set" : "Set up your business"}
          </p>
          {checklist.isComplete && (
            <p className="text-[11px] text-muted-foreground mt-0.5">All required steps are done. A few optional ones remain.</p>
          )}
        </div>

        <ProgressSummary progress={checklist.progress} />

        {next && (
          <div className="border-t pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Up next</p>
            <p className="text-xs font-medium mt-0.5">{next.title}</p>
            {next.status === "todo" && next.detail && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{next.detail}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {canGo && (
            <Button size="sm" className="h-7 text-xs" onClick={() => onNavigate(target.route)}>
              Go <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSheetOpen(true)}>
            View all steps
          </Button>
        </div>
      </div>
      {sheet}
    </>
  );
}
