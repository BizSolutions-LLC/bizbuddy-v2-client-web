"use client";
// BB-121: shows the List or Calendar cutoff list page, per Company.cutoffPageView.

import EmployeeCutoff from "./EmployeeCutoff";
import CutoffPeriodsCalendar from "./CutoffPeriodsCalendar";
import OrangeLoadingSpinner from "@/components/common/Spinner";
import { useCutoffPageView } from "@/lib/hooks/useCutoffPageView";

export default function CutoffPeriodsSwitch() {
  const { view, loading } = useCutoffPageView();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <OrangeLoadingSpinner size={32} />
      </div>
    );
  }

  return view === "calendar" ? <CutoffPeriodsCalendar /> : <EmployeeCutoff />;
}
