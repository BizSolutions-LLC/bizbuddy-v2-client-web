// components/system-admin/bbuddy/SummaryTab.jsx
//
// BB-110: B. Buddy usage per company and per staff member (default last 7 days).

"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bbuddyFetch, startOfDayISO, endOfDayISO, daysAgoInput, toDateInput, formatDateTime } from "./api";

const DEFAULT_RANGE = { startDate: daysAgoInput(7), endDate: toDateInput(Date.now()) };

export default function SummaryTab({ refreshKey }) {
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [applied, setApplied] = useState(DEFAULT_RANGE);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const json = await bbuddyFetch("/summary", {
          query: { startDate: startOfDayISO(applied.startDate), endDate: endOfDayISO(applied.endDate) },
        });
        if (!cancelled) setData(json.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [applied, refreshKey]);

  const stats = [
    { label: "Requests", value: data?.totals?.requests ?? 0, className: "text-blue-600" },
    { label: "Writes", value: data?.totals?.writes ?? 0, className: "text-orange-600" },
    { label: "Failed sign-ins", value: data?.totals?.failedLogins ?? 0, className: "text-red-600" },
    { label: "Active staff", value: (data?.byAgent || []).filter((a) => a.id).length, className: "text-green-600" },
  ];

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ ...range });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="summary-start">From</Label>
          <Input
            id="summary-start"
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange((p) => ({ ...p, startDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary-end">To</Label>
          <Input
            id="summary-end"
            type="date"
            value={range.endDate}
            min={range.startDate}
            onChange={(e) => setRange((p) => ({ ...p, endDate: e.target.value }))}
          />
        </div>
        <Button type="submit">Apply</Button>
        {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground mb-2.5" />}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.className}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryTable
          title="By company"
          firstColumn="Company"
          rows={data?.byCompany || []}
          renderName={(r) => r.companyName || "Unknown company"}
        />
        <SummaryTable
          title="By staff member"
          firstColumn="Staff"
          rows={data?.byAgent || []}
          renderName={(r) =>
            r.id ? `${r.name || "Unknown"} (${r.code || "?"})` : <span className="text-muted-foreground">Unidentified (failed sign-ins)</span>
          }
        />
      </div>
    </div>
  );
}

function SummaryTable({ title, firstColumn, rows, renderName }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{firstColumn}</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Writes</TableHead>
              <TableHead className="text-right">Reads</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No activity in this range.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id ?? "none"}>
                  <TableCell className="text-sm">{renderName(r)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.total}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.writes}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{r.reads}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(r.lastActivityAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
