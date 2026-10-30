// app/system-admin/security/page.jsx
//
// BB-112: Security Monitor — graded signals of suspicious activity, critical
// first. Signals only report; blocking is handled by sign-in limits, lockouts
// and 2FA. No polling: the 30-day range touches a lot of rows.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SectionCard,
  CacheStamp,
  useSystemAdminSection,
  useRefreshLocked,
  relativeTime,
  formatDateTime,
  formatNumber,
} from "@/components/system-admin/shared";

const RANGES = [
  { value: "1h", label: "1h", hours: 1 },
  { value: "6h", label: "6h", hours: 6 },
  { value: "24h", label: "24h", hours: 24 },
  { value: "7d", label: "7d", hours: 24 * 7 },
  { value: "30d", label: "30d", hours: 24 * 30 },
];

const SEVERITY = {
  critical: { label: "Critical", text: "text-red-600", badge: "border-red-200 bg-red-50 text-red-700" },
  warning: { label: "Warning", text: "text-amber-600", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  info: { label: "Info", text: "text-blue-600", badge: "border-blue-200 bg-blue-50 text-blue-700" },
};

const GROUPS = [
  {
    id: "signin",
    label: "Sign-in",
    match: (t) =>
      ["account_failed_signins", "credential_stuffing", "new_network_signin"].includes(t) || t.startsWith("reset_spike_"),
  },
  { id: "access", label: "Access", match: (t) => t === "repeated_access_denied" },
  { id: "bbuddy", label: "B. Buddy", match: (t) => t.startsWith("bbuddy_") },
  { id: "admin", label: "System admin", match: (t) => t.startsWith("admin_") },
  { id: "platform", label: "Platform", match: (t) => ["server_errors", "request_flood"].includes(t) },
];

const groupOf = (type) => GROUPS.find((g) => g.match(type))?.id || "other";

// Request Logs link for a signal: its own filters, the selected window, and the
// subject's company. /requests can't filter by IP or email, so only signals
// that carry filters get a link.
function requestsHref(signal, hours) {
  if (!signal.filters) return null;
  const params = new URLSearchParams();
  Object.entries(signal.filters).forEach(([k, v]) => v !== undefined && v !== null && params.set(k, String(v)));
  if (signal.subject?.companyId && !params.has("companyId")) params.set("companyId", signal.subject.companyId);
  const end = new Date();
  params.set("startDate", new Date(end.getTime() - hours * 3600 * 1000).toISOString());
  params.set("endDate", end.toISOString());
  return `/system-admin/requests?${params.toString()}`;
}

// "ip 203.0.113.4 · jane@acme.com" from the signal's subject
function subjectLine(subject = {}) {
  return [subject.email, subject.ip && `IP ${subject.ip}`, subject.agentCode && `Staff ${subject.agentCode}`, subject.endpoint]
    .filter(Boolean)
    .join(" · ");
}

export default function SecurityPage() {
  const [range, setRange] = useState("24h");
  const [group, setGroup] = useState("all");
  const section = useSystemAdminSection("/api/system-admin/security/signals", { timeRange: range });
  const { data, loading, error } = section;
  // BB-114: signals are cached for 2 min; generatedAt covers an uncached response
  const asOf = section.cache?.cachedAt || data?.generatedAt;
  const refreshLocked = useRefreshLocked(section.cache?.cachedAt);
  const hours = RANGES.find((r) => r.value === range)?.hours || 24;

  const signals = data?.signals || [];
  const groupCounts = useMemo(() => {
    const counts = {};
    for (const s of signals) counts[groupOf(s.type)] = (counts[groupOf(s.type)] || 0) + 1;
    return counts;
  }, [signals]);
  const visible = group === "all" ? signals : signals.filter((s) => groupOf(s.type) === group);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Security Monitor</h1>
          <p className="text-sm text-neutral-600">
            Suspicious activity across sign-ins, access, B. Buddy and system admins.
            {asOf && <> <CacheStamp at={asOf} className="text-sm text-neutral-500" /></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                aria-pressed={range === r.value}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  range === r.value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => section.refresh()} disabled={loading || refreshLocked}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(SEVERITY).map(([key, s]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <div className={`text-2xl font-bold ${data?.counts?.[key] ? s.text : "text-foreground"}`}>
                  {error ? "—" : formatNumber(data?.counts?.[key] ?? 0)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard title="Signals" section={section} skeletonRows={4} asOf={false}>
        {/* Group chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: "all", label: "All" }, ...GROUPS].map((g) => {
            const count = g.id === "all" ? signals.length : groupCounts[g.id] || 0;
            const active = group === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.label} <span className={active ? "opacity-80" : ""}>{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No security signals in this period.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {visible.map((s, i) => {
              const sev = SEVERITY[s.severity] || SEVERITY.info;
              const href = requestsHref(s, hours);
              const subject = subjectLine(s.subject);
              return (
                <li key={`${s.type}-${i}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[11px] font-medium ${sev.badge}`}>
                        {sev.label}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                      {s.count != null && <span className="text-xs text-muted-foreground">×{formatNumber(s.count)}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.detail}</p>
                    {subject && <p className="text-xs text-muted-foreground font-mono break-all">{subject}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-4 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1">
                    <span title={s.lastSeen ? formatDateTime(s.lastSeen) : undefined}>
                      {s.lastSeen ? `Last seen ${relativeTime(s.lastSeen)}` : ""}
                    </span>
                    {href && (
                      <Link href={href} className="inline-flex items-center gap-0.5 font-medium text-foreground hover:underline">
                        View requests <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Signals show suspicious activity; they don&apos;t block it. Blocking is handled by sign-in limits, lockouts and 2FA.
      </p>
    </div>
  );
}
