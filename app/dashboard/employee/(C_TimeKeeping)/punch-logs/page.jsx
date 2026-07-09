// app/dashboard/employee/(C_TimeKeeping)/punch-logs/page.jsx

import PunchLogs from "@/components/Dashboard/DashboardContent/EmployeePanel/TimeKeeping/PunchLogs";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PunchLogsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PunchLogs />
    </Suspense>
  );
}
