// app/system-admin/requests/page.jsx
//
// BB-112: Request Logs — raw request log with filters, opened from the Security
// Monitor's "View requests" (filters arrive in the URL). GET /api/system-admin/requests.

"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSystemAdminSection, useCompanyOptions, formatDateTime } from "@/components/system-admin/shared";

const PAGE_SIZE = 50;
const ANY = "any";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

// Params the server's /requests understands
const FILTER_KEYS = ["endpoint", "method", "statusCode", "isFailed", "companyId", "userId", "systemAdminId", "startDate", "endDate"];

// Filters with no control of their own, shown as removable chips
const CHIP_LABELS = { userId: "User", systemAdminId: "System admin" };

const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startOfDayISO = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
const endOfDayISO = (d) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

const statusClass = (code) => (code >= 500 ? "text-red-600" : code >= 400 ? "text-amber-600" : "text-green-600");

export default function RequestLogsPage() {
  return (
    <Suspense fallback={null}>
      <RequestLogs />
    </Suspense>
  );
}

function RequestLogs() {
  const searchParams = useSearchParams();
  const companies = useCompanyOptions();

  const initial = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) || ""]));
  const [form, setForm] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const section = useSystemAdminSection("/api/system-admin/requests", { ...applied, page, limit: PAGE_SIZE });
  const rows = section.data || [];
  // /requests may not send pagination yet; a full page means there may be more
  const hasNext = rows.length === PAGE_SIZE;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const apply = (next = form) => {
    setSelected(null);
    setPage(1);
    setApplied({ ...next });
  };

  const removeChip = (key) => {
    const next = { ...form, [key]: "" };
    setForm(next);
    apply(next);
  };

  const reset = () => {
    const empty = Object.fromEntries(FILTER_KEYS.map((k) => [k, ""]));
    setForm(empty);
    apply(empty);
  };

  const chips = Object.keys(CHIP_LABELS).filter((k) => applied[k]);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Request Logs</h1>
          <p className="text-sm text-neutral-600">Every API request, newest first.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => section.reload()} disabled={section.loading}>
          <RefreshCw className={section.loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="req-endpoint">Endpoint contains</Label>
              <Input id="req-endpoint" value={form.endpoint} onChange={(e) => setField("endpoint", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={form.method || ANY} onValueChange={(v) => setField("method", v === ANY ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any method</SelectItem>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-status">Status code</Label>
              <Input
                id="req-status"
                inputMode="numeric"
                value={form.statusCode}
                onChange={(e) => setField("statusCode", e.target.value.replace(/\D/g, "").slice(0, 3))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={form.companyId || ANY} onValueChange={(v) => setField("companyId", v === ANY ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>
                      {c.companyName || c.companyId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-from">From</Label>
              <Input
                id="req-from"
                type="date"
                value={toDateInput(form.startDate)}
                onChange={(e) => setField("startDate", startOfDayISO(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-to">To</Label>
              <Input
                id="req-to"
                type="date"
                value={toDateInput(form.endDate)}
                onChange={(e) => setField("endDate", endOfDayISO(e.target.value))}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.isFailed === "true"}
                  onCheckedChange={(v) => setField("isFailed", v === true ? "true" : "")}
                />
                Failed only
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
              {chips.map((k) => (
                <Badge key={k} variant="secondary" className="gap-1 font-normal">
                  {CHIP_LABELS[k]}: <span className="font-mono">{applied[k]}</span>
                  <button type="button" onClick={() => removeChip(k)} aria-label={`Remove ${CHIP_LABELS[k]} filter`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={reset}>
                  Reset
                </Button>
                <Button type="submit">Apply</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table + details panel */}
      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Requests</CardTitle>
            {section.loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            {section.error ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{section.error}</p>
                <Button size="sm" variant="outline" onClick={() => section.reload()}>
                  <RefreshCw /> Retry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead>Who</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && !section.loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                          No requests match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`cursor-pointer ${selected?.id === r.id ? "bg-muted" : ""}`}
                        >
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={WRITE_METHODS.includes(r.method) ? "outline" : "secondary"}
                                className="text-[10px]"
                              >
                                {r.method}
                              </Badge>
                              <span className="font-mono text-xs break-all">{r.endpoint || r.url}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{whoOf(r)}</TableCell>
                          <TableCell className="text-sm">{r.company?.name || "—"}</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${statusClass(r.statusCode)}`}>{r.statusCode}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-muted-foreground">Page {page}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || section.loading} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={!hasNext || section.loading} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card className="h-fit lg:sticky lg:top-20">
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
              <DetailRow label="Request" value={`${selected.method} ${selected.url || selected.endpoint}`} mono />
              <DetailRow
                label="Status"
                value={`${selected.statusCode}${selected.responseTime != null ? ` · ${selected.responseTime} ms` : ""}`}
              />
              {selected.errorMessage && <DetailRow label="Error" value={selected.errorMessage} />}
              <DetailRow label="Who" value={whoOf(selected)} />
              <DetailRow label="Company" value={selected.company?.name} />
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

// User email, system admin, or "—"
function whoOf(r) {
  if (r.systemAdmin) return `${r.systemAdmin.name || r.systemAdmin.username} (system admin)`;
  if (r.user) return r.user.email || r.user.username;
  return "—";
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`break-all ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</p>
    </div>
  );
}
