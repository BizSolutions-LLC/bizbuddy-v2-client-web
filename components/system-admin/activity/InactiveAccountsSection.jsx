// components/system-admin/activity/InactiveAccountsSection.jsx
//
// BB-112: active accounts with no sign-in and no requests for N days (seat
// review). GET /activity/inactive — has its own "days inactive" window.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, useSystemAdminSection, relativeTime, formatDateTime } from "../shared";

const DEFAULT_DAYS = 30;
const clampDays = (v) => Math.min(Math.max(parseInt(v, 10) || DEFAULT_DAYS, 1), 365);

export default function InactiveAccountsSection({ companyId }) {
  const [daysInput, setDaysInput] = useState(String(DEFAULT_DAYS));
  const [days, setDays] = useState(DEFAULT_DAYS);

  const section = useSystemAdminSection("/api/system-admin/activity/inactive", {
    days,
    ...(companyId ? { companyId } : {}),
  });
  const rows = section.data?.rows || [];

  const apply = (e) => {
    e.preventDefault();
    const next = clampDays(daysInput);
    setDaysInput(String(next));
    setDays(next);
  };

  return (
    <SectionCard
      title="Inactive accounts"
      description={`Active accounts with no sign-in or activity for ${days}+ days.${
        section.data ? ` ${rows.length} found.` : ""
      }`}
      section={section}
      actions={
        <form onSubmit={apply} className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="inactive-days" className="text-xs">
              Days inactive
            </Label>
            <Input
              id="inactive-days"
              type="number"
              min={1}
              max={365}
              value={daysInput}
              onChange={(e) => setDaysInput(e.target.value)}
              className="h-8 w-24"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
      }
    >
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No inactive accounts.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="text-sm font-medium">{r.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                  <TableCell className="text-sm">{r.companyName || "—"}</TableCell>
                  <TableCell className="text-sm capitalize">{r.role}</TableCell>
                  <TableCell
                    className="whitespace-nowrap text-xs text-muted-foreground"
                    title={r.lastSeenAt ? formatDateTime(r.lastSeenAt) : undefined}
                  >
                    {r.lastSeenAt ? relativeTime(r.lastSeenAt) : "Never"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {section.data?.note && <p className="mt-3 text-xs text-muted-foreground">{section.data.note}</p>}
    </SectionCard>
  );
}
