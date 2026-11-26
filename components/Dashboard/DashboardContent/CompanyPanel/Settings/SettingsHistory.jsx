// components/Dashboard/DashboardContent/CompanyPanel/Settings/SettingsHistory.jsx
// BB-151: who changed which company setting, when, and from what to what.
// Data: GET /api/company-settings/history (admin / superadmin only), newest first, cursor paging.
"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import useAccountRole from "@/lib/hooks/useAccountRole";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API = process.env.NEXT_PUBLIC_API_URL;
const PAGE_SIZE = 50;

// Server `area` → the page the change was made on
const AREAS = [
  { id: "general",       label: "Configurations" },
  { id: "cutoff",        label: "Cutoff schedule" },
  { id: "notifications", label: "Notifications" },
  { id: "check",         label: "Check Printing" },
  { id: "payroll",       label: "Payroll config" },
  { id: "profile",       label: "Company Profile" },
  { id: "leaveCredits",  label: "Leave credits" },
];
const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.id, a.label]));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function fmtWhen(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || undefined,
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Plain JSON value → short readable text. Objects keep their JSON for the tooltip.
function fmtValue(v, timeZone) {
  if (v === null || v === undefined || v === "") return { text: "—" };
  if (typeof v === "boolean") return { text: v ? "On" : "Off" };
  if (Array.isArray(v)) return v.length ? { text: v.map((x) => fmtValue(x, timeZone).text).join(", ") } : { text: "—" };
  if (typeof v === "object") {
    const json = JSON.stringify(v, null, 2);
    const short = JSON.stringify(v);
    return { text: short.length > 40 ? `${short.slice(0, 40)}…` : short, full: json };
  }
  if (typeof v === "string" && ISO_DATE.test(v)) {
    return { text: v.length === 10 ? v : fmtWhen(v, timeZone) };
  }
  return { text: String(v) };
}

function ValueText({ value, timeZone }) {
  const { text, full } = fmtValue(value, timeZone);
  if (!full) return <span className="break-words">{text}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="font-mono text-xs underline decoration-dotted underline-offset-2 cursor-help">{text}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <pre className="text-xs whitespace-pre-wrap">{full}</pre>
      </TooltipContent>
    </Tooltip>
  );
}

function whoLabel(event) {
  if (event.bySupport) return "BizBuddy Support";
  if (!event.by) return "Deleted user";
  return event.by.name || "Unknown user";
}

export default function SettingsHistory() {
  const { token } = useAuthStore();
  const { isAdmin, loading: roleLoading } = useAccountRole();

  const [timeZone, setTimeZone] = useState(null);
  const [events,   setEvents]   = useState([]);
  const [cursor,   setCursor]   = useState(null);
  const [available, setAvailable] = useState(true);
  const [loading,  setLoading]  = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  // Admins only (server answers 403 to everyone else)
  useEffect(() => {
    if (!token) { window.location.href = "/login"; return; }
    if (!roleLoading && !isAdmin) window.location.href = "/dashboard";
  }, [token, isAdmin, roleLoading]);

  // Company time zone for the When column
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setTimeZone(j?.data?.timezone || null))
      .catch(() => {});
  }, [token]);

  const fetchPage = useCallback(async (nextCursor) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (nextCursor) params.set("cursor", nextCursor);
    const r = await fetch(`${API}/api/company-settings/history?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || j.error || "Failed to load settings history");
    return j;
  }, [token]);

  const load = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const j = await fetchPage(null);
      setEvents(j.data || []);
      setCursor(j.meta?.nextCursor || null);
      setAvailable(j.meta?.available !== false);
    } catch (e) {
      toast.error(e.message || "Network error loading settings history");
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, fetchPage]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const j = await fetchPage(cursor);
      setEvents((prev) => [...prev, ...(j.data || [])]);
      setCursor(j.meta?.nextCursor || null);
    } catch (e) {
      toast.error(e.message || "Network error loading settings history");
    } finally {
      setLoadingMore(false);
    }
  };


  if (roleLoading || !isAdmin) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
        <Toaster position="top-center" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
              <History className="w-5 h-5 text-muted-foreground" />
              Settings History
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every saved change to company settings: who made it, when, and the old and new value.
              {timeZone && <> Times are in {timeZone}.</>}
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {!available && (
          <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
            History starts once the server update is installed. Saves still work as before.
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : events.length === 0 ? (
          available && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No settings changes recorded yet.
            </p>
          )
        ) : (
          <div className="border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Setting</TableHead>
                  <TableHead>Old → New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => {
                  const changes = ev.changes?.length ? ev.changes : [{ field: "—", label: "—" }];
                  const span = changes.length;
                  return (
                    <Fragment key={ev.id}>
                      {changes.map((c, i) => (
                        <TableRow key={`${ev.id}-${c.field}-${i}`} className={i < span - 1 ? "border-b-0" : ""}>
                          {i === 0 && (
                            <>
                              <TableCell rowSpan={span} className="align-top whitespace-nowrap text-sm">
                                {fmtWhen(ev.at, timeZone)}
                              </TableCell>
                              <TableCell rowSpan={span} className="align-top text-sm">
                                <span className="font-medium">{whoLabel(ev)}</span>
                                {!ev.bySupport && ev.by?.role && (
                                  <span className="block text-xs text-muted-foreground capitalize">{ev.by.role}</span>
                                )}
                              </TableCell>
                              <TableCell rowSpan={span} className="align-top text-sm">
                                {AREA_LABEL[ev.area] || ev.area}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="align-top text-sm">{c.label || c.field}</TableCell>
                          <TableCell className="align-top text-sm">
                            <span className="text-muted-foreground"><ValueText value={c.from} timeZone={timeZone} /></span>
                            <span className="mx-1.5 text-muted-foreground">→</span>
                            <span className="font-medium"><ValueText value={c.to} timeZone={timeZone} /></span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {cursor && !loading && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Load more
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
