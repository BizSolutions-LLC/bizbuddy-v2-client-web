/* components/Dashboard/DashboardContent/TimeKeeping/Punch.jsx */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Coffee,
  Sandwich,
  MapPin,
  AlertCircle,
  Check,
  Timer,
  LogOut,
  LogIn,
  Loader2,
  Calendar,
  RefreshCw,
  Play,
  Pause,
  Activity,
  Building2,
  Car,
  UserCheck,
  CalendarX,
  Info,
} from "lucide-react";

import LocationGuard from "@/components/common/LocationGuard";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (t = 0) =>
  [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

const getDeviceInfo = () =>
  typeof window === "undefined"
    ? {}
    : {
        brand: "web",
        manufacturer: "web",
        modelName: navigator.platform,
        modelId: navigator.userAgent,
        osName: navigator.userAgentData?.platform || "browser",
        osVersion: navigator.userAgent,
        deviceName: navigator.vendor || "browser",
      };

function fetchLocation() {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ── Haversine distance (meters) ────────────────────────────────────────────────
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Punch type constants ───────────────────────────────────────────────────────
const PUNCH_TYPES = {
  REGULAR:       "REGULAR",
  DRIVER_AIDE:   "DRIVER_AIDE",    // actual Driver employee — full day
  DRIVER_AIDE_AM:"DRIVER_AIDE_AM", // non-driver covered AM slot (early clock-in)
  DRIVER_AIDE_PM:"DRIVER_AIDE_PM", // non-driver covered PM slot (late clock-out)
};

// Driver-aide threshold is now configurable via company settings.
// The value is fetched from /api/company-settings on mount; falls back to 45.

// ── Badge label/colour helpers ─────────────────────────────────────────────────
const PUNCH_TYPE_LABELS = {
  [PUNCH_TYPES.REGULAR]:        { label: "Regular",        icon: UserCheck, color: "purple" },
  [PUNCH_TYPES.DRIVER_AIDE]:    { label: "Driver / Aide",  icon: Car,       color: "blue"   },
  [PUNCH_TYPES.DRIVER_AIDE_AM]: { label: "Driver AM",      icon: Car,       color: "blue"   },
  [PUNCH_TYPES.DRIVER_AIDE_PM]: { label: "Driver PM",      icon: Car,       color: "blue"   },
};

const BADGE_COLOR_CLASSES = {
  blue:   "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800",
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function Punch() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Session
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [isTimedIn, setIsTimedIn]     = useState(false);
  const [timeInAt, setTimeInAt]       = useState(null);
  const [elapsed, setElapsed]         = useState(0);

  // Breaks
  const [coffeeActive, setCoffeeActive]   = useState(false);
  const [coffeeStart, setCoffeeStart]     = useState(null);
  const [coffeeElapsed, setCoffeeElapsed] = useState(0);
  const [coffeeCount, setCoffeeCount]     = useState(0);
  const [lunchActive, setLunchActive]     = useState(false);
  const [lunchStart, setLunchStart]       = useState(null);
  const [lunchElapsed, setLunchElapsed]   = useState(0);

  // Location
  const [location, setLocation]               = useState({ latitude: null, longitude: null });
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationChecking, setLocationChecking] = useState(false);
  const [assignedLocations, setAssignedLocations] = useState([]);
  // "checking" | "inside" | "outside" | "unavailable" | null (null = no restrictions)
  const [locationStatus, setLocationStatus] = useState(null);
  const locationIntervalRef = useRef(null);

  // Employee info
  const [employeeInfo, setEmployeeInfo]               = useState({ companyId: null, companyName: null, jobTitle: null, isDriver: false });
  const [employeeInfoLoading, setEmployeeInfoLoading] = useState(true);

  // Today's scheduled shift — fetched on mount alongside employee info
  // { shiftName, scheduledStartMs, scheduledEndMs } | null
  const [todayShift, setTodayShift]               = useState(undefined);
  const [todayShiftLoading, setTodayShiftLoading] = useState(true);

  // Punch type state
  const [punchTypeModalOpen, setPunchTypeModalOpen] = useState(false);
  const [selectedPunchType, setSelectedPunchType]   = useState(null);
  const [activePunchType, setActivePunchType]       = useState(null);
  // Context stored so the punch type modal knows which scenario triggered it
  // "timein_early" | "timeout_late" | null
  const [punchTypeContext, setPunchTypeContext]     = useState(null);

  // No-schedule info modal (all companies)
  const [noScheduleModalOpen, setNoScheduleModalOpen] = useState(false);
  // Stores the pending action to resume after dismissing the no-schedule modal
  // "timein" | "timeout"
  const [pendingActionAfterModal, setPendingActionAfterModal] = useState(null);
  const [noScheduleRemarks, setNoScheduleRemarks] = useState("");

  // Confirmation dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction]         = useState(null);

  // Driver-aide threshold — loaded from company settings, defaults to 45
  const [driverAideThresholdMinutes, setDriverAideThresholdMinutes] = useState(45);

  // Shift assignment window — loaded from company settings, defaults to 30
  // Minutes before scheduled start where driver punch is auto-snapped to shift boundary
  const [shiftAssignmentWindowMinutes, setShiftAssignmentWindowMinutes] = useState(30);

  // When set, overrides localTimestamp in the time-in API call (driver snap-to-schedule)
  const [pendingSnapTimestamp, setPendingSnapTimestamp] = useState(null);

  // Auto-lunch config — loaded from employment details (department settings)
  // null means not configured / dept has no paid lunch
  const [autoLunchConfig, setAutoLunchConfig] = useState(null);

  // ── Derived flags ────────────────────────────────────────────────────────────
  const DAYCARE_COMPANY_IDS = (process.env.NEXT_PUBLIC_DAYCARE_COMPANY_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

  const isDayCare = DAYCARE_COMPANY_IDS.includes(employeeInfo.companyId);

  const isDriver = employeeInfo.isDriver;

  // Non-driver DayCare employee — the only group that sees the Early/Late modal
  const isDayCareNonDriver = isDayCare && !isDriver;

  // Auto-lunch is due when: timed in, threshold crossed, no lunch started or taken yet
  const autoLunchDue =
    isTimedIn &&
    autoLunchConfig !== null &&
    elapsed >= autoLunchConfig.afterHours * 3600 &&
    !lunchActive &&
    lunchElapsed === 0;

  // ── Location on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    setLocationLoading(true);
    fetchLocation().then((loc) => {
      setLocation(loc);
      setLocationLoading(false);
    });
  }, []);

  // ── Proactive location restriction check ─────────────────────────────────────
  const checkLocationStatus = useCallback(async (locations) => {
    if (!locations || locations.length === 0) { setLocationStatus(null); return; }
    setLocationStatus("checking");
    const coords = await fetchLocation();
    setLocation(coords);
    if (!coords.latitude || !coords.longitude) {
      setLocationStatus("unavailable");
      return;
    }
    const inside = locations.some((loc) =>
      getDistance(parseFloat(loc.latitude), parseFloat(loc.longitude), coords.latitude, coords.longitude)
        <= parseFloat(loc.radius)
    );
    setLocationStatus(inside ? "inside" : "outside");
  }, []);

  // Run once when assigned locations are loaded, then every 60 s
  useEffect(() => {
    if (assignedLocations.length === 0) { setLocationStatus(null); return; }
    checkLocationStatus(assignedLocations);
    locationIntervalRef.current = setInterval(() => checkLocationStatus(assignedLocations), 60000);
    return () => clearInterval(locationIntervalRef.current);
  }, [assignedLocations, checkLocationStatus]);

  // ── Employee info + today's shift on mount ────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setEmployeeInfoLoading(true);
    setTodayShiftLoading(true);

    Promise.all([
      fetch(`${API_URL}/api/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/api/employment-details/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/api/timelogs/today-shift`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/api/company-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null),
      fetch(`${API_URL}/api/location/assigned`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).catch(() => null),
    ])
      .then(([profileRes, employmentRes, shiftRes, settingsRes, locationRes]) => {
        setEmployeeInfo({
          companyId:   profileRes?.data?.company?.id   || null,
          companyName: profileRes?.data?.company?.name || null,
          jobTitle:    employmentRes?.data?.jobTitle   || null,
          isDriver:    employmentRes?.data?.isDriver   ?? false,
        });

        // /api/location/assigned returns only locations assigned to the current user
        if (Array.isArray(locationRes?.data)) {
          setAssignedLocations(locationRes.data);
        }
        // null = no shift today, object = shift found
        setTodayShift(shiftRes?.data ?? null);
        // Use configured threshold or fall back to 45
        const threshold = settingsRes?.data?.driverAideThresholdMinutes;
        if (typeof threshold === "number" && threshold > 0) {
          setDriverAideThresholdMinutes(threshold);
        }
        const assignmentWindow = settingsRes?.data?.shiftAssignmentWindowMinutes;
        if (typeof assignmentWindow === "number" && assignmentWindow > 0) {
          setShiftAssignmentWindowMinutes(assignmentWindow);
        }

        // Auto-lunch config from employment details (department settings)
        const dept = employmentRes?.data?.department;
        if (dept?.paidBreak && dept?.autoLunchDurationMinutes && dept?.autoLunchAfterHours) {
          setAutoLunchConfig({
            durationMinutes: dept.autoLunchDurationMinutes,
            afterHours:      dept.autoLunchAfterHours,
          });
        }
      })
      .catch(() => {
        setTodayShift(null);
      })
      .finally(() => {
        setEmployeeInfoLoading(false);
        setTodayShiftLoading(false);
      });
  }, [token]);

  // ── Active log hydration ──────────────────────────────────────────────────────
  const fetchActiveLog = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/timelogs/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok && Array.isArray(d.data)) {
        const active = d.data.find((l) => l.status);
        if (active) {
          setIsTimedIn(true);
          const ti = +new Date(active.timeIn);
          setTimeInAt(ti);
          setElapsed(Math.floor((Date.now() - ti) / 1000));
          setActivePunchType(active.punchType ?? PUNCH_TYPES.REGULAR);

          if (active.coffeeBreaks?.length) {
            const last = active.coffeeBreaks.at(-1);
            setCoffeeCount(active.coffeeBreaks.length - (last?.end ? 0 : 1));
            if (last && !last.end) {
              setCoffeeActive(true);
              const cs = +new Date(last.start);
              setCoffeeStart(cs);
              setCoffeeElapsed(Math.floor((Date.now() - cs) / 1000));
            }
          }
          if (active.lunchBreak?.start && !active.lunchBreak?.end) {
            setLunchActive(true);
            const ls = +new Date(active.lunchBreak.start);
            setLunchStart(ls);
            setLunchElapsed(Math.floor((Date.now() - ls) / 1000));
          }
        } else {
          resetAll();
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchActiveLog();
  }, [token]);

  // ── Tick interval ─────────────────────────────────────────────────────────────
  const intervalRef = useRef(null);
  useEffect(() => {
    if (isTimedIn) {
      intervalRef.current = setInterval(() => {
        if (timeInAt)                       setElapsed(Math.floor((Date.now() - timeInAt) / 1000));
        if (coffeeActive && coffeeStart)    setCoffeeElapsed(Math.floor((Date.now() - coffeeStart) / 1000));
        if (lunchActive  && lunchStart)     setLunchElapsed(Math.floor((Date.now() - lunchStart) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isTimedIn, coffeeActive, lunchActive, timeInAt, coffeeStart, lunchStart]);

  // ── Reset all session state ───────────────────────────────────────────────────
  const resetAll = () => {
    setIsTimedIn(false);
    setTimeInAt(null);
    setElapsed(0);
    setCoffeeActive(false);
    setCoffeeStart(null);
    setCoffeeElapsed(0);
    setCoffeeCount(0);
    setLunchActive(false);
    setLunchStart(null);
    setLunchElapsed(0);
    setActivePunchType(null);
    setSelectedPunchType(null);
    setPunchTypeContext(null);
    setPendingSnapTimestamp(null);
    setNoScheduleRemarks("");
  };

  // ── Shared API caller ─────────────────────────────────────────────────────────
  async function doCall(endpoint, extraBody = {}) {
    setLoading(true);
    setLocationLoading(true);
    const loc = await fetchLocation();
    setLocation(loc);
    setLocationLoading(false);

    if (!loc.latitude && !loc.longitude) {
      toast.message("Location services disabled or location data unavailable. Please allow location to punch.", {
        description: "Check your browser settings and try again.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        duration: 5000,
      });
      setLoading(false);
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/api/timelogs${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceInfo:     getDeviceInfo(),
          location:       loc,
          localTimestamp: new Date().toISOString(),
          ...extraBody,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Request failed");
      toast.message(d.message || "Success", {
        icon: <Check className="h-5 w-5 text-orange-500" />,
      });
      return true;
    } catch (e) {
      toast.message(e.message, {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        duration: 5000,
      });
      return false;
    } finally {
      setLoading(false);
    }
  }

  // ── Schedule threshold helpers ────────────────────────────────────────────────

  // Returns how many minutes before the scheduled start the employee is punching in.
  // Positive = early, negative = on-time or late.
  const minutesEarlyForTimeIn = () => {
    if (!todayShift?.scheduledStartMs) return 0;
    return (todayShift.scheduledStartMs - Date.now()) / 60000;
  };

  // Returns how many minutes past the scheduled end the employee is punching out.
  // Positive = late, negative = on-time or early.
  const minutesLateForTimeOut = () => {
    if (!todayShift?.scheduledEndMs) return 0;
    return (Date.now() - todayShift.scheduledEndMs) / 60000;
  };

  const formatShiftTime = (ms) => {
    if (!ms) return "--:--";
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ── Core punch handler ────────────────────────────────────────────────────────
  const handlePunch = async () => {
    // Guard: can't time out while a break is active
    if (isTimedIn && (coffeeActive || lunchActive)) {
      toast.message("End active break first.", {
        description: "You need to end your current break before timing out.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }

    // ── Location restriction guard — re-verify live before proceeding ──────────
    if (assignedLocations.length > 0) {
      setLocationChecking(true);
      const coords = await fetchLocation();
      setLocation(coords);
      setLocationChecking(false);

      if (!coords.latitude || !coords.longitude) {
        setLocationStatus("unavailable");
        return;
      }

      const inside = assignedLocations.some((loc) =>
        getDistance(parseFloat(loc.latitude), parseFloat(loc.longitude), coords.latitude, coords.longitude)
          <= parseFloat(loc.radius)
      );

      setLocationStatus(inside ? "inside" : "outside");
      if (!inside) return;
    }

    const action = isTimedIn ? "timeout" : "timein";

    // ── No schedule today — show info modal for ALL companies ──────────────────
    // todayShift === null means loaded and confirmed empty.
    // todayShift === undefined means still loading — skip check to avoid flicker.
    if (!isTimedIn && todayShift === null && !todayShiftLoading) {
      setPendingActionAfterModal(action);
      setNoScheduleModalOpen(true);
      return;
    }

    proceedWithPunch(action);
  };

  // Called after dismissing the no-schedule modal, or directly from handlePunch
  // when a schedule exists.
  const proceedWithPunch = (action) => {
    if (action === "timein") {
      handleTimeInLogic();
    } else {
      handleTimeOutLogic();
    }
  };

  // ── Time-in routing ───────────────────────────────────────────────────────────
  const handleTimeInLogic = () => {
    // Driver (DayCare) → always DRIVER_AIDE, no modal.
    // If punching within the shift assignment window, snap time to scheduled start.
    if (isDayCare && isDriver) {
      const earlyMins = minutesEarlyForTimeIn();
      const withinWindow =
        !!todayShift?.scheduledStartMs &&
        earlyMins > 0 &&
        earlyMins <= shiftAssignmentWindowMinutes;
      setSelectedPunchType(PUNCH_TYPES.DRIVER_AIDE);
      setPendingSnapTimestamp(
        withinWindow ? new Date(todayShift.scheduledStartMs).toISOString() : null
      );
      setConfirmAction("timein");
      setConfirmDialogOpen(true);
      return;
    }

    // DayCare non-driver + 45+ min early → show AM driver-aide modal
    if (isDayCareNonDriver && minutesEarlyForTimeIn() >= driverAideThresholdMinutes) {
      setSelectedPunchType(null);
      setPunchTypeContext("timein_early");
      setPunchTypeModalOpen(true);
      return;
    }

    // All other cases → REGULAR, straight to confirmation
    setSelectedPunchType(PUNCH_TYPES.REGULAR);
    setConfirmAction("timein");
    setConfirmDialogOpen(true);
  };

  // ── Time-out routing ──────────────────────────────────────────────────────────
  const handleTimeOutLogic = () => {
    // DayCare non-driver + 45+ min late → show PM driver-aide modal
    if (isDayCareNonDriver && minutesLateForTimeOut() >= driverAideThresholdMinutes) {
      setSelectedPunchType(null);
      setPunchTypeContext("timeout_late");
      setPunchTypeModalOpen(true);
      return;
    }

    // All other time-outs → straight to confirmation, no punchType update needed
    setConfirmAction("timeout");
    setConfirmDialogOpen(true);
  };

  // ── Punch type modal confirm ──────────────────────────────────────────────────
  const handlePunchTypeConfirm = () => {
    if (!selectedPunchType) return;
    setPunchTypeModalOpen(false);

    if (punchTypeContext === "timein_early") {
      setConfirmAction("timein");
    } else {
      // timeout_late
      setConfirmAction("timeout");
    }
    setConfirmDialogOpen(true);
  };

  // ── Confirmation dialog confirm ───────────────────────────────────────────────
  const confirmPunch = async () => {
    const isTimeIn = confirmAction === "timein";

    // For time-in: send selectedPunchType if set (covers DRIVER_AIDE and DRIVER_AIDE_AM)
    // For time-out: send selectedPunchType only if it's DRIVER_AIDE_PM (updating the log)
    const extraBody = {};

    // Punch type
    if (isTimeIn && selectedPunchType) {
      extraBody.punchType = selectedPunchType;
    } else if (!isTimeIn && selectedPunchType === PUNCH_TYPES.DRIVER_AIDE_PM) {
      extraBody.punchType = selectedPunchType;
    }
  
    // No-schedule remark — separate check, not else if
    if (isTimeIn && noScheduleRemarks.trim()) {
      extraBody.remarks = [{
        type:      "no_schedule",
        message:   noScheduleRemarks.trim(),
        timestamp: new Date().toISOString(),
      }];
    }

    // Snap-to-schedule for drivers within shift assignment window
    if (isTimeIn && pendingSnapTimestamp) {
      extraBody.localTimestamp = pendingSnapTimestamp;
    }

    // Auto-lunch deduction signal — sent on time-out when threshold was crossed
    // and the employee never manually started a lunch break
    if (!isTimeIn && autoLunchDue && autoLunchConfig) {
      extraBody.autoLunchApplied   = true;
      extraBody.autoLunchMinutes   = autoLunchConfig.durationMinutes;
    }

    const ok = await doCall(isTimeIn ? "/time-in" : "/time-out", extraBody);
    if (!ok) return;

    if (isTimeIn) {
      const now = Date.now();
      setIsTimedIn(true);
      setTimeInAt(now);
      setElapsed(0);
      setActivePunchType(selectedPunchType ?? PUNCH_TYPES.REGULAR);
    } else {
      resetAll();
    }

    setConfirmDialogOpen(false);
    setConfirmAction(null);
    setSelectedPunchType(null);
    setPunchTypeContext(null);
    setPendingSnapTimestamp(null);
  };

  // ── Break handlers ────────────────────────────────────────────────────────────
  const handleCoffee = async () => {
    if (!isTimedIn) {
      toast.message("You must be timed-in.", {
        description: "Time in first before taking a coffee break.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }
    if (!coffeeActive && coffeeCount >= 2) {
      toast.message("Coffee-break limit reached.", {
        description: "You've already taken your allowed coffee breaks for today.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }
    const ok = await doCall(coffeeActive ? "/coffee-break/end" : "/coffee-break/start");
    if (!ok) return;
    if (coffeeActive) {
      setCoffeeActive(false);
      setCoffeeStart(null);
      setCoffeeElapsed(0);
      setCoffeeCount((c) => c + 1);
    } else {
      setCoffeeActive(true);
      setCoffeeStart(Date.now());
      setCoffeeElapsed(0);
    }
  };

  const handleLunch = async () => {
    if (!isTimedIn) {
      toast.message("You must be timed-in.", {
        description: "Time in first before taking a lunch break.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }
    if (!lunchActive && lunchElapsed > 0) {
      toast.message("Lunch break already taken.", {
        description: "You've already taken your lunch break for today.",
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
      return;
    }
    const ok = await doCall(lunchActive ? "/lunch-break/end" : "/lunch-break/start");
    if (!ok) return;
    if (lunchActive) {
      setLunchActive(false);
      setLunchStart(null);
      setLunchElapsed(0);
    } else {
      setLunchActive(true);
      setLunchStart(Date.now());
      setLunchElapsed(0);
    }
  };

  const refreshStatus = () => {
    setRefreshing(true);
    fetchActiveLog().finally(() => setRefreshing(false));
  };

  const formatTimeDisplay = (timestamp) => {
    if (!timestamp) return "--:--";
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const coffeeProgress = (coffeeCount / 2) * 100;

  // ── Punch type modal copy ─────────────────────────────────────────────────────
  const punchTypeModalTitle = punchTypeContext === "timein_early"
    ? "Early Clock-In Detected"
    : "Late Clock-Out Detected";

  const punchTypeModalDesc = punchTypeContext === "timein_early"
    ? `You are clocking in ${Math.round(minutesEarlyForTimeIn())} minutes before your scheduled start${todayShift?.shiftName ? ` (${todayShift.shiftName} — ${formatShiftTime(todayShift.scheduledStartMs)})` : ""}. Are you covering a Driver/Aide AM slot?`
    : `You are clocking out ${Math.round(minutesLateForTimeOut())} minutes after your scheduled end${todayShift?.shiftName ? ` (${todayShift.shiftName} — ${formatShiftTime(todayShift.scheduledEndMs)})` : ""}. Did you cover a Driver/Aide PM slot?`;

  // Which punch type to assign for each option depending on context
  const driverAidePunchType = punchTypeContext === "timein_early"
    ? PUNCH_TYPES.DRIVER_AIDE_AM
    : PUNCH_TYPES.DRIVER_AIDE_PM;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <LocationGuard>
      <TooltipProvider delayDuration={300}>
        <div className="max-w-5xl mx-auto p-4 lg:px-8 space-y-8">
          <Toaster position="top-center" />

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
                  <Clock className="h-8 w-8" />
                </div>
                Punch
              </h2>
            </div>
            <div className="flex gap-3 items-center">
              <Button
                variant="outline"
                className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-black"
                asChild
              >
                <Link href="/dashboard/employee/punch-logs">
                  <Timer className="h-4 w-4" />
                  Punch logs
                </Link>
              </Button>
              <IconBtn
                icon={RefreshCw}
                tooltip="Refresh"
                spinning={refreshing}
                onClick={refreshStatus}
              />
            </div>
          </motion.div>

          {/* Session Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-2 shadow-xl overflow-hidden bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-800">
              <div className={`h-2 w-full ${
                isTimedIn
                  ? "bg-orange-500"
                  : "bg-gradient-to-r from-neutral-300 to-neutral-400 dark:from-neutral-600 dark:to-neutral-700"
              }`} />

              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ scale: isTimedIn ? [1, 1.1, 1] : 1 }}
                      transition={{ repeat: isTimedIn ? Number.POSITIVE_INFINITY : 0, duration: 2 }}
                      className={`p-3 rounded-2xl ${
                        isTimedIn
                          ? "bg-orange-500 text-white shadow-lg"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {isTimedIn ? <Activity className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                    </motion.div>
                    <div>
                      <span className="text-2xl font-bold">{isTimedIn ? "On the Clock" : "Off the Clock"}</span>
                      {timeInAt && (
                        <p className="text-sm text-muted-foreground">Started at {formatTimeDisplay(timeInAt)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Company + Role badge (DayCare only) */}
                    {isDayCare && (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                        {employeeInfoLoading ? (
                          <Badge variant="outline" className="animate-pulse">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 cursor-help gap-1">
                                <Building2 className="h-3 w-3" />
                                {employeeInfo.companyName}
                                {employeeInfo.jobTitle && (
                                  <>
                                    <span className="text-green-400 dark:text-green-500">·</span>
                                    {employeeInfo.jobTitle}
                                  </>
                                )}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{employeeInfo.companyName} — {employeeInfo.jobTitle}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </motion.div>
                    )}

                    {/* Active punch type badge — visible only while timed in for DayCare */}
                    <AnimatePresence>
                      {isTimedIn && activePunchType && isDayCare && (() => {
                        const meta = PUNCH_TYPE_LABELS[activePunchType] ?? PUNCH_TYPE_LABELS[PUNCH_TYPES.REGULAR];
                        const Icon = meta.icon;
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className={`${BADGE_COLOR_CLASSES[meta.color]} cursor-help gap-1`}>
                                  <Icon className="h-3 w-3" /> {meta.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Clocked in as {meta.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>

                    {/* Location badge */}
                    <AnimatePresence mode="wait">
                      {/* Has location restriction — show zone status */}
                      {locationStatus === "checking" ? (
                        <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Badge variant="outline" className="animate-pulse gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking location...
                          </Badge>
                        </motion.div>
                      ) : locationStatus === "inside" ? (
                        <motion.div key="inside" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 cursor-help gap-1">
                                <Check className="h-3 w-3" /> Within Work Zone
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>You are within your designated work location.</p></TooltipContent>
                          </Tooltip>
                        </motion.div>
                      ) : locationStatus === "outside" ? (
                        <motion.div key="outside" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 cursor-help gap-1">
                                <AlertCircle className="h-3 w-3" /> Outside Work Zone
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>You must be at your designated work location to punch.</p></TooltipContent>
                          </Tooltip>
                        </motion.div>
                      ) : locationStatus === "unavailable" ? (
                        <motion.div key="unavailable" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 cursor-help gap-1">
                                <AlertCircle className="h-3 w-3" /> GPS Unavailable
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Enable location services to punch in/out.</p></TooltipContent>
                          </Tooltip>
                        </motion.div>
                      ) : locationLoading ? (
                        <motion.div key="locating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Badge variant="outline" className="animate-pulse gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Locating...
                          </Badge>
                        </motion.div>
                      ) : location.latitude ? (
                        <motion.div key="active" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 cursor-help gap-1">
                                <MapPin className="h-3 w-3" /> Location Active
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>GPS location is active and working.</p></TooltipContent>
                          </Tooltip>
                        </motion.div>
                      ) : (
                        <motion.div key="disabled" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 cursor-help gap-1">
                                <AlertCircle className="h-3 w-3" /> Location Required
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent><p>Enable location services to punch in/out.</p></TooltipContent>
                          </Tooltip>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-8 pt-0">
                <div className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-4">
                    <Badge className={`px-4 py-2 text-sm font-semibold ${
                      isTimedIn
                        ? "bg-orange-500 text-white shadow-md"
                        : "bg-gradient-to-r from-neutral-500 to-neutral-600 text-white"
                    }`}>
                      {isTimedIn ? "ACTIVE SESSION" : "NO ACTIVE SESSION"}
                    </Badge>
                    {timeInAt && (
                      <span className="text-sm text-muted-foreground">Started at {formatTimeDisplay(timeInAt)}</span>
                    )}
                  </div>
                  {isTimedIn && (
                    <motion.div
                      key={elapsed}
                      initial={{ scale: 1.1 }}
                      animate={{ scale: 1 }}
                      className="text-4xl font-mono font-bold text-orange-600 dark:text-orange-400"
                    >
                      {fmt(elapsed)}
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Metric icon={<Timer className="h-6 w-6" />} label="Work Session" value={fmt(elapsed)} active={isTimedIn} />
                  <Metric
                    icon={<Coffee className="h-6 w-6" />}
                    label="Coffee Break"
                    value={fmt(coffeeElapsed)}
                    active={coffeeActive}
                    progress={coffeeProgress}
                    progressLabel={`${coffeeCount}/2 breaks`}
                    disabled={!isTimedIn || (!coffeeActive && coffeeCount >= 2)}
                  />
                  <Metric
                    icon={<Sandwich className="h-6 w-6" />}
                    label="Lunch Break"
                    value={fmt(lunchElapsed)}
                    active={lunchActive}
                    disabled={!isTimedIn || (!lunchActive && lunchElapsed > 0)}
                  />
                </div>
                {/* Auto-lunch banner */}
                <AnimatePresence>
                  {autoLunchDue && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700"
                    >
                      <Sandwich className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                          Lunch break recommended
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                          You've been working for over {autoLunchConfig.afterHours}h. A {autoLunchConfig.durationMinutes}-minute lunch will be auto-applied on time-out if no manual lunch is taken.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>

              <CardFooter className="flex flex-col gap-6 pt-4 pb-8">
                {/* Location restriction banners */}
                <AnimatePresence>
                  {locationStatus === "outside" && (
                    <motion.div
                      key="outside-banner"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40"
                    >
                      <MapPin className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-red-800 dark:text-red-200">
                          Outside designated work location
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          You must be within <span className="font-semibold">{assignedLocations.map((l) => l.name).join(" or ")}</span> to punch in or out.
                        </p>
                      </div>
                      <button
                        onClick={() => checkLocationStatus(assignedLocations)}
                        className="shrink-0 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline underline-offset-2 transition-colors"
                      >
                        Recheck
                      </button>
                    </motion.div>
                  )}
                  {locationStatus === "unavailable" && (
                    <motion.div
                      key="unavailable-banner"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/40"
                    >
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-orange-800 dark:text-orange-200">
                          GPS unavailable
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                          Your location is required to verify you're at your work site. Enable GPS and try again.
                        </p>
                      </div>
                      <button
                        onClick={() => checkLocationStatus(assignedLocations)}
                        className="shrink-0 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 underline underline-offset-2 transition-colors"
                      >
                        Retry
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  whileHover={{ scale: locationStatus === "outside" || locationStatus === "unavailable" ? 1 : 1.02 }}
                  whileTap={{ scale: locationStatus === "outside" || locationStatus === "unavailable" ? 1 : 0.98 }}
                  className="w-full"
                >
                  <Button
                    size="lg"
                    className={`w-full text-xl font-bold h-16 transition-all shadow-lg ${
                      locationStatus === "outside" || locationStatus === "unavailable"
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        : employeeInfoLoading || todayShiftLoading
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        : isTimedIn
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-white"
                    }`}
                    disabled={loading || locationChecking || employeeInfoLoading || todayShiftLoading || locationStatus === "outside" || locationStatus === "unavailable"}
                    onClick={handlePunch}
                  >
                    {locationChecking || locationStatus === "checking" ? (
                      <><Loader2 className="h-6 w-6 animate-spin mr-3" /> Checking Location...</>
                    ) : locationStatus === "outside" ? (
                      <><MapPin className="h-6 w-6 mr-3" /> Outside Work Zone</>
                    ) : locationStatus === "unavailable" ? (
                      <><AlertCircle className="h-6 w-6 mr-3" /> GPS Unavailable</>
                    ) : loading ? (
                      <Loader2 className="h-6 w-6 animate-spin mr-3" />
                    ) : employeeInfoLoading || todayShiftLoading ? (
                      <><Loader2 className="h-6 w-6 animate-spin mr-3" /> Loading...</>
                    ) : isTimedIn ? (
                      <><LogOut className="h-6 w-6 mr-3" /> TIME OUT</>
                    ) : (
                      <><LogIn className="h-6 w-6 mr-3" /> TIME IN</>
                    )}
                  </Button>
                </motion.div>

                <AnimatePresence>
                  {isTimedIn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              className={`w-full h-14 transition-all border-2 ${
                                coffeeActive
                                  ? "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-300 hover:from-orange-200 hover:to-orange-300 dark:from-orange-900 dark:to-orange-800 dark:text-orange-200 dark:border-orange-700"
                                  : coffeeCount >= 2
                                  ? "opacity-60 cursor-not-allowed"
                                  : "border-orange-300 text-orange-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 dark:border-orange-700 dark:text-orange-400 dark:hover:from-orange-950 dark:hover:to-orange-900"
                              }`}
                              disabled={loading || (!coffeeActive && coffeeCount >= 2)}
                              onClick={handleCoffee}
                            >
                              {coffeeActive ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                              <Coffee className="h-5 w-5 mr-2" />
                              {coffeeActive ? "End Coffee Break" : "Start Coffee Break"}
                            </Button>
                          </motion.div>
                        </TooltipTrigger>
                        {!coffeeActive && coffeeCount >= 2 && (
                          <TooltipContent><p>You've reached your coffee break limit (2/2)</p></TooltipContent>
                        )}
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              className={`w-full h-14 transition-all border-2 ${
                                lunchActive
                                  ? "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-300 hover:from-orange-200 hover:to-orange-300 dark:from-orange-900 dark:to-orange-800 dark:text-orange-200 dark:border-orange-700"
                                  : lunchElapsed > 0
                                  ? "opacity-60 cursor-not-allowed"
                                  : "border-orange-300 text-orange-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 dark:border-orange-700 dark:text-orange-400 dark:hover:from-orange-950 dark:hover:to-orange-900"
                              }`}
                              disabled={loading || (!lunchActive && lunchElapsed > 0)}
                              onClick={handleLunch}
                            >
                              {lunchActive ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                              <Sandwich className="h-5 w-5 mr-2" />
                              {lunchActive ? "End Lunch Break" : "Start Lunch Break"}
                            </Button>
                          </motion.div>
                        </TooltipTrigger>
                        {!lunchActive && lunchElapsed > 0 && (
                          <TooltipContent><p>You've already taken your lunch break today</p></TooltipContent>
                        )}
                      </Tooltip>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardFooter>
            </Card>
          </motion.div>

          {/* Today's Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-2 shadow-lg bg-gradient-to-br from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-800">
              <div className="h-1 w-full bg-orange-500" />
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500 text-white">
                    <Calendar className="h-5 w-5" />
                  </div>
                  Today's Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <SummaryItem label="Work Time"     value={fmt(elapsed)}                              icon={<Timer className="h-5 w-5" />}    color="blue"   />
                  <SummaryItem label="Coffee Breaks" value={`${coffeeCount}/2`}                        icon={<Coffee className="h-5 w-5" />}   color="orange" />
                  <SummaryItem label="Lunch Break"   value={lunchElapsed > 0 ? "Taken" : "Not Taken"} icon={<Sandwich className="h-5 w-5" />} color="orange" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ════════════════════════════════════════════════════════════════════
              NO SCHEDULE TODAY — Info modal (all companies)
              Gentle reminder, non-blocking. Employee can still punch in.
          ════════════════════════════════════════════════════════════════════ */}
          <Dialog open={noScheduleModalOpen} onOpenChange={setNoScheduleModalOpen}>
            <DialogContent
              className="sm:max-w-md border-2 bg-gradient-to-br from-white to-yellow-50 dark:from-neutral-900 dark:to-yellow-950"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <div className="h-2 w-full bg-yellow-500 -mt-6 mb-4 rounded-t-lg" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-yellow-500 text-white">
                    <CalendarX className="h-5 w-5" />
                  </div>
                  No Schedule Today
                </DialogTitle>
                <DialogDescription>
                  No scheduled shift found. Please explain why you are clocking in.
                </DialogDescription>
              </DialogHeader>
 
              {/* Info notice */}
              <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    This session will not be linked to any scheduled shift.
                    Your reason will be visible to your supervisor during payroll review.
                  </p>
                </div>
              </div>
 
              {/* Required reason field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <span className="text-red-500">*</span> Reason for clocking in
                </label>
                <textarea
                  value={noScheduleRemarks}
                  onChange={(e) => setNoScheduleRemarks(e.target.value)}
                  placeholder="e.g. Supervisor asked me to cover for a colleague, make-up day, emergency coverage..."
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-yellow-400 dark:focus:border-yellow-500 resize-none transition-colors"
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-neutral-400">Required — minimum 10 characters</p>
                  <p className={`text-xs ${noScheduleRemarks.length >= 300 ? "text-red-500" : "text-neutral-400"}`}>
                    {noScheduleRemarks.length}/300
                  </p>
                </div>
              </div>
 
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNoScheduleModalOpen(false);
                    setPendingActionAfterModal(null);
                    setNoScheduleRemarks("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                  disabled={noScheduleRemarks.trim().length < 10}
                  onClick={() => {
                    setNoScheduleModalOpen(false);
                    const action = pendingActionAfterModal;
                    setPendingActionAfterModal(null);
                    proceedWithPunch(action);
                    // remarks are picked up by confirmPunch via noScheduleRemarks state
                  }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Clock In Anyway
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ════════════════════════════════════════════════════════════════════
              PUNCH TYPE MODAL — DayCare non-driver, early clock-in or late clock-out
              Cannot be dismissed by clicking outside.
          ════════════════════════════════════════════════════════════════════ */}
          <Dialog open={punchTypeModalOpen} onOpenChange={(open) => {
            if (!open) {
              setPunchTypeModalOpen(false);
              setSelectedPunchType(null);
              setPunchTypeContext(null);
            }
          }}>
            <DialogContent
              className="sm:max-w-md border-2 bg-gradient-to-br from-white to-orange-50 dark:from-neutral-900 dark:to-orange-950"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <div className="h-2 w-full bg-orange-500 -mt-6 mb-4 rounded-t-lg" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500 text-white">
                    {punchTypeContext === "timein_early" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                  </div>
                  {punchTypeModalTitle}
                </DialogTitle>
                <DialogDescription>{punchTypeModalDesc}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-2">
                {/* Regular option */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedPunchType(PUNCH_TYPES.REGULAR)}
                  className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedPunchType === PUNCH_TYPES.REGULAR
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950 shadow-md"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/30"
                  }`}
                >
                  <div className={`p-3 rounded-xl ${
                    selectedPunchType === PUNCH_TYPES.REGULAR
                      ? "bg-purple-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                  }`}>
                    <UserCheck className="h-7 w-7" />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${
                      selectedPunchType === PUNCH_TYPES.REGULAR
                        ? "text-purple-700 dark:text-purple-300"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}>Regular</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {punchTypeContext === "timein_early" ? "Just clocking in early" : "Just clocking out late"}
                    </p>
                  </div>
                  {selectedPunchType === PUNCH_TYPES.REGULAR && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-purple-500" />
                    </div>
                  )}
                </motion.button>

                {/* Driver / Aide option */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedPunchType(driverAidePunchType)}
                  className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedPunchType === driverAidePunchType
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md"
                      : "border-neutral-200 dark:border-neutral-700 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
                  }`}
                >
                  <div className={`p-3 rounded-xl ${
                    selectedPunchType === driverAidePunchType
                      ? "bg-blue-500 text-white"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                  }`}>
                    <Car className="h-7 w-7" />
                  </div>
                  <div className="text-center">
                    <p className={`font-bold text-sm ${
                      selectedPunchType === driverAidePunchType
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}>
                      {punchTypeContext === "timein_early" ? "Driver / Aide AM" : "Driver / Aide PM"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {punchTypeContext === "timein_early" ? "Covering AM transport slot" : "Covering PM transport slot"}
                    </p>
                  </div>
                  {selectedPunchType === driverAidePunchType && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-blue-500" />
                    </div>
                  )}
                </motion.button>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPunchTypeModalOpen(false);
                    setSelectedPunchType(null);
                    setPunchTypeContext(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePunchTypeConfirm}
                  disabled={!selectedPunchType || loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ════════════════════════════════════════════════════════════════════
              CONFIRMATION DIALOG
          ════════════════════════════════════════════════════════════════════ */}
          <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <DialogContent className="sm:max-w-md border-2 bg-gradient-to-br from-white to-orange-50 dark:from-neutral-900 dark:to-orange-950">
              <div className="h-2 w-full bg-orange-500 -mt-6 mb-4 rounded-t-lg" />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500 text-white">
                    {confirmAction === "timein" ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                  </div>
                  Confirm {confirmAction === "timein" ? "Time In" : "Time Out"}
                </DialogTitle>
                <DialogDescription>
                  {confirmAction === "timein"
                    ? "Are you sure you want to start your work session? Make sure you're at your designated work location."
                    : "Are you sure you want to end your work session? This will complete your current time log entry."}
                </DialogDescription>
              </DialogHeader>

              {/* Punch type recap — shown when a type was explicitly selected */}
              {selectedPunchType && (() => {
                const meta = PUNCH_TYPE_LABELS[selectedPunchType] ?? PUNCH_TYPE_LABELS[PUNCH_TYPES.REGULAR];
                const Icon = meta.icon;
                const isDriverType = meta.color === "blue";
                return (
                  <div className={`p-4 rounded-xl border ${
                    isDriverType
                      ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                      : "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg text-white ${isDriverType ? "bg-blue-500" : "bg-purple-500"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Punch Type</p>
                        <p className="text-sm text-muted-foreground">{meta.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recognized time — shows snapped scheduled time for drivers within window */}
              <div className="p-4 rounded-xl bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500 text-white">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    {pendingSnapTimestamp ? (
                      <>
                        <p className="font-medium">Recognized Time <span className="text-xs font-normal text-muted-foreground">(snapped to schedule)</span></p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(pendingSnapTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Current Time</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setPendingSnapTimestamp(null); }} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmPunch}
                  disabled={loading}
                  className={
                    confirmAction === "timein"
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : "bg-red-500 hover:bg-red-600 text-white"
                  }
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : confirmAction === "timein" ? (
                    <><LogIn className="h-4 w-4 mr-2" /> Confirm Time In</>
                  ) : (
                    <><LogOut className="h-4 w-4 mr-2" /> Confirm Time Out</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </TooltipProvider>
    </LocationGuard>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Metric({ icon, label, value, active, progress, progressLabel, disabled }) {
  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      className={`rounded-2xl border-2 p-6 transition-all shadow-lg ${disabled ? "opacity-60" : ""} ${
        active
          ? "bg-orange-500 text-white shadow-xl"
          : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:shadow-xl"
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-3 rounded-xl ${
          active
            ? "bg-white/20 text-white"
            : "bg-gradient-to-r from-neutral-100 to-neutral-200 text-neutral-600 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-400"
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${active ? "text-white/90" : "text-neutral-600 dark:text-neutral-400"}`}>
            {label}
          </p>
        </div>
        {active && <Badge className="bg-white/20 text-white border-white/30 text-xs">Active</Badge>}
      </div>

      <div className={`font-mono text-3xl font-bold text-center my-4 ${
        active ? "text-white" : "text-neutral-800 dark:text-neutral-200"
      }`}>
        {value}
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-2">
            <span className={active ? "text-white/80" : "text-muted-foreground"}>Coffee Breaks</span>
            <span className={active ? "text-white/80" : "text-muted-foreground"}>{progressLabel}</span>
          </div>
          <Progress
            value={progress}
            className={`h-2 ${
              active
                ? "[&>div]:bg-white/80 bg-white/20"
                : "[&>div]:bg-orange-500 bg-neutral-200 dark:bg-neutral-700"
            }`}
          />
        </div>
      )}
    </motion.div>
  );
}

function SummaryItem({ label, value, icon, color }) {
  const colorClasses = {
    blue:   "bg-orange-500",
    orange: "bg-orange-500",
  };
  return (
    <div className="text-center p-4 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 border border-neutral-200 dark:border-neutral-600">
      <div className={`inline-flex p-3 rounded-xl ${colorClasses[color]} text-white mb-3`}>{icon}</div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  );
}

const IconBtn = ({ icon: Icon, tooltip, spinning, ...props }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
          {...props}
        >
          <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);