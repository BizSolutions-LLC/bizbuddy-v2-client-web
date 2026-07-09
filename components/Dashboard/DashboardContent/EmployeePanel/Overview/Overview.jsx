// components/Dashboard/DashboardContent/Features/Overview/Overview.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import OverviewSuperadmin from "./OverviewSuperadmin";
import OverviewAdmin from "./OverviewAdmin";
import OverviewEmployee from "./OverviewEmployee";

export default function Overview() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("employee");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API}/api/account/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Profile fetch error");
        setMe({ role: j.data.user.role.toLowerCase() });
      } catch (e) {
        toast.message(e.message);
      }
      setLoading(false);
    })();
  }, [API, token]);

  const roleButtons = useMemo(() => {
    if (!me) return [];
    switch (me.role) {
      case "superadmin":
        return ["super", "admin", "employee"];
      case "admin":
        return ["admin", "employee"];
      default:
        return ["employee"];
    }
  }, [me]);

  useEffect(() => {
    if (roleButtons.length) setMode(roleButtons[0]);
  }, [roleButtons]);

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
      <Toaster position="top-center" />
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-4 mb-6 border border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-orange-500" />
            <h1 className="text-xl font-semibold">Overview</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {roleButtons.map((r) => (
                <Button
                  key={r}
                  variant={mode === r ? "default" : "outline"}
                  onClick={() => setMode(r)}
                  size="sm"
                  className={mode === r ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                >
                  {r === "super" ? "Super-Admin" : r.charAt(0).toUpperCase() + r.slice(1)}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-black"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="animate-in fade-in duration-300">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : mode === "super" ? (
          <OverviewSuperadmin key={refreshKey} />
        ) : mode === "admin" ? (
          <OverviewAdmin key={refreshKey} />
        ) : (
          <OverviewEmployee key={refreshKey} />
        )}
      </div>
    </div>
  );
}
