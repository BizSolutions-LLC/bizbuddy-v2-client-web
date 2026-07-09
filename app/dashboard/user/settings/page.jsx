// app/dashboard/user/settings/page.jsx

import UserSettingsComponent from "@/components/Dashboard/DashboardContent/Others/UserSettingsComponent";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export default function settings() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UserSettingsComponent />
    </Suspense>
  );
}
