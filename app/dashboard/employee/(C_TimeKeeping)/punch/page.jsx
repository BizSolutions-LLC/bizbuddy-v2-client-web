// app/dashboard/employee/(C_TimeKeeping)/punch/page.jsx

import Punch from "@/components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/Punch";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PunchPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Punch />
    </Suspense>
  );
}
