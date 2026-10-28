// components/system-admin/bbuddy/ActivityTab.jsx
//
// BB-110: everything done through B. Buddy accounts — filterable, paged,
// with a details panel for the selected request. Reloads when the page's
// Refresh is pressed (refreshKey), or Live polls page 1 while the browser tab
// is visible.

"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bbuddyFetch, startOfDayISO, endOfDayISO, daysAgoInput, toDateInput, formatDateTime } from "./api";
import { relativeTime } from "../shared";

const PAGE_SIZE = 50;
const LIVE_INTERVAL_MS = 15000;

const DEFAULT_FILTERS = {
  companyId: "all",
  agentId: "all",
  startDate: daysAgoInput(30),
  endDate: toDateInput(Date.now()),
  endpoint: "",
  writesOnly: false,
  failedOnly: false,
};

const statusClass = (code) =>
  code >= 500 ? "text-red-600" : code >= 400 ? "text-yellow-600" : "text-green-600";

export default function ActivityTab({ companies, agents, refreshKey }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [, setTick] = useState(0);

  // Nothing new can arrive when the range ends before today; paging away pauses Live
  const canLive = applied.endDate >= toDateInput(Date.now());
  const liveActive = live && canLive && page === 1;

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!liveActive) return;
    const poll = () => !document.hidden && refresh();
    const id = setInterval(poll, LIVE_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [liveActive]);

  // Keeps "Updated … ago" current
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const json = await bbuddyFetch("/activity", {
          query: {
            companyId: applied.companyId === "all" ? "" : applied.companyId,
            agentId: applied.agentId === "all" ? "" : applied.agentId,
            startDate: startOfDayISO(applied.startDate),
            endDate: endOfDayISO(applied.endDate),
            endpoint: applied.endpoint.trim(),
            writesOnly: applied.writesOnly ? "true" : "",
            failedOnly: applied.failedOnly ? "true" : "",
            page,
            limit: PAGE_SIZE,
          },
        });
        if (cancelled) return;
        const data = json.data || [];
        setRows(data);
        setPagination(json.pagination || null);
        setLastUpdated(new Date());
        // Keep the open request selected across refreshes
        setSelected((prev) => (prev ? data.find((r) => r.id === prev.id) || prev : prev));
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
  }, [applied, page, reloadKey, refreshKey]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const applyFilters = (e) => {
    e?.preventDefault();
    setSelected(null);
    setPage(1);
    setApplied({ ...filters });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSelected(null);
    setPage(1);
    setApplied(DEFAULT_FILTERS);
  };

  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={applyFilters} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={filters.companyId} onValueChange={(v) => setFilter("companyId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>
                      {c.companyName || c.companyId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Staff</Label>
              <Select value={filters.agentId} onValueChange={(v) => setFilter("agentId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.code}){a.archivedAt ? " · removed" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity-start">From</Label>
              <Input
                id="activity-start"
                type="date"
                value={filters.startDate}
                max={filters.endDate}
                onChange={(e) => setFilter("startDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity-end">To</Label>
              <Input
                id="activity-end"
                type="date"
                value={filters.endDate}
                min={filters.startDate}
                onChange={(e) => setFilter("endDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="activity-endpoint">Endpoint contains</Label>
              <Input
                id="activity-endpoint"
                placeholder="e.g. /api/leaves"
                value={filters.endpoint}
                onChange={(e) => setFilter("endpoint", e.target.value)}
              />
            </div>

            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={filters.writesOnly} onCheckedChange={(v) => setFilter("writesOnly", v === true)} />
                Writes only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={filters.failedOnly} onCheckedChange={(v) => setFilter("failedOnly", v === true)} />
                Failed only
              </label>
            </div>

            <div className="flex items-end justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table + details panel */}
      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Activity {pagination ? <span className="text-muted-foreground font-normal">· {pagination.total} requests</span> : null}
            </CardTitle>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="hidden sm:inline text-xs text-muted-foreground" title={formatDateTime(lastUpdated)}>
                  Updated {relativeTime(lastUpdated)}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={live}
                disabled={!canLive}
                title={
                  !canLive
                    ? "Live needs a date range that includes today"
                    : live && page !== 1
                    ? "Live pauses off page 1"
                    : `Refresh every ${LIVE_INTERVAL_MS / 1000}s`
                }
                onClick={() => setLive((v) => !v)}
              >
                <span className={`h-2 w-2 rounded-full ${liveActive ? "bg-green-600" : "bg-muted-foreground/40"}`} />
                Live
              </Button>
              {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && !loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No B. Buddy activity for these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`cursor-pointer ${selected?.id === r.id ? "bg-muted" : ""}`}
                        >
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(r.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {r.isWrite && <Badge variant="outline" className="text-[10px]">{r.method}</Badge>}
                              <span className="text-sm">{r.action}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{r.company?.name || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {r.agent ? `${r.agent.name} (${r.agent.code})` : <span className="text-muted-foreground">Unidentified</span>}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${statusClass(r.statusCode)}`}>
                            {r.statusCode}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-muted-foreground">
                Page {pagination?.page || page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Request Details</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{formatDateTime(selected.createdAt)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Close details">
                <X />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Action" value={selected.action} />
              <DetailRow label="Company" value={selected.company?.name} />
              <DetailRow
                label="Staff"
                value={selected.agent ? `${selected.agent.name} (${selected.agent.code})` : "Unidentified"}
              />
              <DetailRow label="Request" value={`${selected.method} ${selected.url || selected.endpoint}`} mono />
              <DetailRow
                label="Status"
                value={`${selected.statusCode}${selected.responseTime != null ? ` · ${selected.responseTime} ms` : ""}`}
              />
              {selected.errorMessage && <DetailRow label="Error" value={selected.errorMessage} />}
              <DetailRow label="IP address" value={selected.ipAddress} mono />
              <DetailRow label="User agent" value={selected.userAgent} />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Request body</p>
                <pre className="max-h-64 overflow-auto rounded-md border bg-muted p-2 text-xs whitespace-pre-wrap break-all">
                  {selected.requestBody ? JSON.stringify(selected.requestBody, null, 2) : "—"}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`break-all ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
    </div>
  );
}
