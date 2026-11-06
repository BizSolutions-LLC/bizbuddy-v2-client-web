// components/system-admin/performance/ReportsView.jsx
//
// BB-113 Performance → Reports. Report 0 is the Baseline: the 30 days ending at
// the production deploy that moved the database connection (entered once here).
// Periods 1, 2, 3… are consecutive 30-day windows from the Baseline's end; the
// server saves each the day after it ends, and the running one can be saved to
// date. Finished reports never change, so they compare cleanly. Each row is a PDF.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemAdminDownload, systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatDateTime, formatNumber } from "../shared";
import { VerdictBadge } from "./CapacityCards";

const LEFT = "text-left px-3";
const BASE = "/api/system-admin/capacity/reports";

// "2026-10-29T09:40" for a datetime-local input, in the admin's own time
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDay = (value, timeZone, year = true) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}), timeZone });

// "Oct 29 – Nov 28, 2026"; the year shows on both sides only when it differs
const formatRange = (start, end, timeZone) => {
  const year = (v) => new Date(v).toLocaleDateString("en-US", { year: "numeric", timeZone });
  return `${formatDay(start, timeZone, year(start) !== year(end))} – ${formatDay(end, timeZone)}`;
};

function BaselineSetup({ busy, onSave }) {
  const [value, setValue] = useState("");
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Set the Baseline</CardTitle>
        <CardDescription className="max-w-2xl">
          The 30 days before production&apos;s database connection moved to Render&apos;s Internal URL. Every later
          report is compared with it. Find the deploy time in Render → web service → Events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (value) onSave(new Date(value).toISOString());
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="baseline-ends-at">Switch time</Label>
            <Input
              id="baseline-ends-at"
              type="datetime-local"
              value={value}
              max={toLocalInput(new Date())}
              onChange={(e) => setValue(e.target.value)}
              className="w-56"
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={!value || !!busy}>
            <FileText className={busy === "baseline" ? "animate-pulse" : ""} /> Save Baseline
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">In your local time. It can&apos;t be moved once periods exist.</p>
      </CardContent>
    </Card>
  );
}

export default function ReportsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(""); // "baseline" | "current" | "period:N" | "pdf:N"

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await systemAdminFetch(BASE);
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Saving takes a few seconds, then the list reloads
  const save = async (key, path, body) => {
    setBusy(key);
    setError("");
    try {
      await systemAdminFetch(path, { method: "POST", body });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const download = async (number) => {
    setBusy(`pdf:${number}`);
    setError("");
    try {
      await systemAdminDownload(`${BASE}/${number}/pdf`, `bizbuddy-performance-${number}.pdf`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const tz = data?.timezone || "America/Los_Angeles";
  const days = data?.periodDays ?? 30;
  const reports = data?.reports || [];
  const baseline = data?.baseline || null;
  const current = data?.current || null;
  const saved = new Map(reports.map((r) => [r.number, r]));
  // The last finished period, when the daily job hasn't saved it as final (it only runs on Render)
  const lastNumber = current ? current.number - 1 : 0;
  const lastMissing = lastNumber >= 1 && !(saved.get(lastNumber) && !saved.get(lastNumber).isPartial);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A PDF every {days} days: plans, cost, server, database and slowest endpoints, compared with the period before
          and with the Baseline.
        </p>
        {current && (
          <div className="flex flex-wrap items-center gap-2">
            {lastMissing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => save(`period:${lastNumber}`, `${BASE}/periods/${lastNumber}`)}
                disabled={!!busy}
              >
                <FileText className={busy === `period:${lastNumber}` ? "animate-pulse" : ""} /> Save Period {lastNumber}
              </Button>
            )}
            <Button size="sm" onClick={() => save("current", `${BASE}/current`)} disabled={!!busy}>
              <RefreshCw className={busy === "current" ? "animate-spin" : ""} />
              {saved.get(current.number)?.isPartial ? "Update" : "Save"} {current.label} to date
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data ? null : !baseline ? (
        <BaselineSetup busy={busy} onSave={(endsAt) => save("baseline", `${BASE}/baseline`, { endsAt })} />
      ) : (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Saved reports</CardTitle>
            <CardDescription title={`Dates in ${tz} time. The running period can be saved as a preview.`}>
              Every {days} days from the Baseline ({formatDay(baseline.plannedEnd, tz)}). Finished periods are saved the
              day after they end and don&apos;t change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={LEFT}>Report</TableHead>
                  <TableHead className={LEFT}>Dates</TableHead>
                  <TableHead className={LEFT}>Status</TableHead>
                  <TableHead className={LEFT}>Verdict</TableHead>
                  <TableHead className={LEFT}>Saved</TableHead>
                  <TableHead className="px-3 text-right">Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow
                    key={r.number}
                    title={
                      r.samples
                        ? `${formatNumber(r.samples)} server samples (one every 5 min)`
                        : "No server samples: the server and database figures are empty. Endpoint figures come from request logs."
                    }
                  >
                    <TableCell className={`${LEFT} py-2.5 font-medium text-foreground`}>
                      {r.label}
                      {r.kind === "baseline" && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">reference</span>
                      )}
                    </TableCell>
                    <TableCell className={`${LEFT} tabular-nums text-muted-foreground`}>
                      {formatRange(r.periodStart, r.plannedEnd, tz)}
                      {!r.samples && <span className="block text-[11px]">No server samples</span>}
                    </TableCell>
                    <TableCell className={LEFT}>
                      {r.isPartial ? (
                        <Badge
                          variant="outline"
                          className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                          title={`Up to ${formatDateTime(r.periodEnd)}`}
                        >
                          To date
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium text-muted-foreground">
                          Final
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={LEFT}>{r.overall ? <VerdictBadge verdict={r.overall} /> : "—"}</TableCell>
                    <TableCell className={`${LEFT} text-xs text-muted-foreground`}>
                      {formatDateTime(r.updatedAt)}
                      {r.generatedBy && <span className="block">by {r.generatedBy}</span>}
                    </TableCell>
                    <TableCell className="px-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => download(r.number)} disabled={!!busy}>
                        <Download className={busy === `pdf:${r.number}` ? "animate-pulse" : ""} /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
