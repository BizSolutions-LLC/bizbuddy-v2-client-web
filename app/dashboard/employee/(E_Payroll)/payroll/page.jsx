// app/dashboard/employee/(E_Payroll)/payroll/page.jsx

import TemporaryPage from "@/components/Dashboard/DashboardContent/Others/TemporaryPageComponent";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import Payroll from "./Payroll";

export const dynamic = "force-dynamic";

export default function PayrollPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Payroll />
    </Suspense>
  );
}
