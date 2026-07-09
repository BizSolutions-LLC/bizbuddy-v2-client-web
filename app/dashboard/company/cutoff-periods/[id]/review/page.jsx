// app/dashboard/company/cutoff-periods/[id]/review/page.jsx
// NOTE: Using relative import — the & character in the folder name breaks @/ alias resolution in webpack.

import CutoffReview from "../../../../../../components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReview";

export const dynamic = "force-dynamic";

export default async function CutoffReviewPage({ params }) {
  const { id } = await params;
  return <CutoffReview cutoffId={id} />;
}