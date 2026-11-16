/* components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeTaskReports.jsx */
"use client";

// BB-129: Employee Report — submitted Daily Task Reports, read-only.
// Supervisors see their department + direct reports, admins the whole company (the server
// decides). Drafts never show here. Left: list; right: the selected report, closed explicitly.
// The page shows only while Configurations → Trial Features → Clock-out documentation is on.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, X, ExternalLink, Download, Loader2, Search } from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  MAX_RANGE_DAYS, fetchTaskReportEnabled, listTeamReports, getTeamReport, teamReportPdfPath,
  fmtTimeInZone, fmtDateTimeInZone, fmtReportDate,
} from "@/lib/taskReportsApi";
import { downloadServerReport, openServerReport } from "@/lib/reportDownload";

const ALL = "all";
const dayDiff = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

export default function EmployeeTaskReports() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [enabled, setEnabled] = useState(null); // null = checking
  const [range, setRange] = useState({ from: "", to: "" }); // filled from the server's default (last 30 days, company zone)
  const [pending, setPending] = useState({ from: "", to: "" });
  const [list, setList] = useState(null);       // /team data
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [department, setDepartment] = useState(ALL);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(null);

  // ── Setting ──
  useEffect(() => {
    if (!token) return;
    fetchTaskReportEnabled(API, token).then(setEnabled).catch(() => setEnabled(false));
  }, [token, API]);

  // ── List ──
  const loadList = useCallback(async (r) => {
    setLoading(true); setListError(null);
    try {
      const data = await listTeamReports(API, token, r || {});
      setList(data);
      const applied = { from: data.from, to: data.to };
      setRange(applied); setPending(applied);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    if (token && enabled) loadList(null);
  }, [token, enabled, loadList]);

  const rangeError = !pending.from || !pending.to
    ? "Pick both dates."
    : pending.from > pending.to
      ? "The start date must be on or before the end date."
      : dayDiff(pending.from, pending.to) > MAX_RANGE_DAYS
        ? `The range can be at most ${MAX_RANGE_DAYS} days.`
        : null;
  const rangeDirty = pending.from !== range.from || pending.to !== range.to;

  // ── Client-side filters over the loaded list ──
  const reports = list?.reports || [];
  const departments = useMemo(
    () => [...new Set(reports.map((r) => r.employee?.department).filter(Boolean))].sort(),
    [reports]
  );
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) =>
      (department === ALL || r.employee?.department === department) &&
      (!q || `${r.employee?.name || ""} ${r.employee?.employeeId || ""}`.toLowerCase().includes(q))
    );
  }, [reports, department, search]);
  const tz = list?.timeZone;

  // ── Detail ──
  useEffect(() => {
    if (!selectedId || !token) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setDetailError(null); setDetail(null);
    getTeamReport(API, token, selectedId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(e.message); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, token, API]);

  const pdf = async (mode) => {
    if (!selectedId) return;
    setPdfBusy(mode);
    try {
      if (mode === "view") await openServerReport({ apiUrl: API, token, path: teamReportPdfPath(selectedId) });
      else await downloadServerReport({ apiUrl: API, token, path: teamReportPdfPath(selectedId), fallbackFilename: "DailyTaskReport.pdf" });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPdfBusy(null);
    }
  };

  // ── Render ──
  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-orange-500" />
          Employee Report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily task reports your employees submitted. Read only.
          {tz && <> Times are in the company time zone ({tz}).</>}
        </p>
      </div>
      {enabled && (
        <Button variant="outline" onClick={() => loadList(rangeError ? range : pending)} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      )}
    </div>
  );

  if (enabled === null) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
        {header}
        <Card>
          <CardContent className="py-10 text-center space-y-1">
            <p className="font-medium">Clock-out documentation is turned off.</p>
            <p className="text-sm text-muted-foreground">
              An admin can turn it on in Configurations → Trial Features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <Toaster position="top-center" />
      {header}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="tr-from" className="text-xs">From</Label>
              <Input id="tr-from" type="date" value={pending.from} max={pending.to || undefined}
                onChange={(e) => setPending((p) => ({ ...p, from: e.target.value }))} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tr-to" className="text-xs">To</Label>
              <Input id="tr-to" type="date" value={pending.to} min={pending.from || undefined}
                onChange={(e) => setPending((p) => ({ ...p, to: e.target.value }))} className="w-40" />
            </div>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => loadList(pending)}
              disabled={loading || Boolean(rangeError) || !rangeDirty}
            >
              Apply
            </Button>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[12rem]">
              <Label htmlFor="tr-search" className="text-xs">Employee</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="tr-search" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or employee ID" className="pl-8" />
              </div>
            </div>
          </div>
          {rangeError && rangeDirty && <p className="text-xs text-destructive mt-2">{rangeError}</p>}
        </CardContent>
      </Card>

      <div className={`grid gap-5 ${selectedId ? "lg:grid-cols-[minmax(0,1fr)_26rem]" : ""}`}>
        {/* List */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Submitted reports
              {list && <span className="ml-2 text-sm font-normal text-muted-foreground">{shown.length} of {reports.length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !list ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : listError ? (
              <p className="text-sm text-destructive">{listError}</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {reports.length ? "No reports match these filters." : "No submitted reports in this date range."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="text-center">Tasks</TableHead>
                      <TableHead className="hidden sm:table-cell">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        aria-selected={selectedId === r.id}
                        className={`cursor-pointer ${selectedId === r.id ? "bg-muted/60" : "hover:bg-muted/40"}`}
                      >
                        <TableCell className="whitespace-nowrap">{fmtReportDate(r.reportDate)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.employee?.name}</div>
                          {r.employee?.employeeId && <div className="text-xs text-muted-foreground">{r.employee.employeeId}</div>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{r.employee?.department || "—"}</TableCell>
                        <TableCell className="text-center">{r.taskCount}</TableCell>
                        <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                          {fmtDateTimeInZone(r.submittedAt, tz)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selectedId && (
          <Card className="min-w-0 lg:sticky lg:top-4 self-start">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{detail?.employee?.name || "Report"}</CardTitle>
                {detail && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[detail.employee?.jobTitle, detail.employee?.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" aria-label="Close report" onClick={() => setSelectedId(null)}>
                <X />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {detailLoading ? (
                <div className="space-y-2"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></div>
              ) : detailError ? (
                <p className="text-sm text-destructive">{detailError}</p>
              ) : detail ? (
                <>
                  <div className="text-sm">
                    <p className="font-medium">{fmtReportDate(detail.reportDate)}</p>
                    <p className="text-xs text-muted-foreground">Submitted {fmtDateTimeInZone(detail.submittedAt, detail.timeZone)}</p>
                  </div>

                  {detail.attendance && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Clock in</dt>
                        <dd>{fmtTimeInZone(detail.attendance.clockIn, detail.timeZone)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Clock out</dt>
                        <dd>{detail.attendance.stillClockedIn ? "Still clocked in" : fmtTimeInZone(detail.attendance.clockOut, detail.timeZone)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Shift</dt>
                        <dd>
                          {detail.attendance.shift
                            ? `${detail.attendance.shift.name ? `${detail.attendance.shift.name}, ` : ""}${detail.attendance.shift.start}–${detail.attendance.shift.end}`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Punches</dt>
                        <dd>{detail.attendance.punchCount}</dd>
                      </div>
                    </dl>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => pdf("view")} disabled={Boolean(pdfBusy)}>
                      {pdfBusy === "view" ? <Loader2 className="animate-spin" /> : <ExternalLink />} View PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => pdf("download")} disabled={Boolean(pdfBusy)}>
                      {pdfBusy === "download" ? <Loader2 className="animate-spin" /> : <Download />} Download
                    </Button>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {detail.tasks?.length || 0} task{detail.tasks?.length === 1 ? "" : "s"}
                    </p>
                    <ol className="space-y-3">
                      {(detail.tasks || []).map((t, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-medium"><span className="text-muted-foreground mr-1.5">{i + 1}.</span>{t.title}</p>
                          {t.note && <p className="text-muted-foreground whitespace-pre-wrap mt-0.5 pl-5">{t.note}</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
