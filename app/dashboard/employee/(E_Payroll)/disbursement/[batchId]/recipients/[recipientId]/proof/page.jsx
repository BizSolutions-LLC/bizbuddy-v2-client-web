import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";
import PaymentProof from "../../../../PaymentProof";

export const dynamic = "force-dynamic";

export default async function RecipientProofPage({ params }) {
  const { batchId, recipientId } = await params;
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PaymentProof batchId={batchId} recipientId={recipientId} />
    </Suspense>
  );
}
