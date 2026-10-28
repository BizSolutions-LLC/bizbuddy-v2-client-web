// components/system-admin/performance/HotspotsTable.jsx
//
// BB-112 Capacity: endpoints by total server time (server order). Flagged rows
// (slow or much slower, 20+ calls) carry a marker; a row opens Request Logs
// filtered to that endpoint and method.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatDuration } from "../shared";
import { isFlagged } from "./CapacityCards";

const SHOW_FIRST = 15;

// The table primitive centres by default
const LEFT = "text-left px-3";
const NUM = "text-right px-3 tabular-nums";

function Change({ value }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone = value >= 50 ? "text-red-600 font-medium" : value < 0 ? "text-green-700" : "text-muted-foreground";
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

export default function HotspotsTable({ endpoints = [], days }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? endpoints : endpoints.slice(0, SHOW_FIRST);
  const flagged = endpoints.filter(isFlagged).length;

  const open = (e) =>
    router.push(`/system-admin/requests?${new URLSearchParams({ endpoint: e.endpoint, method: e.method })}`);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">
          API hotspots{" "}
          <span className="font-normal text-muted-foreground">
            · {formatNumber(endpoints.length)} endpoints{flagged ? ` · ${flagged} flagged` : ""}
          </span>
        </CardTitle>
        <CardDescription>
          Sorted by total server time over the last {days === 1 ? "day" : `${days} days`}. Change compares p95 with the
          period before. Click a row to see its requests.
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
                  <TableHead className={NUM}>Calls</TableHead>
                  <TableHead className={NUM}>Avg</TableHead>
                  <TableHead className={NUM}>p95</TableHead>
                  <TableHead className={NUM}>Change</TableHead>
                  <TableHead className={NUM}>Share of server time</TableHead>
                  <TableHead className={NUM}>Slow calls</TableHead>
                  <TableHead className={NUM}>5xx</TableHead>
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
                      <TableCell className={NUM}>{formatNumber(e.calls)}</TableCell>
                      <TableCell className={NUM}>{formatDuration(e.avgMs)}</TableCell>
                      <TableCell className={`${NUM} ${e.p95Ms >= 3000 ? "font-medium text-red-600" : ""}`}>
                        {formatDuration(e.p95Ms)}
                      </TableCell>
                      <TableCell className={NUM}>
                        <Change value={e.p95ChangePercent} />
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
