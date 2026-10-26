import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import BatchList from "../BatchList";

export const dynamic = "force-dynamic";

export default function DisbursementBatchesPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BatchList />
    </Suspense>
  );
}
