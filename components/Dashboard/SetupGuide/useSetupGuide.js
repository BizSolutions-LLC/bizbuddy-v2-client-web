// components/Dashboard/SetupGuide/useSetupGuide.js
// BB-115 — loads the setup checklist and keeps it fresh. There are no socket events, so it
// re-fetches on mount, on every route change (covers "came back from a step's page") and
// when the window regains focus. Actions return the updated checklist, which replaces state.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  getChecklist, skipStep, unskipStep, reviewStep, unreviewStep, dismissGuide, reopenGuide,
} from "@/lib/companySetupApi";

const ACTIONS = {
  skip:     (token, key) => skipStep(token, key),
  unskip:   (token, key) => unskipStep(token, key),
  review:   (token, key) => reviewStep(token, key),
  unreview: (token, key) => unreviewStep(token, key),
  dismiss:  (token)      => dismissGuide(token),
  reopen:   (token)      => reopenGuide(token),
};

export default function useSetupGuide(token, enabled) {
  const pathname = usePathname();
  const [checklist, setChecklist] = useState(null);
  const [busy,      setBusy]      = useState(null);  // "<action>:<key>" while an action runs
  const [error,     setError]     = useState(null);  // last action error, shown in the sheet
  const [forbidden, setForbidden] = useState(false); // 403 → stop asking
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!token || !enabled || forbidden) return;
    const id = ++requestId.current;
    try {
      const data = await getChecklist(token);
      if (id === requestId.current) setChecklist(data);
    } catch (e) {
      if (e.status === 403) setForbidden(true);
      // Other load failures keep the last checklist; the guide never blocks the sidebar.
    }
  }, [token, enabled, forbidden]);

  useEffect(() => { load(); }, [load, pathname]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, load]);

  const act = useCallback(async (action, key) => {
    setBusy(`${action}:${key || ""}`);
    setError(null);
    requestId.current++; // ignore any load already in flight
    try {
      setChecklist(await ACTIONS[action](token, key));
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  }, [token]);

  return { checklist: forbidden ? null : checklist, busy, error, act };
}
