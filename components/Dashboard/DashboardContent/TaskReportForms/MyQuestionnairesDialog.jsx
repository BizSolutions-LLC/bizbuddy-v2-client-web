"use client";
// components/Dashboard/DashboardContent/TaskReportForms/MyQuestionnairesDialog.jsx
//
// BB-129 phase 2: the employee's questionnaires. "Pending" = punches still open to answer
// (not started or saved as draft), newest clock-out first. "History" = the employee's own
// answer sets in a date range (default last 30 days, max 93). Picking one opens the answer
// dialog through onOpenPunch (this dialog closes first, so the two never stack).

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { listMyResponses, fmtWindowHours, MAX_RESPONSE_RANGE_DAYS } from "@/lib/taskReportFormsApi";
import { fmtTimeInZone, fmtDateTimeInZone } from "@/lib/taskReportsApi";
import { ResponseStatusBadge, fmtDateInZone } from "./TaskReportFormAnswerDialog";

const dayDiff = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

export default function MyQuestionnairesDialog({ open, onOpenChange, apiUrl, token, pending, pendingLoading, onReloadPending, onOpenPunch }) {
  const [tab, setTab] = useState("pending");
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [draftRange, setDraftRange] = useState({ from: "", to: "" });

  const loadHistory = useCallback(async (r) => {
    setHistoryLoading(true); setHistoryError(null);
    try {
      const d = await listMyResponses(apiUrl, token, r || {});
      setHistory(d);
      const applied = { from: d?.from || r?.from || "", to: d?.to || r?.to || "" };
      setRange(applied); setDraftRange(applied);
    } catch (e) { setHistoryError(e.message); }
    setHistoryLoading(false);
  }, [apiUrl, token]);

  useEffect(() => { if (open && tab === "history" && !history) loadHistory(null); }, [open, tab, history, loadHistory]);
  useEffect(() => { if (open) onReloadPending?.(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) setHistory(null); }, [open]); // fresh on next open

  const rangeError = !draftRange.from || !draftRange.to
    ? "Pick both dates."
    : draftRange.from > draftRange.to
      ? "The start date must be on or before the end date."
      : dayDiff(draftRange.from, draftRange.to) > MAX_RESPONSE_RANGE_DAYS
        ? `The range can be at most ${MAX_RESPONSE_RANGE_DAYS} days.`
        : null;
  const rangeDirty = draftRange.from !== range.from || draftRange.to !== range.to;

  const items = pending?.items || [];
  const ptz = pending?.timeZone;
  const responses = history?.responses || [];
  const htz = history?.timeZone || ptz;

  const openPunch = (timeLogId) => { onOpenChange(false); onOpenPunch(timeLogId); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>My questionnaires</DialogTitle>
          <DialogDescription>
            Questionnaires for your punches.
            {pending?.windowHours ? <> You have {fmtWindowHours(pending.windowHours)} after clock-out to answer.</> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 flex gap-1 border-b">
          {[{ id: "pending", label: `Pending${items.length ? ` (${items.length})` : ""}` }, { id: "history", label: "History" }].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
                tab === t.id ? "border-orange-500 text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === "pending" ? (
            pendingLoading && !pending ? (
              <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Nothing to answer right now.</p>
                <Button variant="ghost" size="sm" onClick={onReloadPending} disabled={pendingLoading}>
                  <RefreshCw className={pendingLoading ? "animate-spin" : ""} /> Refresh
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((it) => (
                  <li key={it.timeLogId}>
                    <button
                      type="button"
                      onClick={() => openPunch(it.timeLogId)}
                      className="w-full text-left py-3 flex items-center gap-3 hover:bg-muted/40 rounded-md px-2 -mx-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{it.form?.name || "Questionnaire"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDateInZone(it.timeIn, ptz)} · {fmtTimeInZone(it.timeIn, ptz)} – {fmtTimeInZone(it.timeOut, ptz)}
                          {it.shiftName && <> · {it.shiftName}</>}
                        </p>
                        <p className="text-xs text-muted-foreground">Closes {fmtDateTimeInZone(it.closesAt, ptz)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <ResponseStatusBadge status={it.response?.status} />
                        {it.response && <span className="text-[11px] text-muted-foreground">{it.response.answeredCount} answered</span>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mq-from" className="text-xs">From</Label>
                  <Input id="mq-from" type="date" value={draftRange.from} max={draftRange.to || undefined} className="w-40"
                    onChange={(e) => setDraftRange((p) => ({ ...p, from: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mq-to" className="text-xs">To</Label>
                  <Input id="mq-to" type="date" value={draftRange.to} min={draftRange.from || undefined} className="w-40"
                    onChange={(e) => setDraftRange((p) => ({ ...p, to: e.target.value }))} />
                </div>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => loadHistory(draftRange)}
                  disabled={historyLoading || Boolean(rangeError) || !rangeDirty}>
                  Apply
                </Button>
              </div>
              {rangeError && rangeDirty && <p className="text-xs text-destructive">{rangeError}</p>}
              <Separator />
              {historyLoading && !history ? (
                <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
              ) : historyError ? (
                <p className="text-sm text-destructive">{historyError}</p>
              ) : responses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No questionnaires in this date range.</p>
              ) : (
                <ul className="divide-y">
                  {responses.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openPunch(r.timeLogId)}
                        className="w-full text-left py-3 flex items-center gap-3 hover:bg-muted/40 rounded-md px-2 -mx-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.form?.name || "Questionnaire"}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDateInZone(r.punch?.timeIn, htz)} · {fmtTimeInZone(r.punch?.timeIn, htz)} – {fmtTimeInZone(r.punch?.timeOut, htz)}
                            {r.shiftName && <> · {r.shiftName}</>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.status === "submitted"
                              ? <>Submitted {fmtDateTimeInZone(r.submittedAt, htz)}</>
                              : r.status === "incomplete"
                                ? <>Closed {fmtDateTimeInZone(r.closesAt, htz)}</>
                                : <>Closes {fmtDateTimeInZone(r.closesAt, htz)}</>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <ResponseStatusBadge status={r.status} />
                          <span className="text-[11px] text-muted-foreground">{r.answeredCount}/{r.questionCount} answered</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
