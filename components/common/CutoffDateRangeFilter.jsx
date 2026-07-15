// components/common/CutoffDateRangeFilter.jsx
"use client";

import { CircleDot, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Cutoff periods come back one record per department for the same pay period; "a cutoff"
// in the UI should mean "this pay period" (every department), not just whichever single
// department record happened to be fetched — otherwise generating a report only pulls one
// department's employees. periodRangeKey groups siblings together.
export const periodRangeKey = (p) => `${p.periodStart?.slice(0, 10) ?? ""}|${p.periodEnd?.slice(0, 10) ?? ""}`;

export function groupPeriodsByRange(periods) {
  const map = new Map();
  for (const p of periods) {
    const key = periodRangeKey(p);
    if (!map.has(key)) map.set(key, { key, periodStart: p.periodStart, periodEnd: p.periodEnd, periods: [] });
    map.get(key).periods.push(p);
  }
  return [...map.values()].sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart));
}

// Aggregate status across every department's period for the same range — "locked" only
// once all of them are locked/processed; "partial" if some are and some aren't, so the
// UI can warn rather than silently reporting on an incomplete set of departments.
export function groupStatus(group) {
  const statuses = group.periods.map((p) => p.status);
  const allDone  = statuses.every((s) => ["locked", "processed"].includes(s));
  const anyDone  = statuses.some((s) => ["locked", "processed"].includes(s));
  if (allDone) return statuses.every((s) => s === "processed") ? "processed" : "locked";
  if (anyDone) return "partial";
  return "open";
}

const STATUS_TIP = {
  open:      "Open — live punch data, still editable",
  locked:    "Locked — reviewed & approved, payroll not yet run",
  processed: "Processed — payroll run, figures final",
  partial:   "Partial — some departments done, some not; report may be incomplete",
};

// Colors match the STATUS_CONFIG badge language already established in CutoffReview.jsx
// (the actual cutoff review page) — open=green, locked=amber, processed=blue — so a period
// reads the same way here as it does there. "Partial" has no equivalent on that page (it's
// an aggregate-only concept, several departments disagreeing on one range), so it gets its
// own color: red, matching this app's existing "needs attention" convention.
function StatusGlyph({ status, className = "h-3.5 w-3.5" }) {
  let icon;
  if (status === "open") icon = <CircleDot className={`${className} text-green-600 dark:text-green-400 shrink-0`} />;
  else if (status === "locked") icon = <Lock className={`${className} text-amber-600 dark:text-amber-400 shrink-0`} />;
  else if (status === "processed") icon = <CheckCircle2 className={`${className} text-blue-600 dark:text-blue-400 shrink-0`} />;
  else if (status === "partial") icon = <AlertTriangle className={`${className} text-red-600 dark:text-red-400 shrink-0`} />;
  else return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{icon}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">{STATUS_TIP[status]}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const fmtCutoffDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Cutoff-period-aware date range filter. Two pieces, either shown together or split
 * across separate filter slots via `mode`:
 *   - the quick-select dropdown grouped by pay period (status glyph + hover tooltip,
 *     "Current" tag, department count)
 *   - manual Start/End date inputs + an Apply action, for ranges outside anything the
 *     dropdown offers
 * Fully controlled — all state lives in the parent.
 *
 * `mode`:
 *   - "combined" (default) — both pieces in one control, dropdown feeds the same
 *     Start/End inputs it sits next to. Used where there's only one "Date Range" slot
 *     to work with.
 *   - "picker" — dropdown only. Renders nothing if `cutoffPeriods` yields no groups.
 *   - "range" — Start/End + Apply only, no dropdown, each input explicitly labeled.
 *
 * `size="compact"` matches the employee panel's mobile-first filter rows (h-8/text-xs/
 * rounded-lg). In "combined" + compact, Start/End collapse to an unlabeled "[date] to
 * [date]" row; "range" mode always shows explicit "Start"/"End" labels since it's
 * presented as its own filter, not paired with a dropdown alongside it.
 */
export default function CutoffDateRangeFilter({
  cutoffPeriods = [],
  selectedCutoffId,
  onSelectCutoff,
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  isDirty = false,
  maxDate,
  className = "",
  size = "default",
  mode = "combined",
}) {
  const compact = size === "compact";
  const todayStr = maxDate || new Date().toLocaleDateString("en-CA");
  const selectableGroups = groupPeriodsByRange(
    cutoffPeriods.filter((p) => (p.periodStart?.slice(0, 10) ?? "") <= todayStr)
  );
  const isCurrentGroup = (g) => {
    const s = g.periodStart?.slice(0, 10) ?? "";
    const e = g.periodEnd?.slice(0, 10) ?? "";
    return !!s && !!e && s <= todayStr && todayStr <= e;
  };

  const triggerCls = compact ? "h-8 text-xs rounded-lg w-full sm:w-auto sm:min-w-[190px]" : "h-9 w-full sm:w-auto sm:min-w-[190px]";
  const inputCls   = compact ? "h-8 text-xs rounded-lg flex-1" : "h-9 w-full sm:w-auto";
  const buttonCls  = compact ? "h-8 text-xs rounded-lg bg-orange-500 hover:bg-orange-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white";
  const dirtyCls   = compact ? "text-[11px] text-orange-500 font-medium" : "text-xs text-orange-500 font-medium";
  const glyphCls   = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const labelCls   = compact ? "text-xs text-muted-foreground shrink-0" : "text-sm text-muted-foreground shrink-0";

  // In "picker" mode this is its own filter slot and should always be present — same
  // as any other filter — even with zero periods loaded yet, it just offers only
  // "Custom range". In "combined" mode it stays paired with Start/End, so it only
  // shows once there's something to pick that the inputs next to it can't already do.
  const showPicker = mode !== "range" && (mode === "picker" || selectableGroups.length > 0);
  const showRange  = mode !== "picker";

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {showPicker && (
        <Select value={selectedCutoffId} onValueChange={onSelectCutoff}>
          <SelectTrigger className={triggerCls}>
            <SelectValue placeholder="Custom range" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">Custom range</SelectItem>
            {selectableGroups.map((g) => {
              const status = groupStatus(g);
              return (
                <SelectItem key={g.key} value={g.key}>
                  <span className="flex items-center gap-1.5 min-w-0">
                    <StatusGlyph status={status} className={glyphCls} />
                    <span className="truncate">{fmtCutoffDate(g.periodStart)} – {fmtCutoffDate(g.periodEnd)}</span>
                    {isCurrentGroup(g) && (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                    {g.periods.length > 1 && (
                      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {g.periods.length} depts
                      </span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
      {showRange && (mode === "range" ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>Start</span>
            <Input type="date" value={from} max={maxDate} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>End</span>
            <Input type="date" value={to} max={maxDate} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
          </div>
        </>
      ) : compact ? (
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
          <Input type="date" value={from} max={maxDate} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
          <span className="text-xs text-muted-foreground shrink-0">to</span>
          <Input type="date" value={to} max={maxDate} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>From</span>
            <Input type="date" value={from} max={maxDate} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>To</span>
            <Input type="date" value={to} max={maxDate} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
          </div>
        </>
      ))}
      {showRange && (
        <Button size="sm" onClick={onApply} className={buttonCls}>
          Apply
        </Button>
      )}
      {showRange && isDirty && (
        <span className={dirtyCls}>Unsaved date range</span>
      )}
    </div>
  );
}
