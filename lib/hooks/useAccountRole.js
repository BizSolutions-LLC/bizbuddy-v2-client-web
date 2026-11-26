// lib/hooks/useAccountRole.js
// BB-151: the signed-in user's role. useAuthStore has no `role` and the sign-in token carries
// none either, so it comes from GET /api/account/profile (data.user.role), as the sidebar does.
"use client";

import { useEffect, useState } from "react";
import useAuthStore from "@/store/useAuthStore";

export const ADMIN_ROLES = ["admin", "superadmin"];

export default function useAccountRole() {
  const { token } = useAuthStore();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRole(d?.data?.user?.role?.toLowerCase() || null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  return { role, isAdmin: ADMIN_ROLES.includes(role || ""), loading };
}
