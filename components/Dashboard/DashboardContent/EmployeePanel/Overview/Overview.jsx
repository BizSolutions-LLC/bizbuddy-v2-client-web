// components/Dashboard/DashboardContent/EmployeePanel/Overview/Overview.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

// BB-133: page shell. Picks the view by role and remounts it on Refresh:
//   superadmin → platform view; admin → company view;
//   supervisor → tabs "My team" (admin-dashboard, scoped to their team by the server) | "Me";
//   everyone else → their own view.

import { useEffect, useState } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import OverviewSuperadmin from "./OverviewSuperadmin";
import OverviewAdmin from "./OverviewAdmin";
import OverviewEmployee from "./OverviewEmployee";
import { OverviewSkeleton } from "./OverviewShared";

const SUBTITLE = {
  super: "Platform activity, growth and revenue across all companies.",
  admin: "How your company is doing: attendance, hours and leave.",
  team: "How your team is doing: attendance, hours and leave.",
  employee: "Your hours and attendance for the selected period.",
};
const SUPERVISOR_TABS = [
  { id: "team", label: "My team" },
  { id: "employee", label: "Me" },
];

export default function Overview() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [supervisorTab, setSupervisorTab] = useState("team");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API}/api/account/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || j.message || "Profile fetch error");
        const role = j.data.user.role.toLowerCase();
        setMode(role === "superadmin" ? "super" : role === "admin" ? "admin" : role === "supervisor" ? "supervisor" : "employee");
      } catch (e) {
        toast.message(e.message);
        setMode("employee");
      }
      setLoading(false);
    })();
  }, [API, token]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <Toaster position="top-center" />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-orange-500" />
            Overview
          </h1>
          {mode && <p className="text-sm text-muted-foreground mt-1">{SUBTITLE[mode === "supervisor" ? supervisorTab : mode]}</p>}
        </div>
        <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {mode === "supervisor" && (
        <div className="flex gap-1 border-b" role="tablist">
          {SUPERVISOR_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={supervisorTab === t.id}
              onClick={() => setSupervisorTab(t.id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
                supervisorTab === t.id
                  ? "border-orange-500 text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <OverviewSkeleton />
      ) : mode === "supervisor" ? (
        supervisorTab === "team" ? <OverviewAdmin key={`team-${refreshKey}`} /> : <OverviewEmployee key={`me-${refreshKey}`} />
      ) : mode === "super" ? (
        <OverviewSuperadmin key={refreshKey} />
      ) : mode === "admin" ? (
        <OverviewAdmin key={refreshKey} />
      ) : (
        <OverviewEmployee key={refreshKey} />
      )}
    </div>
  );
}
