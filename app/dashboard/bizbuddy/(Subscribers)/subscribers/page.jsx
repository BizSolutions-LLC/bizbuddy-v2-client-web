// app/dashboard/bizbuddy/(Subscribers)/subscribers/page.jsx

import Subscribers from "@/components/Dashboard/DashboardContent/BizBuddyPanel/Subscribers";
import DashboardSkeleton from "@/app/dashboard/DashboardSkeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function SubscribersPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Subscribers />
    </Suspense>
  );
}
