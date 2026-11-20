"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";

const View = dynamic(
  () => import("@/components/Dashboard/DashboardContent/CompanyPanel/EmployeeLogins/EmployeeLogins"),
  { ssr: false, loading: () => null }
);

export default function Page() {
  const { token } = useAuthStore();
  const [state, setState] = useState("checking"); // "checking" | "ok" | "none"

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        const role = String(j?.data?.user?.role || "").toLowerCase();
        setState(ok && ["admin", "superadmin"].includes(role) ? "ok" : "none");
      })
      .catch(() => { if (!cancelled) setState("none"); });
    return () => { cancelled = true; };
  }, [token]);

  if (state === "none") notFound();
  if (state !== "ok") return null;
  return <View />;
}
