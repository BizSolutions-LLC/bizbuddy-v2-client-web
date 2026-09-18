import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import Disbursement from "./Disbursement";

export const dynamic = "force-dynamic";

export default function DisbursementPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Disbursement />
    </Suspense>
  );
}
