"use client";

// BB-152: when this device's clock is in a different time zone from the company, an orange tab on
// the bottom edge (bottom-right; Feedback is bottom-left) shows the company's time live,
// "15:52:07 GMT+8". Clicking it opens a small card above the tab with the company time and this
// device's time, each with its zone. Compared by UTC offset, not by name (Manila and Singapore are
// both UTC+8: nothing shows), so travel and daylight-saving changes are picked up on the next tick.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";

// Minutes east of UTC for a time zone at a moment (e.g. Asia/Manila → 480)
function offsetMinutes(timeZone, date) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      }).formatToParts(date).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return null;
  }
}

// "15:52:07", the browser's short zone name ("GMT+8", "PST"; browsers have no "PHT"),
// a short date for the tab ("Nov 26") and a full one for the card ("Wed, Nov 26, 2026")
function clock(timeZone, date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value || "";
    return {
      time: `${get("hour")}:${get("minute")}:${get("second")}`,
      zone: get("timeZoneName"),
      shortDate: date.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" }),
      longDate: date.toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    };
  } catch {
    return { time: "—", zone: "", shortDate: "", longDate: "" };
  }
}

function TimeRow({ label, timeZone, now }) {
  const { time, zone, longDate } = clock(timeZone, now);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{timeZone}</p>
      </div>
      <div className="shrink-0 text-right">
        <p>
          <span className="font-display text-lg font-bold tabular-nums">{time}</span>
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">{zone}</span>
        </p>
        <p className="text-xs text-muted-foreground">{longDate}</p>
      </div>
    </div>
  );
}

export default function CompanyTimeBadge() {
  const { token } = useAuthStore();
  const [companyTz, setCompanyTz] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Company zone (all roles can read company settings)
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setCompanyTz(j?.data?.timezone || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  // Live clock (seconds)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close on a click outside or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!companyTz) return null;
  const companyOffset = offsetMinutes(companyTz, now);
  if (companyOffset == null || companyOffset === -now.getTimezoneOffset()) return null;

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const company = clock(companyTz, now);

  return (
    <div ref={rootRef} className="fixed right-4 bottom-24 sm:right-8 sm:bottom-0 z-40">
      {/* Card above the tab */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-80 rounded-xl border bg-card p-4 shadow-lg"
            role="dialog"
            aria-label="Company and local time"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Time zones</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              <TimeRow label="Company time" timeZone={companyTz} now={now} />
              <div className="border-t" />
              <TimeRow label="Your time" timeZone={deviceTz} now={now} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Punches, schedules and payroll follow the company time zone.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orange tab on the bottom edge (same look as the Feedback tab) */}
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 sm:py-3 shadow-lg
                   rounded-xl sm:rounded-b-none sm:rounded-t-xl transition-colors duration-150"
        aria-expanded={open}
        aria-label={`Company time ${company.shortDate} ${company.time} ${company.zone}`}
      >
        <Clock className="h-4 w-4" />
        <span className="text-sm font-semibold tracking-wide tabular-nums">
          {company.shortDate} · {company.time} {company.zone}
        </span>
      </motion.button>
    </div>
  );
}
