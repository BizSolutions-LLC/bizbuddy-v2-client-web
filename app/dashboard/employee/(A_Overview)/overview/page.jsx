// app/dashboard/employee/(A_Overview)/overview/page.jsx

"use client";
import Overview from "@/components/Dashboard/DashboardContent/EmployeePanel/Overview/Overview";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Overview />
    </Suspense>
  );
}
