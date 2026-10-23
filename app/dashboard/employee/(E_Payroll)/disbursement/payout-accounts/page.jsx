import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import CompanyPayoutAccount from "../CompanyPayoutAccount";

export const dynamic = "force-dynamic";

export default function CompanyPayoutAccountPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <CompanyPayoutAccount />
    </Suspense>
  );
}
