import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import PaymentProof from "../../PaymentProof";

export const dynamic = "force-dynamic";

export default async function DisbursementProofPage({ params }) {
  const { batchId } = await params;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PaymentProof batchId={batchId} />
    </Suspense>
  );
}
