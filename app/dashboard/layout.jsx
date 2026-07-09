// app/dashboard/layout.jsx

import { Suspense } from "react";
import DashboardLayoutClient from "./DashboardLayoutClient";
import DashboardSkeleton from "./DashboardSkeleton";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
