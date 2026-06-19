// app/dashboard/company/cutoff-periods/[id]/review/v2/page.jsx
import { notFound } from "next/navigation";
import CutoffReviewV2 from "../../../../../../../components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReviewV2";

export const dynamic = "force-dynamic";

export default async function CutoffReviewV2Page({ params }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { id } = await params;
  return <CutoffReviewV2 cutoffId={id} />;
}
