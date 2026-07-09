// app/dashboard/company/(Settings)/subscription/page.jsx

import CompanySubscription from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanySubscription";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CompanySubscription />
    </Suspense>
  );
}
