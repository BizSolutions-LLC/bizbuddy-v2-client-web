// app/system-admin/subscription-plans/page.jsx
//
// BB-132: read-only Subscription Plans showcase. Summary totals, plan cards,
// a feature comparison and a per-plan drawer with its companies.
// GET /subscription-plans/overview and /subscription-plans/:id (server v2.11.15).
// No create / edit / delete / change-plan from System Admin.

"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, useSystemAdminSection } from "@/components/system-admin/shared";
import PlanCards from "@/components/system-admin/subscription-plans/PlanCards";
import FeatureComparison from "@/components/system-admin/subscription-plans/FeatureComparison";
import PlanDetailSheet from "@/components/system-admin/subscription-plans/PlanDetailSheet";

export default function SubscriptionPlansPage() {
  const overview = useSystemAdminSection("/api/system-admin/subscription-plans/overview");
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const totals = overview.data?.totals;
  const selectedName = (overview.data?.plans || []).find((p) => p.id === selectedPlanId)?.name;

  const tiles = [
    { label: "Plans", value: formatNumber(totals?.plans) },
    { label: "Subscribed companies", value: formatNumber(totals?.subscribedCompanies) },
    { label: "Companies without a plan", value: formatNumber(totals?.companiesWithoutPlan) },
    { label: "Retired companies", value: formatNumber(totals?.retiredCompanies) },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Subscription plans</h1>
          <p className="text-sm text-neutral-600">
            Every plan, what it includes, and which companies are on it. View only.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => overview.reload()} disabled={overview.loading}>
          <RefreshCw className={overview.loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.loading && !overview.data ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{overview.error ? "—" : t.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <PlanCards section={overview} onSelect={setSelectedPlanId} />

      <FeatureComparison section={overview} />

      <PlanDetailSheet planId={selectedPlanId} fallbackName={selectedName} onClose={() => setSelectedPlanId(null)} />
    </div>
  );
}
