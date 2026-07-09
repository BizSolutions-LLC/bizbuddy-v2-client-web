// app/dashboard/employee/(B_Profile)/employment-details/page.jsx

import MyEmplymntDtls from "@/components/Dashboard/DashboardContent/EmployeePanel/Profile/MyEmplymntDtls";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function EmploymentDetailsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <MyEmplymntDtls />
    </Suspense>
  );
}
