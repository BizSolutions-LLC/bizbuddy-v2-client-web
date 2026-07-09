// app/dashboard/company/(Settings)/deletion/page.jsx

import CompanyAndAccsDeletion from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/Company&AccsDeletion";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function DeletionPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CompanyAndAccsDeletion />
    </Suspense>
  );
}
