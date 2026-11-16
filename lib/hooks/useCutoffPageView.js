// lib/hooks/useCutoffPageView.js
// BB-121: reads the company-wide Cutoff Page type (Company.cutoffPageView).
// Returns "calendar" only when the server says exactly "calendar"; anything else
// (missing field before server v2.11.12 is deployed, unknown value, failed call) is "list".
//
// Per-tab override (Calendar pages are a view-only preview for now): `?view=list` switches this
// browser tab to the List view, remembered in sessionStorage so the list ↔ review links stay in
// List view; `?view=calendar` clears it. Closing the tab resets to the company setting.

"use client";
import { useEffect, useState } from "react";
import useAuthStore from "@/store/useAuthStore";

const OVERRIDE_KEY = "bb121-cutoff-view-override";

const readOverride = () => {
  try {
    const param = new URLSearchParams(window.location.search).get("view");
    if (param === "list")     { sessionStorage.setItem(OVERRIDE_KEY, "list"); return "list"; }
    if (param === "calendar") { sessionStorage.removeItem(OVERRIDE_KEY); return null; }
    return sessionStorage.getItem(OVERRIDE_KEY) === "list" ? "list" : null;
  } catch {
    return null;
  }
};

export function useCutoffPageView() {
  const { token } = useAuthStore();
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (readOverride() === "list") { setView("list"); setLoading(false); return; }
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/company-settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled) setView(res.ok && json.data?.cutoffPageView === "calendar" ? "calendar" : "list");
      } catch {
        if (!cancelled) setView("list");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  return { view, loading };
}
