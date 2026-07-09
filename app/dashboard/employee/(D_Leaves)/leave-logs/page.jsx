// app/dashboard/employee/(D_Leaves)/leave-logs/page.jsx

import LeaveLogs from "@/components/Dashboard/DashboardContent/EmployeePanel/Leaves/LeaveLogs";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LeaveLogsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <LeaveLogs />
    </Suspense>
  );
}
