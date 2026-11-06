// app/system-admin/performance/page.jsx
//
// Performance: Capacity (BB-112: verdicts, gauges, history, hotspots),
// Endpoints (per-endpoint response times, the page's original view) and
// Reports (BB-113: saved months as PDF).

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import CapacityView from "@/components/system-admin/performance/CapacityView";
import EndpointsView from "@/components/system-admin/performance/EndpointsView";
import ReportsView from "@/components/system-admin/performance/ReportsView";

const TABS = [
  { id: "capacity", label: "Capacity" },
  { id: "endpoints", label: "Endpoints" },
  { id: "reports", label: "Reports" },
];

export default function PerformancePage() {
  const [tab, setTab] = useState("capacity");

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Performance</h1>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "ghost"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "capacity" ? <CapacityView /> : tab === "endpoints" ? <EndpointsView /> : <ReportsView />}
    </div>
  );
}
