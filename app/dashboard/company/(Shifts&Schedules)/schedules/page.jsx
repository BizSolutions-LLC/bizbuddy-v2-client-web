// app/dashboard/company/(Shifts&Schedules)/schedules/page.jsx

import Schedules from "@/components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Schedules";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SchedulesPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Schedules />
    </Suspense>
  );
}
