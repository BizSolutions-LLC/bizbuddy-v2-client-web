"use client";
// BB-121: shows the List or Calendar cutoff review page, per Company.cutoffPageView.

import CutoffReview from "./CutoffReview";
import CutoffReviewCalendar from "./CutoffReviewCalendar";
import OrangeLoadingSpinner from "@/components/common/Spinner";
import { useCutoffPageView } from "@/lib/hooks/useCutoffPageView";

export default function CutoffReviewSwitch({ cutoffId }) {
  const { view, loading } = useCutoffPageView();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <OrangeLoadingSpinner size={32} />
      </div>
    );
  }

  return view === "calendar"
    ? <CutoffReviewCalendar cutoffId={cutoffId} />
    : <CutoffReview cutoffId={cutoffId} />;
}
