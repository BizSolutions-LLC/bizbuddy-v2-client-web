// app/dashboard/employee/(C_TimeKeeping)/schedule/page.jsx

import Schedule from "@/components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Schedule";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Schedule />
    </Suspense>
  );
}
