"use client";
// components/Dashboard/SetupGuide/SetupGuideSheet.jsx
// BB-115 — full "Set up your business" checklist in a side panel. Step text comes from the
// server as-is; the client only maps `page` to a route (setupRoutes.js).

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Lock, SkipForward, ChevronDown, ArrowRight, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { resolveStepPage } from "./setupRoutes";

export const INTRO_TEXT =
  "Let's get your business ready. Follow these steps to set up your departments, people, schedules and pay periods. " +
  "Each step checks itself off as you go, and you can come back to this guide anytime.";

const isFinished = (s) => s.status === "done" || s.status === "reviewed" || s.status === "skipped";

function StatusIcon({ step }) {
  if (step.status === "done" || step.status === "reviewed") return <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />;
  if (step.status === "skipped") return <SkipForward className="w-4 h-4 text-muted-foreground shrink-0" />;
  if (step.blockedBy?.length) return <Lock className="w-4 h-4 text-muted-foreground shrink-0" />;
  return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
}

export function ProgressSummary({ progress }) {
  if (!progress) return null;
  return (
    <div className="space-y-1.5">
      <Progress value={progress.percent} className="h-1.5" />
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{progress.done} of {progress.total}</span> steps
        {" · "}{progress.requiredDone}/{progress.requiredTotal} required
      </p>
    </div>
  );
}

function StepRow({ step, titles, expanded, onToggle, isNext, busy, act, isLocked, onGo }) {
  const target  = resolveStepPage(step.page);
  const locked  = target ? isLocked(target.navId) : null; // null | { requiredPlan }
  const blocked = step.blockedBy?.length > 0 && !isFinished(step);
  const running = (action) => busy === `${action}:${step.key}`;
  const anyBusy = Boolean(busy);

  return (
    <li className={cn("border-b last:border-b-0", step.status === "skipped" && "opacity-70")}>
      <button
        type="button"
        onClick={() => onToggle(step.key)}
        className="w-full flex items-start gap-2.5 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="mt-0.5"><StatusIcon step={step} /></span>
        <span className="flex-1 min-w-0">
          <span className={cn("block text-sm font-medium", blocked && "text-muted-foreground", step.status === "skipped" && "line-through")}>
            {step.title}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 mt-1">
            {step.required && <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">Required</Badge>}
            {isNext && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">Up next</Badge>}
            {step.progress && (
              <span className="text-[11px] text-muted-foreground">{step.progress.current}/{step.progress.target}</span>
            )}
            {step.status === "reviewed" && <span className="text-[11px] text-muted-foreground">Reviewed</span>}
            {step.status === "skipped" && <span className="text-[11px] text-muted-foreground">Skipped</span>}
          </span>
        </span>
        <ChevronDown className={cn("w-4 h-4 mt-0.5 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="pl-[26px] pb-3 space-y-2">
          {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
          {step.status === "todo" && step.detail && <p className="text-xs font-medium text-foreground">{step.detail}</p>}
          {blocked && (
            <p className="text-xs text-muted-foreground">
              Do {step.blockedBy.map((k) => titles[k] || k).join(", ")} first.
            </p>
          )}
          {!target && <p className="text-xs text-muted-foreground">Not available on web yet.</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            {target && !locked && (
              <Button size="sm" variant={isNext ? "default" : "outline"} className="h-8" onClick={() => onGo(target.route)}>
                Go <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
            {target && locked && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => onGo("/dashboard/company/subscription")}>
                <Lock className="w-3.5 h-3.5 mr-1" /> Upgrade to {locked.requiredPlan}
              </Button>
            )}

            {step.canReview && step.status !== "reviewed" && step.status !== "skipped" && (
              <Button size="sm" variant="outline" className="h-8" disabled={anyBusy} onClick={() => act("review", step.key)}>
                {running("review") && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Mark reviewed
              </Button>
            )}
            {step.status === "reviewed" && (
              <Button size="sm" variant="ghost" className="h-8" disabled={anyBusy} onClick={() => act("unreview", step.key)}>
                {running("unreview") && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Undo
              </Button>
            )}

            {step.canSkip && step.status === "todo" && (
              <Button size="sm" variant="ghost" className="h-8" disabled={anyBusy} onClick={() => act("skip", step.key)}>
                {running("skip") && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Skip
              </Button>
            )}
            {step.status === "skipped" && (
              <Button size="sm" variant="ghost" className="h-8" disabled={anyBusy} onClick={() => act("unskip", step.key)}>
                {running("unskip") && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Undo skip
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function SetupGuideSheet({ open, onOpenChange, checklist, busy, error, act, isLocked, onNavigate }) {
  const [expandedKey, setExpandedKey] = useState(null);

  // Each time the panel opens, start with the "Up next" step expanded.
  useEffect(() => {
    if (open) setExpandedKey(checklist?.nextStepKey || null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps  = checklist?.steps || [];
  const titles = useMemo(() => Object.fromEntries(steps.map((s) => [s.key, s.title])), [steps]);

  const go = (route) => {
    onOpenChange(false);
    onNavigate(route);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="p-5 pb-4 border-b space-y-3 text-left">
          <SheetTitle>{checklist?.isComplete ? "You're all set" : "Set up your business"}</SheetTitle>
          <SheetDescription className="text-xs">
            {checklist?.isComplete
              ? "Every required step is finished. The optional steps below stay here until you finish, skip or hide them."
              : <><span className="font-semibold text-foreground">Welcome to BizBuddy!</span> {INTRO_TEXT}</>}
          </SheetDescription>
          <ProgressSummary progress={checklist?.progress} />
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          <ul>
            {steps.map((s) => (
              <StepRow
                key={s.key}
                step={s}
                titles={titles}
                expanded={expandedKey === s.key}
                onToggle={(k) => setExpandedKey((cur) => (cur === k ? null : k))}
                isNext={checklist.nextStepKey === s.key}
                busy={busy}
                act={act}
                isLocked={isLocked}
                onGo={go}
              />
            ))}
          </ul>
        </div>

        {!checklist?.dismissed && (
          <SheetFooter className="p-4 border-t sm:justify-start">
            <Button
              variant="ghost" size="sm" disabled={Boolean(busy)}
              onClick={async () => { if (await act("dismiss")) onOpenChange(false); }}
            >
              {busy === "dismiss:" && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Hide guide
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
