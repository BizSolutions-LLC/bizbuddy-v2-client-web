// app/system-admin/emails/page.jsx
//
// BB-140: Emails — every email the server sends (welcome, password reset / changed,
// deletion code, missed clock-in/out, auto clock-out, reports, corrections, tests).
// GET /api/system-admin/emails (filters, summary, paged items), a detail drawer
// (/emails/:id: the email as sent, sensitive parts hidden, image check) and a test send
// (/emails/test). Dates are UTC days, last 7 by default, at most 92. "Sent" = the mail
// server accepted it; inbox delivery and bounces aren't tracked.
// Kept 1 year (summary row) / 90 days (copy of the email). Nothing is stored in the browser
// except the last test address (see SendTestDialog).

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Send } from "lucide-react";
import { Toaster } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { useSystemAdminSection, useCompanyOptions, formatDateTime, formatDay, formatNumber } from "@/components/system-admin/shared";
import EmailDetailSheet from "@/components/system-admin/emails/EmailDetailSheet";
import SendTestDialog from "@/components/system-admin/emails/SendTestDialog";
import { StatusBadge, typeLabel } from "@/components/system-admin/emails/format";

const PAGE_SIZE = 50;
const ANY = "any";
const MAX_RANGE_DAYS = 92;

// UTC "YYYY-MM-DD", `daysAgo` days before today (the server's days are UTC)
const utcDay = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const dayCount = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 + 1;

const defaultFilters = () => ({
  from: utcDay(6),
  to: utcDay(0),
  companyId: "",
  type: "",
  status: "",
  isTest: "", // "" = include tests, "false" = leave them out
  q: "",
});

// Chart look, same tokens as the Overview's sign-ins chart
const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const GRID = "hsl(var(--border))";
const CHART_TOOLTIP = {
  contentStyle: { borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 },
  labelFormatter: formatDay,
};

export default function EmailsPage() {
  const companies = useCompanyOptions();
  const [form, setForm] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [testOpen, setTestOpen] = useState(false);
  const [templates, setTemplates] = useState(null);
  const [templatesError, setTemplatesError] = useState("");

  const section = useSystemAdminSection("/api/system-admin/emails", { ...applied, page, pageSize: PAGE_SIZE });
  const data = section.data;
  const summary = data?.summary;
  const items = data?.items || [];
  const pages = data?.pages || 1;

  // Template labels for the type column and the test form
  useEffect(() => {
    systemAdminFetch("/api/system-admin/emails/templates")
      .then((json) => setTemplates(json.data?.templates || []))
      .catch((err) => { setTemplates([]); setTemplatesError(err.message); });
  }, []);

  const setField = (key, value) => { setForm((f) => ({ ...f, [key]: value })); setFormError(""); };

  const apply = (next = form) => {
    if (!next.from || !next.to) { setFormError("Pick both dates."); return; }
    if (next.from > next.to) { setFormError("The start date is after the end date."); return; }
    if (dayCount(next.from, next.to) > MAX_RANGE_DAYS) { setFormError(`Pick ${MAX_RANGE_DAYS} days or fewer.`); return; }
    setFormError("");
    setPage(1);
    setApplied({ ...next, q: next.q.trim() });
  };

  const reset = () => {
    const d = defaultFilters();
    setForm(d);
    apply(d);
  };

  // Types in range (summary.byType), plus the selected one even if it has no rows now
  const typeOptions = [...(summary?.byType || [])];
  if (form.type && !typeOptions.some((t) => t.type === form.type)) typeOptions.push({ type: form.type, count: 0 });

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Toaster position="top-right" richColors />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Emails</h1>
          <p className="text-sm text-neutral-600">
            Every email the server sends. &quot;Sent&quot; means the mail server accepted it; inbox delivery and bounces
            aren&apos;t tracked.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => section.reload()} disabled={section.loading}>
            <RefreshCw className={section.loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setTestOpen(true)}>
            <Send /> Send test email
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); apply(); }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="em-from">From (UTC)</Label>
              <Input id="em-from" type="date" value={form.from} max={form.to || undefined} onChange={(e) => setField("from", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em-to">To (UTC)</Label>
              <Input id="em-to" type="date" value={form.to} min={form.from || undefined} onChange={(e) => setField("to", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={form.companyId || ANY} onValueChange={(v) => setField("companyId", v === ANY ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.companyId} value={c.companyId}>{c.companyName || c.companyId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type || ANY} onValueChange={(v) => setField("type", v === ANY ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {typeLabel(t.type, templates)} ({formatNumber(t.count)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || ANY} onValueChange={(v) => setField("status", v === ANY ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Sent and failed</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="em-q">Search recipient or subject</Label>
              <Input id="em-q" value={form.q} onChange={(e) => setField("q", e.target.value)} placeholder="jane@client.com, Welcome…" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.isTest !== "false"} onCheckedChange={(v) => setField("isTest", v === true ? "" : "false")} />
                Include tests
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={reset}>Reset</Button>
                <Button type="submit">Apply</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary + per-day chart */}
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="pt-6 grid grid-cols-3 lg:grid-cols-1 gap-4">
            <SummaryNumber label="Total" value={summary?.total} loading={section.loading && !summary} />
            <SummaryNumber label="Sent" value={summary?.sent} className="text-green-600" loading={section.loading && !summary} />
            <SummaryNumber
              label="Failed"
              value={summary?.failed}
              className={summary?.failed > 0 ? "text-red-600" : ""}
              loading={section.loading && !summary}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Per day (UTC)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {summary?.byDay?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byDay} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="day" tickFormatter={formatDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                    <ChartTooltip {...CHART_TOOLTIP} cursor={{ fill: "hsl(var(--muted))" }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sent" name="Sent" stackId="emails" fill="hsl(var(--chart-2))" />
                    <Bar dataKey="failed" name="Failed" stackId="emails" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  {section.loading ? "Loading…" : "No emails in this range."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Emails
            {data && <span className="ml-2 text-sm font-normal text-muted-foreground">{formatNumber(summary?.total ?? items.length)}</span>}
          </CardTitle>
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
                    <TableHead>Type</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right"><span className="sr-only">Preview</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && !section.loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No emails match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => setOpenId(r.id)}
                        className={`cursor-pointer ${openId === r.id ? "bg-muted" : ""}`}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.sentAt)}</TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {typeLabel(r.type, templates)}
                            {r.isTest && <Badge variant="outline" className="text-[10px]">TEST</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm break-all">{r.to || "—"}</TableCell>
                        <TableCell className="text-sm">{r.company?.name || "—"}</TableCell>
                        <TableCell className="text-sm max-w-[22rem] truncate" title={r.subject || ""}>{r.subject || "—"}</TableCell>
                        <TableCell><StatusBadge status={r.status} error={r.errorMessage} /></TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={r.copy !== "available"}
                            title={r.copy === "available" ? "Preview" : r.copy === "expired" ? "Preview deleted after 90 days" : "No preview kept"}
                            aria-label="Preview"
                            onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}
                          >
                            <Eye />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages}
              {data?.retention && <> · emails kept {data.retention.summaryDays} days, previews {data.retention.copyDays} days</>}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || section.loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages || section.loading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EmailDetailSheet emailId={openId} templates={templates} onOpenChange={(v) => { if (!v) setOpenId(null); }} />

      <SendTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        templates={templates}
        templatesError={templatesError}
        onSent={() => {
          // The new test is newest, so show page 1
          if (page === 1) section.reload();
          else setPage(1);
        }}
      />
    </div>
  );
}

function SummaryNumber({ label, value, className = "", loading }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${className}`}>{loading ? "…" : formatNumber(value ?? 0)}</p>
    </div>
  );
}
