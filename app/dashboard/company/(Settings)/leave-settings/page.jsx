// app/dashboard/company/(Settings)/leave-settings/page.jsx

import LeaveSettings from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LeaveSettingsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <LeaveSettings />
    </Suspense>
  );
}
