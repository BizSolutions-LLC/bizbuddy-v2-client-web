// app/dashboard/employee/(F_Help)/documentation/page.jsx

import Documentation from "@/components/Dashboard/DashboardContent/EmployeePanel/Documentation/Documentation";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function DocumentationPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Documentation />
    </Suspense>
  );
}
