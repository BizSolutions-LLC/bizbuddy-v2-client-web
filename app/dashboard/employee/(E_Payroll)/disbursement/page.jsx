import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import Overview from "./Overview";

export const dynamic = "force-dynamic";

export default function DisbursementPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Overview />
    </Suspense>
  );
}
