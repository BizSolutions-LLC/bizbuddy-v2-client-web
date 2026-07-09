// app/dashboard/page.jsx

import { Suspense } from "react";
import DashboardHomeClient from "./DashboardHomeClient";

export const dynamic = "force-dynamic";

export default function DashboardHome() {
  return (
    <Suspense fallback={null}>
      <DashboardHomeClient />
    </Suspense>
  );
}
