"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVENT_LABEL, FlagChips, PlatformIcon, outcomeLabel, shortId } from "./shared";

// One sign-in / sign-out per row. `showEmployee` = false in the employee view.
export default function EventsTable({ items, loading, showEmployee = true, onOpenEmployee, emptyText = "No sign-ins match these filters." }) {
  const cols = showEmployee ? 8 : 7;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Time</TableHead>
            {showEmployee && <TableHead className="text-left">Employee</TableHead>}
            <TableHead className="text-left">Event</TableHead>
            <TableHead className="text-left">Outcome</TableHead>
            <TableHead className="text-left">Platform</TableHead>
            <TableHead className="text-left">Device / browser</TableHead>
            <TableHead className="text-left">IP</TableHead>
            <TableHead className="text-left">Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(!items || items.length === 0) && !loading ? (
            <TableRow>
              <TableCell colSpan={cols} className="text-center text-muted-foreground py-10">{emptyText}</TableCell>
            </TableRow>
          ) : (
            (items || []).map((r) => {
              const deviceKey = r.deviceId || r.browserId;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-left whitespace-nowrap text-xs text-muted-foreground">
                    {r.atLocal || r.at}
                    {r.source === "backfill" && <span className="block text-[10px]">older history</span>}
                  </TableCell>
                  {showEmployee && (
                    <TableCell className="text-left text-sm">
                      {r.employee ? (
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => onOpenEmployee?.(r.employee.id)}
                        >
                          <span className="font-medium">{r.employee.name}</span>
                          {r.employee.department && <span className="block text-xs text-muted-foreground">{r.employee.department}</span>}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">
                          Unknown account
                          {r.email && <span className="block text-xs break-all">{r.email}</span>}
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-left text-sm whitespace-nowrap">{EVENT_LABEL[r.event] || r.event}</TableCell>
                  <TableCell className={`text-left text-sm ${r.failed ? "text-red-600" : ""}`}>{outcomeLabel(r.outcome)}</TableCell>
                  <TableCell className="text-left"><PlatformIcon platform={r.platform} /></TableCell>
                  <TableCell className="text-left font-mono text-xs" title={deviceKey || ""}>
                    {deviceKey ? (
                      <>
                        {shortId(deviceKey)}
                        <span className="block font-sans text-[10px] text-muted-foreground">{r.deviceId ? "phone" : "browser"}</span>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs" title={r.userAgent || ""}>{r.ipAddress || "—"}</TableCell>
                  <TableCell className="text-left"><FlagChips flags={r.flags} sharedWith={r.sharedWith} /></TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
