// app/dashboard/employee/(B_Profile)/personal-employment-identifications/page.jsx

import MyPrsnlDplymntIdntfctns from "@/components/Dashboard/DashboardContent/EmployeePanel/Profile/MyPrsnlDplymntIdntfctns";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PersonalEmploymentIdentificationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <MyPrsnlDplymntIdntfctns />
    </Suspense>
  );
}
