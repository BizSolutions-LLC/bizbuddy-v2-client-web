import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import RecordPayment from "../../RecordPayment";

export const dynamic = "force-dynamic";

export default async function DisbursementPaymentPage({ params }) {
  const { batchId } = await params;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <RecordPayment batchId={batchId} />
    </Suspense>
  );
}
