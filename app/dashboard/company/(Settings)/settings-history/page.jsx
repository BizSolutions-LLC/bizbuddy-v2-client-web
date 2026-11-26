// app/dashboard/company/(Settings)/settings-history/page.jsx
// BB-151: Settings History (admin / superadmin only)

import SettingsHistory from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/SettingsHistory";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SettingsHistoryPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <SettingsHistory />
    </Suspense>
  );
}
