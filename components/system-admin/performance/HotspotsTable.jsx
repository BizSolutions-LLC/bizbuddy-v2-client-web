// components/system-admin/performance/HotspotsTable.jsx
//
// BB-112 Capacity: busiest endpoints by total server time (server order). Flagged rows
// (slow for their kind or much slower, 20+ calls) carry a marker; a row opens
// Request Logs filtered to that endpoint and method. p95 and Change are coloured
// by the server's bands when it sends them (v2.11.1+).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDuration } from "../shared";
import { isFlagged } from "./CapacityCards";
import { BAND, bandRanges } from "./bands";

const KIND = { light: "Light", heavy: "Heavy", long: "Long" };

const SHOW_FIRST = 15;

// The table primitive centres by default
const LEFT = "text-left px-3";
const NUM = "text-right px-3 tabular-nums";

function Change({ value, band }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone =
    band === "terrible" || (band === undefined && value >= 50)
      ? "text-red-600 font-medium"
      : band === "watch"
        ? "text-amber-600"
        : value < 0 ? "text-green-700" : "text-muted-foreground";
  return <span className={tone}>{value > 0 ? `+${value}%` : `${value}%`}</span>;
}

function Share({ value }) {
  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{formatNumber(pct, 1)}%</span>
    </div>
  );
}

export default function HotspotsTable({ endpoints = [], days, thresholds }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? endpoints : endpoints.slice(0, SHOW_FIRST);
  const flagged = endpoints.filter(isFlagged).length;
  const banded = endpoints[0]?.band !== undefined;

  const open = (e) =>
    router.push(`/system-admin/requests?${new URLSearchParams({ endpoint: e.endpoint, method: e.method })}`);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">
          Busiest endpoints{" "}
          <span className="font-normal text-muted-foreground">
            · {formatNumber(endpoints.length)} endpoints{flagged ? ` · ${flagged} flagged` : ""}
          </span>
        </CardTitle>
        <CardDescription>
          Sorted by total server time{banded ? ", speed judged by kind" : ""}. Click a row for its requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No requests in this period.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={LEFT}>Endpoint</TableHead>
                  {banded && (
                    <TableHead className={LEFT} title="Light reads should be far faster than long syncs, imports or exports">
                      Kind
                    </TableHead>
                  )}
                  <TableHead className={NUM}>Calls</TableHead>
                  <TableHead className={NUM} title="Average response time">
                    Typical
                  </TableHead>
                  <TableHead className={NUM} title="p95: 95% of calls finish faster">
                    Slow calls
                  </TableHead>
                  <TableHead className={NUM} title={`Change in p95 vs the ${days === 1 ? "day" : `${days} days`} before`}>
                    vs before
                  </TableHead>
                  <TableHead className={NUM}>Share of server time</TableHead>
                  <TableHead className={NUM} title="Calls over the server's slow-request limit">
                    Very slow
                  </TableHead>
                  <TableHead className={NUM} title="Server errors (5xx)">
                    Errors
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const hot = isFlagged(e);
                  return (
                    <TableRow
                      key={`${e.method} ${e.endpoint}`}
                      className="cursor-pointer"
                      onClick={() => open(e)}
                      title="Open in Request Logs"
                    >
                      <TableCell className={`${LEFT} py-2.5`}>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${hot ? "bg-red-600" : "bg-transparent"}`}
                            aria-label={hot ? "Flagged" : undefined}
                          />
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                            {e.method}
                          </span>
                          <span className="max-w-md truncate font-mono text-xs text-foreground" title={e.endpoint}>
                            {e.endpoint}
                          </span>
                        </div>
                      </TableCell>
                      {banded && (
                        <TableCell className={`${LEFT} text-xs text-muted-foreground`}>{KIND[e.class] || e.class}</TableCell>
                      )}
                      <TableCell className={NUM}>{formatNumber(e.calls)}</TableCell>
                      <TableCell className={NUM}>{formatDuration(e.avgMs)}</TableCell>
                      <TableCell
                        className={`${NUM} ${
                          banded
                            ? `${BAND[e.band]?.text || ""} ${e.band === "terrible" ? "font-medium" : ""}`
                            : e.p95Ms >= 3000 ? "font-medium text-red-600" : ""
                        }`}
                        title={banded ? `${KIND[e.class] || e.class}: ${bandRanges(thresholds?.endpoints?.[e.class])}` : undefined}
                      >
                        {formatDuration(e.p95Ms)}
                      </TableCell>
                      <TableCell className={NUM}>
                        <Change value={e.p95ChangePercent} band={e.changeBand} />
                      </TableCell>
                      <TableCell className={NUM}>
                        <Share value={e.shareOfServerTimePercent} />
                      </TableCell>
                      <TableCell className={NUM}>
                        {e.slowCalls ? formatNumber(e.slowCalls) : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className={`${NUM} ${e.serverErrors > 0 ? "font-medium text-red-600" : ""}`}>
                        {e.serverErrors ? formatNumber(e.serverErrors) : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {endpoints.length > SHOW_FIRST && (
              <div className="mt-3 flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? `Show the top ${SHOW_FIRST}` : `Show all ${formatNumber(endpoints.length)}`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
