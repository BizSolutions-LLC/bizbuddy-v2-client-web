// components/system-admin/database/StorageSection.jsx
//
// BB-110: where the space goes — one bar per category (share of the whole
// database) and a sortable, filterable list of tables.

"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, SortHeader, formatBytes, formatNumber, relativeTime } from "./shared";

// Per the handoff: logs amber, temporary blue, legacy grey, everything else neutral
const CATEGORY_BAR = {
  logs: "bg-amber-500",
  temporary: "bg-blue-500",
  legacy: "bg-neutral-300",
};
const NEUTRAL_BAR = "bg-neutral-600";

const DEAD_ROW_RATIO = 0.2;
const needsVacuum = (t) => t.rowsEstimate > 0 && t.deadRows > t.rowsEstimate * DEAD_ROW_RATIO;

export default function StorageSection({ section }) {
  const { data } = section;
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState({ key: "totalBytes", dir: "desc" });

  // The server only totals its known categories; tables it doesn't recognise are
  // tagged "other" — total those here so the bars add up to the whole database.
  const categories = useMemo(() => {
    if (!data) return [];
    const list = [...(data.categories || [])];
    const others = (data.tables || []).filter((t) => t.category === "other");
    if (others.length && !list.some((c) => c.key === "other")) {
      list.push({
        key: "other",
        label: "Other",
        policy: "Tables not yet sorted into a category.",
        tableCount: others.length,
        totalBytes: others.reduce((n, t) => n + (t.totalBytes || 0), 0),
        rowsEstimate: others.reduce((n, t) => n + (t.rowsEstimate || 0), 0),
      });
    }
    return list;
  }, [data]);

  const labelOf = (key) => categories.find((c) => c.key === key)?.label?.split(" — ")[0] || key;

  const tables = useMemo(() => {
    const list = (data?.tables || []).filter((t) => category === "all" || t.category === category);
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string" || typeof bv === "string") return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
      return ((av ?? -Infinity) - (bv ?? -Infinity)) * dir;
    });
  }, [data, category, sort]);

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "table" ? "asc" : "desc" }));

  const total = data?.databaseBytes || 0;

  return (
    <SectionCard title="Storage" description="Where the space goes, by category and by table." section={section} skeletonRows={8}>
      {/* Category bars */}
      <div className="space-y-4">
        {categories.map((c) => {
          const share = total ? (c.totalBytes / total) * 100 : 0;
          return (
            <div key={c.key} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(c.totalBytes)} · {share.toFixed(1)}% · ≈{formatNumber(c.rowsEstimate)} rows · {c.tableCount} table
                  {c.tableCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted" title={`${c.label}: ${formatBytes(c.totalBytes)} (${share.toFixed(1)}%)`}>
                <div
                  className={`h-2 rounded-full ${CATEGORY_BAR[c.key] || NEUTRAL_BAR}`}
                  style={{ width: `${share > 0 ? Math.max(share, 0.5) : 0}%` }}
                />
              </div>
              {c.policy && <p className="text-xs text-muted-foreground">{c.policy}</p>}
            </div>
          );
        })}
      </div>

      {/* Tables */}
      <div className="mt-8 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Tables</h3>
          <div className="space-y-1.5 w-56">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {labelOf(c.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader label="Table" sortKey="table" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Category" sortKey="category" sort={sort} onSort={onSort} /></TableHead>
                <TableHead className="text-right"><SortHeader label="Rows (≈)" sortKey="rowsEstimate" sort={sort} onSort={onSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader label="Size" sortKey="totalBytes" sort={sort} onSort={onSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortHeader label="Index size" sortKey="indexBytes" sort={sort} onSort={onSort} align="right" /></TableHead>
                <TableHead><SortHeader label="Last vacuum" sortKey="lastVacuum" sort={sort} onSort={onSort} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No tables in this category.
                  </TableCell>
                </TableRow>
              ) : (
                tables.map((t) => (
                  <TableRow key={t.table}>
                    <TableCell className="font-mono text-sm">
                      {t.table}
                      {needsVacuum(t) && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] font-sans text-yellow-700 border-yellow-300"
                          title={`≈${formatNumber(t.deadRows)} dead rows`}
                        >
                          needs vacuum
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{labelOf(t.category)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">≈{formatNumber(t.rowsEstimate)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBytes(t.totalBytes)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatBytes(t.indexBytes)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(t.lastVacuum)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">Row counts are estimates.</p>
      </div>
    </SectionCard>
  );
}
