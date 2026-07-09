// app/dashboard/company/(Settings)/configurations/page.jsx

import CompanyConfigurations from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyConfigurations";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ConfigurationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CompanyConfigurations />;
    </Suspense>
  );
}
