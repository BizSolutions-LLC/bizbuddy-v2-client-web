// app/dashboard/company/(Organizations&People)/employees/page.jsx

import Employees from "@/components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Employees";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Employees />
    </Suspense>
  );
}
