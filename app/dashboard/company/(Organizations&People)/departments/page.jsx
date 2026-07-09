// app/dashboard/company/(Organizations&People)/departments/page.jsx

import Departments from "@/components/Dashboard/DashboardContent/CompanyPanel/Organizations&People/Departments";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Departments />
    </Suspense>
  );
}
