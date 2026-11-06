// components/system-admin/database/CompaniesSection.jsx
//
// BB-110: per-company size and activity (B. Buddy already excluded server-side).

"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, formatNumber, relativeTime } from "./shared";

const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const isInactive = (lastActivityAt) =>
  !lastActivityAt || Date.now() - new Date(lastActivityAt).getTime() > INACTIVE_AFTER_MS;

export default function CompaniesSection({ section }) {
  const rows = section.data?.perCompany || [];

  return (
    <SectionCard title="Companies" description="Size and recent activity per company." section={section}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Active employees</TableHead>
              <TableHead className="text-right">Time logs (30 days)</TableHead>
              <TableHead className="text-right">Open cutoffs</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No companies.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.companyId}>
                  <TableCell className="text-sm font-medium">
                    {c.companyName || c.companyId}
                    {isInactive(c.lastActivityAt) && (
                      <Badge variant="outline" className="ml-2 text-[10px] font-normal text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(c.activeEmployees)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(c.timeLogsLast30Days)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(c.openCutoffPeriods)}</TableCell>
                  <TableCell
                    className="whitespace-nowrap text-xs text-muted-foreground"
                    title={c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleString() : undefined}
                  >
                    {relativeTime(c.lastActivityAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
