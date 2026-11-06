// lib/hooks/useImportTeam.js
//
// BB-108 follow-up: the people a bulk import can target. GET /api/employee/team
// (BB-080) gives admins the whole company and supervisors their own department
// plus their direct reports, the same rule the imports check. Active only: the
// imports refuse inactive people. Loaded when the dialog opens; falls back to
// the page's own list (`fallback`) if the request fails.

import { useEffect, useMemo, useState } from "react";

export default function useImportTeam(open, token, fallback = []) {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/employee/team`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && Array.isArray(json?.data)) setTeam(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  return useMemo(() => (team ?? fallback).filter((e) => e.status === "active"), [team, fallback]);
}
