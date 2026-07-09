// app/dashboard/company/(Settings)/profile/page.jsx

import CompanyProfile from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyProfile";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CompanyProfile />
    </Suspense>
  );
}
