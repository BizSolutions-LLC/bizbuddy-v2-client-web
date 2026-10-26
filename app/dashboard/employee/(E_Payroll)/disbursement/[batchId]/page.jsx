import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import BatchReview from "../BatchReview";

export const dynamic = "force-dynamic";

export default async function DisbursementBatchPage({ params }) {
  const { batchId } = await params;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BatchReview batchId={batchId} />
    </Suspense>
  );
}
