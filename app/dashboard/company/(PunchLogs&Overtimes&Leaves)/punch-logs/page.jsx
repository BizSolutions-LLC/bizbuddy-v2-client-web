// app/dashboard/company/(Timelogs&Overtimes&Leaves)/punch-logs/page.jsx

import EmployeesPunchLogs from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeesPunchLogs";
import DashboardSkeleton from "../../../DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PunchLogsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EmployeesPunchLogs />
    </Suspense>
  );
}
