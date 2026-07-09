// app/dashboard/company/(Locations)/locations/page.jsx

import Locations from "@/components/Dashboard/DashboardContent/CompanyPanel/Locations/Locations";
import DashboardSkeleton from "../../../DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LocationsPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Locations />
    </Suspense>
  );
}
