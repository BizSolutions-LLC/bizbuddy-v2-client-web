// app/dashboard/company/(Timelogs&Overtimes&Leaves)/overtime-requests/page.jsx

import EmployeesOvertimeRequests from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesOvertimeRequests";
import DashboardSkeleton from "../../../DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function OvertimeRequestsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EmployeesOvertimeRequests />
    </Suspense>
  );
}
