// app/dashboard/referral/(Refferal)/referral/page.jsx

import TemporaryPage from "@/components/Dashboard/DashboardContent/Others/TemporaryPageComponent";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ReferralPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TemporaryPage />
    </Suspense>
  );
}
