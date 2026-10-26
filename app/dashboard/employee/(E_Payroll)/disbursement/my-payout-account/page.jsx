import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import MyPayoutAccount from "../MyPayoutAccount";

export const dynamic = "force-dynamic";

export default function MyPayoutAccountPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <MyPayoutAccount />
    </Suspense>
  );
}
