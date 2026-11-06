// components/system-admin/activity/FeatureUsageSection.jsx
//
// BB-112: actions (writes) and views (reads) per feature, per company.
// GET /activity/features.

"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, SortHeader, formatNumber } from "../shared";

export const FEATURE_LABELS = {
  clock_in_out: "Clock in/out",
  time_logs: "Time logs",
  leave: "Leave",
  overtime: "Overtime",
  punch_requests: "Punch requests",
  cutoff_approvals: "Cutoff approvals",
  payroll: "Payroll",
  schedules: "Schedules",
  employees: "Employees",
  reports: "Reports",
  notifications: "Notifications",
  other: "Other",
};

export default function FeatureUsageSection({ section }) {
  const [sort, setSort] = useState({ key: "actions", dir: "desc" });

  const rows = useMemo(() => {
    const list = (section.data?.rows || []).map((r) => ({ ...r, featureLabel: FEATURE_LABELS[r.feature] || r.feature }));
    const dir = sort.dir === "desc" ? -1 : 1;
    return list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" || typeof bv === "string") return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
  }, [section.data, sort]);

  const onSort = (key) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "companyName" || key === "featureLabel" ? "asc" : "desc" }
    );

  return (
    <SectionCard
      title="Feature usage"
      description="Actions are changes (create, edit, approve); views are reads."
      section={section}
    >
      <div className="max-h-[420px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Company" sortKey="companyName" sort={sort} onSort={onSort} /></TableHead>
              <TableHead><SortHeader label="Feature" sortKey="featureLabel" sort={sort} onSort={onSort} /></TableHead>
              <TableHead className="text-right"><SortHeader label="Actions" sortKey="actions" sort={sort} onSort={onSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Views" sortKey="views" sort={sort} onSort={onSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Users" sortKey="users" sort={sort} onSort={onSort} align="right" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No activity in this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={`${r.companyId}-${r.feature}`}>
                  <TableCell className="text-sm">{r.companyName || r.companyId}</TableCell>
                  <TableCell className="text-sm">{r.featureLabel}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.actions)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.views)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatNumber(r.users)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
