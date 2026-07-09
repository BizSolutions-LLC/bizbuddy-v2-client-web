// app/dashboard/company/(Shifts&Schedules)/shifts/page.jsx

import Shifts from "@/components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ShiftsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Shifts />
    </Suspense>
  );
}
