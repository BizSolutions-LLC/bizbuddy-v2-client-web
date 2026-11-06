// app/system-admin/database/page.jsx
//
// BB-110: read-only Database overview — size, growth, per-company activity and a
// cleanup PREVIEW. No delete / edit / clean-up actions here; cleanup is done via
// scripts a developer reviews. Some counts touch large tables, so there's no
// polling — only the manual Refresh.

"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDatabaseSection, formatBytes, formatNumber } from "@/components/system-admin/database/shared";
import StorageSection from "@/components/system-admin/database/StorageSection";
import CompaniesSection from "@/components/system-admin/database/CompaniesSection";
import GrowthSection from "@/components/system-admin/database/GrowthSection";
import CleanupSection from "@/components/system-admin/database/CleanupSection";

export default function DatabasePage() {
  // Each section loads (and fails) on its own
  const storage = useDatabaseSection("/storage");
  const business = useDatabaseSection("/business");
  const growth = useDatabaseSection("/growth");
  const cleanup = useDatabaseSection("/cleanup-candidates");

  const sections = [storage, business, growth, cleanup];
  const refreshing = sections.some((s) => s.loading);

  const refreshAll = () => sections.forEach((s) => s.reload());

  const requestsPerDay = (growth.data || []).find((r) => r.table === "RequestLog")?.perDayAvg30;

  const tiles = [
    { label: "Database size", section: storage, value: formatBytes(storage.data?.databaseBytes) },
    { label: "Companies", section: business, value: formatNumber(business.data?.companies) },
    { label: "Active employees", section: business, value: formatNumber(business.data?.activeEmployees) },
    { label: "Requests per day", section: growth, value: formatNumber(requestsPerDay), hint: "30-day average" },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Database</h1>
          <p className="text-sm text-neutral-600">
            How big the database is, what&apos;s growing, and what could be cleaned up later. View only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Header tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {t.section.loading && !t.section.data ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{t.section.error ? "—" : t.value}</div>
              )}
              {t.hint && <p className="text-xs text-muted-foreground mt-1">{t.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <StorageSection section={storage} />

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <CompaniesSection section={business} />
        <GrowthSection section={growth} />
      </div>

      <CleanupSection section={cleanup} />
    </div>
  );
}
