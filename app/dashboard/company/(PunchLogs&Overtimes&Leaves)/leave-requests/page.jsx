// app/dashboard/company/(Timelogs&Overtimes&Leaves)/leave-requests/page.jsx

import EmployeesLeaveRequests from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesLeaveRequests";
import DashboardSkeleton from "../../../DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LeaveRequestsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EmployeesLeaveRequests />
    </Suspense>
  );
}
