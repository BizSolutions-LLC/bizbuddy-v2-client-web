// components/system-admin/database/CleanupSection.jsx
//
// BB-110: cleanup PREVIEW — counts only. Nothing on this page deletes anything;
// cleanup runs separately through scripts a developer reviews.

"use client";

import { useEffect, useState } from "react";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, formatNumber } from "./shared";

const WINDOW_FIELDS = [
  { key: "requestLogDays", label: "Request logs", fallback: 90 },
  { key: "auditLogDays", label: "Audit logs", fallback: 730 },
  { key: "notificationDays", label: "Notifications", fallback: 365 },
  { key: "emailLogDays", label: "Email logs", fallback: 365 },
  { key: "activityDays", label: "Activity", fallback: 365 },
];

const MIN_DAYS = 1;
const MAX_DAYS = 3650;

const DEFAULT_WINDOWS = Object.fromEntries(WINDOW_FIELDS.map((f) => [f.key, String(f.fallback)]));

// Same 1–3650 limit the server applies
const clampDays = (value, fallback) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, MIN_DAYS), MAX_DAYS);
};

export default function CleanupSection({ section }) {
  const { data } = section;
  const [windows, setWindows] = useState(DEFAULT_WINDOWS);

  // Show the values the server actually used
  useEffect(() => {
    if (data?.windows) {
      setWindows(Object.fromEntries(WINDOW_FIELDS.map((f) => [f.key, String(data.windows[f.key] ?? f.fallback)])));
    }
  }, [data?.windows]);

  const recalculate = (e) => {
    e.preventDefault();
    const query = Object.fromEntries(WINDOW_FIELDS.map((f) => [f.key, clampDays(windows[f.key], f.fallback)]));
    section.reload(query);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Preview only. These numbers show what a cleanup would remove. Nothing is deleted from this page.</span>
      </div>

      <SectionCard
        title="Cleanup preview"
        description="How many rows each retention rule would remove, for the windows below."
        section={section}
      >
        <form onSubmit={recalculate} className="flex flex-wrap items-end gap-3 mb-6">
          {WINDOW_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5 w-32">
              <Label htmlFor={`window-${f.key}`} className="text-xs">
                {f.label} (days)
              </Label>
              <Input
                id={`window-${f.key}`}
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                value={windows[f.key]}
                onChange={(e) => setWindows((w) => ({ ...w, [f.key]: e.target.value }))}
                className="h-8"
              />
            </div>
          ))}
          <Button type="submit" size="sm" disabled={section.loading}>
            <RefreshCw className={section.loading ? "animate-spin" : ""} /> Recalculate
          </Button>
        </form>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Table</TableHead>
                <TableHead className="text-right">Rows that would be removed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.candidates || []).map((c) => (
                <TableRow key={c.key} className={c.rows === 0 ? "opacity-50" : ""}>
                  <TableCell className="text-sm">{c.rule}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{c.table}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(c.rows)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data?.legacyTables?.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Legacy tables</h3>
            <ul className="divide-y rounded-md border">
              {data.legacyTables.map((t) => (
                <li key={t.table} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono">{t.table}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatNumber(t.rows)} rows ·{" "}
                    {t.rows === 0 ? "Empty, can be dropped in a future schema cleanup." : "Has data, back up before dropping."}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 space-y-1 text-xs text-muted-foreground">
          <p>
            Payroll, timekeeping, leave and employee records are never part of cleanup. They&apos;re kept for legal
            record-keeping (generally 3–4+ years).
          </p>
          <p>B. Buddy and system-admin activity is the audit trail, so it&apos;s kept longer than ordinary request logs.</p>
        </div>
      </SectionCard>
    </div>
  );
}
