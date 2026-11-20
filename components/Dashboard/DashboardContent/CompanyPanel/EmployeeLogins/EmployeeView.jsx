"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EventsTable from "./EventsTable";
import { FLAGS, PlatformIcon, fmtWhen, loginsGet, sharedWithText, shortId } from "./shared";

const MAX_DAYS = 92;
const dayCount = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 + 1;

export default function EmployeeView({ token, userId, timeZone, onOpenEmployee }) {
  const [range, setRange] = useState({ from: "", to: "" }); // "" = server default (last 30 days)
  const [form, setForm] = useState({ from: "", to: "" });
  const [rangeError, setRangeError] = useState("");
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loginsGet(token, `/employees/${encodeURIComponent(userId)}`, range);
      setState({ loading: false, error: "", data });
      if (!range.from && data?.filters) setForm({ from: data.filters.from || "", to: data.filters.to || "" });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [token, userId, range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setRange({ from: "", to: "" }); setForm({ from: "", to: "" }); }, [userId]);

  const applyRange = (e) => {
    e.preventDefault();
    if (!form.from || !form.to) { setRangeError("Pick both dates."); return; }
    if (form.from > form.to) { setRangeError("The start date is after the end date."); return; }
    if (dayCount(form.from, form.to) > MAX_DAYS) { setRangeError(`Pick ${MAX_DAYS} days or fewer.`); return; }
    setRangeError("");
    setRange({ ...form });
  };

  const d = state.data;
  const emp = d?.employee;
  const s = d?.summary || {};
  const tz = d?.timeZone || timeZone;

  if (state.loading && !d) {
    return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (state.error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
        <p className="text-sm text-red-700">{state.error}</p>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw /> Retry</Button>
      </div>
    );
  }
  if (!d) return null;

  return (
    <div className="space-y-5">
      {/* Header + range */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{emp?.name || "Employee"}</p>
            <p className="text-sm text-muted-foreground">
              {[emp?.department, emp?.status].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              Registered phone: <span className="font-mono">{emp?.registeredDeviceId ? shortId(emp.registeredDeviceId) : "none"}</span>
              {" · "}Last sign-in: {fmtWhen(emp?.lastLoginAt, tz)}
            </p>
          </div>
          <form onSubmit={applyRange} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="el-p-from" className="text-xs">From</Label>
              <Input id="el-p-from" type="date" className="h-9 w-40" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="el-p-to" className="text-xs">To</Label>
              <Input id="el-p-to" type="date" className="h-9 w-40" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" className="h-9">Apply</Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={load} aria-label="Refresh" disabled={state.loading}>
              <RefreshCw className={state.loading ? "animate-spin" : ""} />
            </Button>
            {rangeError && <p className="w-full text-xs text-red-600">{rangeError}</p>}
          </form>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <Stat label="Sign-ins" value={s.signIns} />
        <Stat label="Failed" value={s.failed} danger={s.failed > 0} />
        <Stat label="Devices" value={s.devices} />
        <Stat label="Punches from another device" value={s.foreignDevicePunches} danger={s.foreignDevicePunches > 0} />
        {FLAGS.map((f) => (
          <Stat key={f.key} label={f.title} value={s.flagged?.[f.key] ?? s[f.key]} danger={(f.key === "sharedDevice" || f.key === "failedBurst") && (s.flagged?.[f.key] ?? s[f.key]) > 0} />
        ))}
      </div>

      {/* Devices */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Phones and browsers</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Device</TableHead>
                <TableHead className="text-left">Platform</TableHead>
                <TableHead className="text-left">First seen</TableHead>
                <TableHead className="text-left">Last seen</TableHead>
                <TableHead className="text-right">Sign-ins</TableHead>
                <TableHead className="text-left">Also used by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(d.devices || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No devices recorded.</TableCell></TableRow>
              ) : (
                d.devices.map((dev) => {
                  const shared = sharedWithText(dev.alsoUsedBy);
                  return (
                    <TableRow key={`${dev.kind}-${dev.id}`}>
                      <TableCell className="text-left">
                        <span className="font-mono text-xs" title={dev.id || ""}>{shortId(dev.id)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{dev.kind === "device" ? "phone" : dev.kind}</span>
                        {dev.isRegisteredPhone && <Badge variant="outline" className="ml-2 text-[10px]">Registered phone</Badge>}
                      </TableCell>
                      <TableCell className="text-left"><PlatformIcon platform={dev.platform} /></TableCell>
                      <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">{fmtWhen(dev.firstSeen, tz)}</TableCell>
                      <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">{fmtWhen(dev.lastSeen, tz)}</TableCell>
                      <TableCell className="text-right">{dev.signIns ?? "—"}</TableCell>
                      <TableCell className={`text-left text-sm ${shared ? "text-red-600" : "text-muted-foreground"}`}>
                        {shared ? <SharedNames alsoUsedBy={dev.alsoUsedBy} onOpenEmployee={onOpenEmployee} /> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Punches from another device */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Punches from another device</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {(d.foreignDevicePunches || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {d.punchProofNote || "No punches from another device in this range."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Time</TableHead>
                  <TableHead className="text-left">Punch</TableHead>
                  <TableHead className="text-left">Device used</TableHead>
                  <TableHead className="text-left">Their phone</TableHead>
                  <TableHead className="text-left">Device also used by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.foreignDevicePunches.map((p) => (
                  <TableRow key={`${p.timeLogId}-${p.punch}`}>
                    <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">{p.atLocal || fmtWhen(p.at, tz)}</TableCell>
                    <TableCell className="text-left text-sm">{p.punch === "clock-out" ? "Clock-out" : "Clock-in"}</TableCell>
                    <TableCell className="text-left font-mono text-xs" title={p.deviceId || ""}>{shortId(p.deviceId)}</TableCell>
                    <TableCell className="text-left font-mono text-xs" title={p.registeredDeviceId || ""}>{shortId(p.registeredDeviceId)}</TableCell>
                    <TableCell className="text-left text-sm">
                      {sharedWithText(p.deviceAlsoUsedBy)
                        ? <SharedNames alsoUsedBy={p.deviceAlsoUsedBy} onOpenEmployee={onOpenEmployee} />
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Sign-ins and sign-outs</CardTitle></CardHeader>
        <CardContent>
          <EventsTable items={d.events} loading={state.loading} showEmployee={false} emptyText="No sign-ins in this range." />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, danger = false }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className={`text-xl font-semibold ${danger ? "text-red-600" : ""}`}>{value ?? 0}</p>
      </CardContent>
    </Card>
  );
}

// Names open that person's view; other-company accounts are only counted
function SharedNames({ alsoUsedBy, onOpenEmployee }) {
  const people = alsoUsedBy?.sameCompany || [];
  const other = alsoUsedBy?.otherCompanyAccounts || 0;
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
      {people.map((p) => (
        <button key={p.userId} type="button" className="hover:underline" onClick={() => onOpenEmployee?.(p.userId)}>
          {p.name}
        </button>
      ))}
      {other > 0 && <span>{other} account{other === 1 ? "" : "s"} in another company</span>}
    </span>
  );
}
