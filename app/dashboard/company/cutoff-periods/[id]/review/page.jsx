// app/dashboard/company/cutoff-periods/[id]/review/page.jsx
// NOTE: Using relative import — the & character in the folder name breaks @/ alias resolution in webpack.
// BB-121: CutoffReviewSwitch picks the List (CutoffReview) or Calendar page per company setting.

import CutoffReviewSwitch from "../../../../../../components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffReviewSwitch";

export const dynamic = "force-dynamic";

export default async function CutoffReviewPage({ params }) {
  const { id } = await params;
  return <CutoffReviewSwitch cutoffId={id} />;
}