// app/system-admin/users/page.jsx
//
// BB-112: User Activity Analytics — who's active, on web or app, which features
// they use, when, and which accounts have gone quiet. B. Buddy and system-admin
// traffic is excluded server-side.

"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSystemAdminSection, useCompanyOptions } from "@/components/system-admin/shared";
import OverviewSection from "@/components/system-admin/activity/OverviewSection";
import FeatureUsageSection from "@/components/system-admin/activity/FeatureUsageSection";
import PeakHoursSection from "@/components/system-admin/activity/PeakHoursSection";
import InactiveAccountsSection from "@/components/system-admin/activity/InactiveAccountsSection";

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const ALL = "all";

export default function UserActivityPage() {
  const [days, setDays] = useState("30");
  const [companyId, setCompanyId] = useState(ALL);
  const companies = useCompanyOptions();

  const query = { days: Number(days), ...(companyId !== ALL ? { companyId } : {}) };

  const overview = useSystemAdminSection("/api/system-admin/activity/overview", query);
  const features = useSystemAdminSection("/api/system-admin/activity/features", query);
  const peakHours = useSystemAdminSection("/api/system-admin/activity/peak-hours", query);

  const sections = [overview, features, peakHours];
  const refreshing = sections.some((s) => s.loading);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 mb-1">User Activity</h1>
          <p className="text-sm text-neutral-600">Who uses BizBuddy, how, and when.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Period</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.companyId} value={c.companyId}>
                    {c.companyName || c.companyId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-9" onClick={() => sections.forEach((s) => s.reload())} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      <OverviewSection section={overview} />
      <FeatureUsageSection section={features} />
      <PeakHoursSection section={peakHours} />
      <InactiveAccountsSection companyId={companyId !== ALL ? companyId : ""} />

      <p className="text-xs text-muted-foreground">
        B. Buddy and system-admin activity aren&apos;t counted. Web vs app is estimated from the device.
      </p>
    </div>
  );
}
