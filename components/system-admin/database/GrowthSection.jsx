// components/system-admin/database/GrowthSection.jsx
//
// BB-110: new rows per table, fastest-growing first (server order).

"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, formatNumber } from "./shared";

export default function GrowthSection({ section }) {
  const rows = section.data || [];

  return (
    <SectionCard
      title="Growth"
      description="New rows added. Logs grow with every action in the app."
      section={section}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead className="text-right">Last 7 days</TableHead>
              <TableHead className="text-right">Last 30 days</TableHead>
              <TableHead className="text-right">Avg per day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No growth data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.table}>
                  <TableCell className="font-mono text-sm">{r.table}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.last7Days)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.last30Days)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.perDayAvg30, 1)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
