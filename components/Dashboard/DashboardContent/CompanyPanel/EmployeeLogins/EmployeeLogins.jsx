"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, RefreshCw } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EventsTable from "./EventsTable";
import EmployeeView from "./EmployeeView";
import { FLAGS, OUTCOME_LABEL, PlatformIcon, employeeName, fmtWhen, loginsGet, shortId } from "./shared";

const ANY = "any";
const PAGE_SIZE = 50;
const MAX_DAYS = 92;
const dayCount = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000 + 1;

const TABS = [
  { id: "all", label: "All logins" },
  { id: "shared", label: "Shared devices" },
  { id: "employee", label: "By employee" },
];

const EMPTY = { from: "", to: "", userId: "", departmentId: "", platform: "", event: "", outcome: "", flag: "", q: "" };

export default function EmployeeLogins() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [tab, setTab] = useState("all");
  const [personId, setPersonId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // ── All logins ──
  const [form, setForm] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY); // "" dates = server default (last 7 days)
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState({ loading: true, error: "", data: null });

  // Pickers
  useEffect(() => {
    if (!token) return;
    const h = { headers: { Authorization: `Bearer ${token}` } };
    Promise.all([
      fetch(`${API}/api/employee?all=1`, h).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/departments`, h).then((r) => r.json()).catch(() => null),
    ]).then(([e, d]) => {
      setEmployees((e?.data || []).slice().sort((a, b) => employeeName(a).localeCompare(employeeName(b))));
      setDepartments(d?.data || []);
    });
  }, [token, API]);

  const loadList = useCallback(async () => {
    if (!token) return;
    setList((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loginsGet(token, "", { ...applied, page, pageSize: PAGE_SIZE });
      setList({ loading: false, error: "", data });
      // Show the server's default range in the date inputs
      if (!applied.from && data?.filters) {
        setForm((f) => (f.from ? f : { ...f, from: data.filters.from || "", to: data.filters.to || "" }));
      }
    } catch (e) {
      setList({ loading: false, error: e.message, data: null });
    }
  }, [token, applied, page]);

  useEffect(() => { if (tab === "all") loadList(); }, [loadList, tab]);

  const setField = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormError(""); };

  const apply = (next = form) => {
    if ((next.from && !next.to) || (!next.from && next.to)) { setFormError("Pick both dates."); return; }
    if (next.from && next.from > next.to) { setFormError("The start date is after the end date."); return; }
    if (next.from && dayCount(next.from, next.to) > MAX_DAYS) { setFormError(`Pick ${MAX_DAYS} days or fewer.`); return; }
    setFormError("");
    setPage(1);
    setApplied({ ...next, q: next.q.trim() });
  };

  const reset = () => { setForm(EMPTY); apply(EMPTY); };

  // Summary card click = quick filter (click again to clear)
  const quickFilter = (patch) => {
    const active = Object.entries(patch).every(([k, v]) => applied[k] === v);
    const next = { ...form, ...(active ? Object.fromEntries(Object.keys(patch).map((k) => [k, ""])) : patch) };
    setForm(next);
    apply(next);
  };

  const openEmployee = (id) => { if (!id) return; setPersonId(id); setTab("employee"); };

  const data = list.data;
  const summary = data?.summary;
  const tz = data?.timeZone;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <KeyRound className="h-6 w-6 text-orange-500" />
          Employee Logins
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign-ins and sign-outs on mobile and web. Flags are warnings only; nothing is blocked.
          {tz && <> Times are in the company time zone ({tz}).</>}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b" role="tablist" aria-label="Views">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-sm ${
                tab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "all" && (
        <>
          {/* Summary cards (click = filter) */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="Sign-ins" value={summary?.signIns} loading={!summary && list.loading}
              active={!applied.outcome && !applied.flag} onClick={() => quickFilter({ outcome: "", flag: "" })} />
            <SummaryCard label="Failed" value={summary?.failed} loading={!summary && list.loading} danger={summary?.failed > 0}
              active={applied.outcome === "failed"} onClick={() => quickFilter({ outcome: "failed" })} />
            {FLAGS.map((f) => (
              <SummaryCard
                key={f.key}
                label={f.title}
                hint={f.help}
                value={summary?.flagged?.[f.key]}
                loading={!summary && list.loading}
                danger={(f.key === "sharedDevice" || f.key === "failedBurst") && summary?.flagged?.[f.key] > 0}
                active={applied.flag === f.key}
                onClick={() => quickFilter({ flag: f.key })}
              />
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="el-from">From</Label>
                  <Input id="el-from" type="date" value={form.from} onChange={(e) => setField("from", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="el-to">To</Label>
                  <Input id="el-to" type="date" value={form.to} onChange={(e) => setField("to", e.target.value)} />
                </div>
                <PickerSelect label="Employee" value={form.userId} onChange={(v) => setField("userId", v)} allLabel="All employees"
                  options={employees.map((e) => ({ value: e.id, label: employeeName(e) }))} />
                <PickerSelect label="Department" value={form.departmentId} onChange={(v) => setField("departmentId", v)} allLabel="All departments"
                  options={departments.map((d) => ({ value: d.id, label: d.name }))} />
                <PickerSelect label="Platform" value={form.platform} onChange={(v) => setField("platform", v)} allLabel="All platforms"
                  options={[{ value: "mobile", label: "Mobile" }, { value: "web", label: "Web" }, { value: "other", label: "Other" }]} />
                <PickerSelect label="Event" value={form.event} onChange={(v) => setField("event", v)} allLabel="Sign-ins and sign-outs"
                  options={[{ value: "sign_in", label: "Sign-ins" }, { value: "sign_out", label: "Sign-outs" }]} />
                <PickerSelect label="Outcome" value={form.outcome} onChange={(v) => setField("outcome", v)} allLabel="Any outcome"
                  options={[{ value: "success", label: "Successful" }, { value: "failed", label: "Failed (any reason)" },
                    ...Object.entries(OUTCOME_LABEL).filter(([k]) => k !== "success").map(([k, l]) => ({ value: k, label: l }))]} />
                <PickerSelect label="Flag" value={form.flag} onChange={(v) => setField("flag", v)} allLabel="Flagged or not"
                  options={[{ value: "any", label: "Any flag" }, ...FLAGS.map((f) => ({ value: f.key, label: f.title }))]} />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="el-q">Search email, IP, device or browser ID</Label>
                  <Input id="el-q" value={form.q} onChange={(e) => setField("q", e.target.value)} />
                </div>
                <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                  {formError && <p className="text-sm text-red-600 mr-auto">{formError}</p>}
                  <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={reset}>Reset</Button>
                    <Button type="submit">Apply</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Logins
                {data && <span className="ml-2 text-sm font-normal text-muted-foreground">{data.total ?? 0}</span>}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadList} disabled={list.loading}>
                <RefreshCw className={list.loading ? "animate-spin" : ""} /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {list.error ? (
                <ErrorBox message={list.error} onRetry={loadList} />
              ) : list.loading && !data ? (
                <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <EventsTable items={data?.items} loading={list.loading} onOpenEmployee={openEmployee} />
              )}
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">Page {page} of {data?.pages || 1}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || list.loading} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= (data?.pages || 1) || list.loading} onClick={() => setPage((p) => p + 1)}>
                    Next <ChevronRight />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "shared" && <SharedDevices token={token} onOpenEmployee={openEmployee} />}

      {tab === "employee" && (
        <div className="space-y-4">
          <div className="max-w-sm">
            <PickerSelect label="Employee" value={personId} onChange={setPersonId} allLabel="Choose an employee"
              options={employees.map((e) => ({ value: e.id, label: employeeName(e) }))} />
          </div>
          {personId ? (
            <EmployeeView token={token} userId={personId} timeZone={tz} onOpenEmployee={openEmployee} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick an employee, or click a name in the other tabs.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared devices ───────────────────────────────────────────────────────────
function SharedDevices({ token, onOpenEmployee }) {
  const [form, setForm] = useState({ from: "", to: "" });
  const [range, setRange] = useState({ from: "", to: "" }); // "" = server default (last 90 days)
  const [rangeError, setRangeError] = useState("");
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const data = await loginsGet(token, "/shared-devices", range);
      setState({ loading: false, error: "", data });
      if (!range.from && data?.filters) setForm({ from: data.filters.from || "", to: data.filters.to || "" });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  }, [token, range]);

  useEffect(() => { load(); }, [load]);

  const apply = (e) => {
    e.preventDefault();
    if (!form.from || !form.to) { setRangeError("Pick both dates."); return; }
    if (form.from > form.to) { setRangeError("The start date is after the end date."); return; }
    setRangeError("");
    setRange({ ...form });
  };

  const items = state.data?.items || [];
  const tz = state.data?.timeZone;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end justify-between gap-4">
          <p className="text-sm text-muted-foreground max-w-xl">
            Phones and browsers that signed in to two or more accounts in this company. This is the strongest sign
            of one person punching for others.
          </p>
          <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="el-s-from" className="text-xs">From</Label>
              <Input id="el-s-from" type="date" className="h-9 w-40" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="el-s-to" className="text-xs">To</Label>
              <Input id="el-s-to" type="date" className="h-9 w-40" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <Button type="submit" size="sm" className="h-9">Apply</Button>
            <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={load} aria-label="Refresh" disabled={state.loading}>
              <RefreshCw className={state.loading ? "animate-spin" : ""} />
            </Button>
            {rangeError && <p className="w-full text-xs text-red-600">{rangeError}</p>}
          </form>
        </CardContent>
      </Card>

      {state.error ? (
        <ErrorBox message={state.error} onRetry={load} />
      ) : state.loading && !state.data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No phone or browser was used by more than one account in this range.</p>
      ) : (
        items.map((dev) => (
          <Card key={`${dev.kind}-${dev.id}`}>
            <CardHeader className="pb-2 flex flex-row flex-wrap items-center gap-3 space-y-0">
              <CardTitle className="text-base font-mono" title={dev.id}>{shortId(dev.id)}</CardTitle>
              <span className="text-xs text-muted-foreground">{dev.kind === "device" ? "phone" : dev.kind}</span>
              <PlatformIcon platform={dev.platform} />
              <span className="ml-auto text-xs text-muted-foreground">Last seen {fmtWhen(dev.lastSeen, tz)}</span>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Account</TableHead>
                    <TableHead className="text-left">Department</TableHead>
                    <TableHead className="text-right">Sign-ins</TableHead>
                    <TableHead className="text-left">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dev.accounts || []).map((a) => (
                    <TableRow key={a.userId}>
                      <TableCell className="text-left">
                        <button type="button" className="font-medium hover:underline" onClick={() => onOpenEmployee(a.userId)}>{a.name}</button>
                      </TableCell>
                      <TableCell className="text-left text-sm text-muted-foreground">{a.department || "—"}</TableCell>
                      <TableCell className="text-right">{a.signIns ?? "—"}</TableCell>
                      <TableCell className="text-left text-xs text-muted-foreground whitespace-nowrap">{fmtWhen(a.lastSeen, tz)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, hint, loading, danger = false, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={`text-left rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-foreground" : "border-border"
      }`}
    >
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className={`text-xl font-semibold ${danger ? "text-red-600" : ""}`}>{loading ? "…" : value ?? 0}</p>
    </button>
  );
}

function PickerSelect({ label, value, onChange, options, allLabel }) {
  const items = useMemo(() => options || [], [options]);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || ANY} onValueChange={(v) => onChange(v === ANY ? "" : v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{allLabel}</SelectItem>
          {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-700">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw /> Retry</Button>
    </div>
  );
}
