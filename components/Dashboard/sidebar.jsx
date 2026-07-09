// components/Dashboard/DashboardContent/sidebar.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import Link from "next/link";
import useAuthStore from "@/store/useAuthStore";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, ChevronDown, Building2, User, Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Navigation config
// ---------------------------------------------------------------------------

const EmployeePanelItems = [
  {
    id: "overview",
    label: "Overview",
    children: [{ id: "employee/overview", label: "Overview" }],
  },
  {
    id: "my-profile",
    label: "Profile",
    children: [
      { id: "employee/personal-employment-identifications", label: "Personal Identification" },
      { id: "employee/employment-details", label: "Employment Details" },
    ],
  },
  {
    id: "time-keeping",
    label: "Time Keeping",
    children: [
      { id: "employee/punch", label: "Punch" },
      { id: "employee/punch-logs", label: "Punch logs" },
      { id: "employee/overtime", label: "Overtime" },
      { id: "employee/contest-time-logs", label: "Contest Time Logs" },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    children: [{ id: "employee/schedule", label: "My Schedule" }],
  },
  {
    id: "leaves",
    label: "Leaves",
    children: [{ id: "employee/leave-logs", label: "Leave Logs" }],
  },
];

function getPayrollItems(role) {
  const roleLower = role.toLowerCase();
  if (["admin", "supervisor", "superadmin"].includes(roleLower)) {
    return {
      id: "payroll",
      label: "Payroll",
      children: [
        { id: "employee/payroll", label: "Payroll Management" },
        { id: "employee/payslip", label: "My Payslip" },
      ],
    };
  }
  return {
    id: "payroll",
    label: "Payroll",
    children: [{ id: "employee/payslip", label: "My Payslip" }],
  };
}

const CompanyPanelItems = [
  {
    id: "organizations&people",
    label: "Organizations & People",
    children: [
      { id: "company/departments", label: "Departments" },
      { id: "company/employees", label: "Employees" },
      { id: "company/employee-deletion", label: "Employee Account Deletion", notifyKey: "deletion" },
    ],
  },
  {
    id: "punch-logs",
    label: "Requests & Logs",
    children: [
      { id: "company/employee-schedules", label: "Employee Schedule", notifyKey: "unscheduled", variant: "dot" },
      { id: "company/punch-logs", label: "Employees Punch logs" },
      { id: "company/contest-requests", label: "Employee Requests", notifyKey: "contest" },
      { id: "company/leave-requests", label: "Employees Leave Requests", notifyKey: "leave" },
      { id: "company/overtime-requests", label: "Employees Overtime Requests", notifyKey: "overtime" },
      { id: "company/cutoff-periods", label: "Employee Cutoff", notifyKey: "cutoff" },
    ],
  },
  {
    id: "shifts&schedules",
    label: "Shifts & Schedules",
    children: [
      { id: "company/shifts", label: "Company Shift Templates" },
      { id: "company/schedules", label: "Employees Schedule" },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    children: [{ id: "company/locations", label: "Employees Location Restriction" }],
  },
  {
    id: "account",
    label: "Settings",
    children: [
      { id: "company/profile", label: "Profile" },
      { id: "company/configurations", label: "Configurations" },
      { id: "company/notifications", label: "Notifications" },
      { id: "company/subscription", label: "Subscription", notifyKey: "subscription", variant: "dot" },
      { id: "company/deletion", label: "Deletion" },
    ],
  },
];

const ReferralPanelItems = [
  {
    id: "referral",
    label: "Referral",
    children: [{ id: "referral/referral", label: "Referral" }],
  },
];

// ---------------------------------------------------------------------------
// Plan locking
// ---------------------------------------------------------------------------

const FREE_ALLOWED = new Set([
  "employee/punch",
  "employee/overtime",
  "employee/punch-logs",
  "employee/contest-requests",
  "employee/schedule",
  "employee/payslip",
  "employee/payroll",
  "company/punch-logs",
  "company/contest-requests",
  "company/deletion",
  "company/profile",
  "company/subscription",
]);

function lockChildByPlan(child, plan) {
  switch (plan) {
    case "pro":
      return { ...child, locked: false, requiredPlan: null };
    case "basic": {
      const locked = child.id === "company/locations";
      return { ...child, locked, requiredPlan: locked ? "Pro" : null };
    }
    default: {
      const locked = !FREE_ALLOWED.has(child.id);
      return { ...child, locked, requiredPlan: locked ? "Basic" : null };
    }
  }
}

function filterCompanyPanelByRole(items, role) {
  const r = role.toLowerCase();
  if (r === "employee") return [];
  if (r === "supervisor")
    return items.filter((g) => ["organizations&people", "punch-logs"].includes(g.id));
  return items;
}

function getBizBuddyItems(role) {
  return role.toLowerCase() === "superadmin"
    ? [
        {
          id: "referrer",
          label: "Referrer",
          children: [{ id: "bizbuddy/referrers", label: "Referrer" }],
        },
        {
          id: "subscribers",
          label: "Subscribers",
          children: [{ id: "bizbuddy/subscribers", label: "Subscribers" }],
        },
      ]
    : [];
}

function applyPlanLock(groups, plan) {
  return groups.map((g) => ({
    ...g,
    children: g.children.map((c) => lockChildByPlan(c, plan)),
  }));
}

// ---------------------------------------------------------------------------
// ✅ Unified notification resolver
//    Centralises ALL count/dot logic so every component just reads this map.
// ---------------------------------------------------------------------------

/**
 * Given the raw counts, returns a flat map:
 *   notifyKey → { count: number, variant: "badge" | "dot" }
 *
 * "dot" keys only ever show a coloured circle (no number).
 * "badge" keys show a red numbered badge.
 */
function buildNotifyMap({ contest, overtime, leave, deletion, cutoff, unscheduled, subscriptionExpiring }) {
  return {
    contest:      { count: contest,      variant: "badge" },
    overtime:     { count: overtime,     variant: "badge" },
    leave:        { count: leave,        variant: "badge" },
    deletion:     { count: deletion,     variant: "badge" },
    cutoff:       { count: cutoff,       variant: "badge" },
    unscheduled:  { count: unscheduled,  variant: "dot"   },   // dot — no number shown
    subscription: { count: subscriptionExpiring ? 1 : 0, variant: "dot" },
  };
}

/**
 * Returns the total badge count for a group (used on the parent header button).
 * Dot-only keys are excluded because they don't carry a meaningful count.
 */
function groupBadgeCount(group, notifyMap) {
  return group.children.reduce((sum, child) => {
    if (!child.notifyKey) return sum;
    const entry = notifyMap[child.notifyKey];
    if (!entry || entry.variant === "dot") return sum;
    return sum + (entry.count || 0);
  }, 0);
}

/** Returns true if any child in the group has a dot-type notification active. */
function groupHasDot(group, notifyMap) {
  return group.children.some((child) => {
    if (!child.notifyKey) return false;
    const entry = notifyMap[child.notifyKey];
    return entry?.variant === "dot" && entry.count > 0;
  });
}

// ---------------------------------------------------------------------------
// Notification badge components
// ---------------------------------------------------------------------------

/** A clean numbered badge — no redundant dot alongside it. */
function NotifyBadge({ count, size = "md" }) {
  if (!count || count <= 0) return null;
  const sizeClass = size === "sm"
    ? "text-[9px] px-1 py-0 min-w-[16px] h-4"
    : "text-[10px] px-1.5 py-0.5 min-w-[20px] h-5";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-red-500 font-semibold text-white flex-shrink-0 ${sizeClass}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** A simple pulsing dot — used for non-numeric alerts (schedule, subscription). */
function NotifyDot({ color = "orange" }) {
  const bg = color === "orange" ? "bg-orange-500" : "bg-red-500";
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse ${bg}`} />;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-700">
        <Skeleton className="h-8 w-28" />
        <div className="flex gap-2">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col items-center p-3 sm:p-4 lg:p-6 border-b border-neutral-200 dark:border-neutral-700">
        <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full mb-2 sm:mb-3" />
        <Skeleton className="h-3 sm:h-4 w-24 sm:w-32 mb-1 sm:mb-2" />
        <Skeleton className="h-2 sm:h-3 w-16 sm:w-20 mb-2 sm:mb-3" />
        <div className="flex w-full justify-between items-center">
          <Skeleton className="h-2 sm:h-3 w-20 sm:w-24" />
          <Skeleton className="h-4 sm:h-5 w-10 sm:w-12 rounded-full" />
        </div>
      </div>
      <div className="px-2 sm:px-3 lg:px-4 py-3 sm:py-4 space-y-4 sm:space-y-6 lg:space-y-8 flex-1 overflow-y-auto">
        {[...Array(2)].map((_, g) => (
          <div key={g}>
            <Skeleton className="h-3 sm:h-4 w-20 sm:w-24 mb-2 sm:mb-4" />
            {[...Array(3)].map((__, i) => (
              <div key={i} className="mb-2 sm:mb-3">
                <Skeleton className="h-8 sm:h-9 lg:h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleNavItem — now purely driven by notifyMap
// ---------------------------------------------------------------------------

function CollapsibleNavItem({ item, currentPath, onNavigate, expanded, onToggle, notifyMap = {} }) {
  // ✅ Aggregate badge count & dot state from the unified map
  const totalBadge = groupBadgeCount(item, notifyMap);
  const hasDot     = groupHasDot(item, notifyMap);

  return (
    <li className="mb-1 sm:mb-2 w-full">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onToggle(item.id)}
        className="flex w-full items-center gap-2
                   rounded-lg sm:rounded-xl border border-neutral-200 bg-white
                   px-3 sm:px-4 lg:px-5 sm:py-1 lg:py-2
                   text-xs sm:text-sm shadow-sm transition-all duration-200
                   hover:border-orange-200 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-50
                   dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-orange-700
                   dark:hover:from-orange-900 dark:hover:to-orange-900
                   min-h-[48px] sm:min-h-[52px] touch-manipulation"
      >
        <span className="text-neutral-700 dark:text-neutral-200 leading-tight flex-none truncate pr-2">
          {item.label}
        </span>

        {/* ✅ Right side: only one indicator at most */}
        <div className="flex items-center gap-2 ml-auto">
          {totalBadge > 0 ? (
            // Prefer badge count over dot when there are numbers to show
            <NotifyBadge count={totalBadge} size="sm" />
          ) : hasDot ? (
            <NotifyDot />
          ) : null}

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-neutral-500" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="mt-1 sm:mt-2 ml-1 sm:ml-2 space-y-0.5 sm:space-y-1 overflow-hidden"
          >
            {item.children.map((c, i) => {
              const route  = `/dashboard/${c.id}`;
              const active = currentPath === route;

              // ✅ Pull notification info from the unified map
              const notifyEntry = c.notifyKey ? notifyMap[c.notifyKey] : null;
              const childCount  = notifyEntry?.count  || 0;
              const childVariant = notifyEntry?.variant || "badge";

              return (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={c.locked ? "#" : route}
                    prefetch={false}
                    onClick={(e) => {
                      if (c.locked) { e.preventDefault(); return; }
                      onNavigate(route);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md sm:rounded-lg
                                px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3
                                text-xs sm:text-sm transition-all duration-200 border-l-2
                                ml-1 sm:ml-2 min-h-[44px] sm:min-h-[48px] touch-manipulation
                                ${active
                                  ? "bg-gradient-to-r from-orange-100 to-orange-100 dark:from-orange-900 dark:to-orange-900 border-l-orange-500 font-semibold text-orange-700 dark:text-orange-300 shadow-sm"
                                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800 border-l-transparent hover:border-l-neutral-300 dark:hover:border-l-neutral-600"
                                }
                                ${c.locked ? "cursor-not-allowed opacity-60" : "hover:shadow-sm"}`}
                  >
                    <span
                      className={`leading-tight flex-none truncate pr-2 ${
                        active
                          ? "text-orange-700 dark:text-orange-300"
                          : "text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      {c.label}
                    </span>

                    {/* ✅ Child right-side: single, clean indicator */}
                    <div className="flex items-center gap-2 ml-auto">
                      {childCount > 0 && (
                        childVariant === "dot"
                          ? <NotifyDot />
                          : <NotifyBadge count={childCount} size="sm" />
                      )}

                      {c.locked && c.requiredPlan && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 bg-amber-50 text-xs text-amber-700
                                     dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800
                                     px-2 py-0.5 flex-shrink-0 whitespace-nowrap"
                        >
                          <span>{c.requiredPlan}</span>
                          <Lock className="h-3 w-3" />
                        </Badge>
                      )}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

// ---------------------------------------------------------------------------
// SidebarUserInfo
// ---------------------------------------------------------------------------

function SidebarUserInfo({ profileData, plan }) {
  const usr  = profileData.user    || {};
  const prof = profileData.profile || {};
  const comp = profileData.company || {};
  const initials = (prof.firstName?.[0] || "") + (prof.lastName?.[0] || "");
  const name =
    prof.firstName || prof.lastName
      ? `${prof.firstName} ${prof.lastName}`.trim()
      : usr.username || "Unknown User";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 sm:p-4 lg:p-5 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
    >
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between gap-3">
          <motion.div whileHover={{ scale: 1.05 }} className="flex-shrink-0">
            <div className="relative">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg border-2 border-white dark:border-neutral-800">
                <span className="text-white font-bold text-lg sm:text-xl">
                  {initials.toUpperCase() || "?"}
                </span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full" />
            </div>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-neutral-500 dark:text-neutral-400 flex-shrink-0" />
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 truncate">
                {comp.name || "No Company"}
              </span>
            </div>
            <Badge className="capitalize text-[10px] sm:text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800">
              {plan} Plan
            </Badge>
          </div>
        </div>

        <div className="space-y-1 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {name}
          </h3>
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-neutral-400 flex-shrink-0" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize truncate">
              {usr.role}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SidebarHeader
// ---------------------------------------------------------------------------

function SidebarHeader({ isSidebarPinned, togglePin, closeSidebar }) {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      <Link href="/" className="flex items-center">
        <motion.img
          src="/logo.png"
          alt="BizBuddy"
          className="h-8 sm:h-9 w-auto"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2 }}
        />
      </Link>

      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={togglePin}
                className="flex items-center justify-center p-2 sm:p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200"
              >
                {isSidebarPinned
                  ? <PinOff className="w-4 h-4 text-orange-600" />
                  : <Pin    className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={closeSidebar}
                className="flex items-center justify-center p-2 sm:p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 transition-all duration-200 group"
              >
                <X className="w-4 h-4 text-neutral-600 dark:text-neutral-300 group-hover:text-red-500" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close sidebar</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({ isSidebarOpen, closeSidebar, onNavigateStart, isSidebarPinned, togglePin }) {
  const { token } = useAuthStore();
  const router    = useRouter();
  const pathname  = usePathname();

  const [profileData, setProfileData]               = useState(null);
  const [plan, setPlan]                             = useState("free");
  const [openDropdown, setOpenDropdown]             = useState(null);
  const [loading, setLoading]                       = useState(true);
  const [, startTransition]                         = useTransition();

  // ✅ All raw counts in one place
  const [counts, setCounts] = useState({
    contest:             0,
    overtime:            0,
    leave:               0,
    deletion:            0,
    cutoff:              0,
    unscheduled:         0,
    subscriptionExpiring: false,
  });

  // Fetch pending counts
  useEffect(() => {
    if (!token) return;
    const h    = { Authorization: `Bearer ${token}` };
    const base = process.env.NEXT_PUBLIC_API_URL;

    Promise.allSettled([
      fetch(`${base}/api/usershifts/company-stats`,                  { headers: h }).then((r) => r.json()),
      fetch(`${base}/api/contest-policy/view-allContestTimeLogs`,    { headers: h }).then((r) => r.json()),
      fetch(`${base}/api/overtime`,                                  { headers: h }).then((r) => r.json()),
      fetch(`${base}/api/leaves`,                                    { headers: h }).then((r) => r.json()),
      fetch(`${base}/api/account-deletion/get-request`,             { headers: h }).then((r) => r.json()),
      fetch(`${base}/api/cutoff-periods`,                            { headers: h }).then((r) => r.json()),
    ]).then(([shifts, contest, overtime, leaves, deletion, cutoff]) => {
      setCounts((prev) => ({
        ...prev,
        unscheduled: shifts.status  === "fulfilled" && shifts.value.data?.withoutShifts != null
          ? shifts.value.data.withoutShifts : prev.unscheduled,
        contest:  contest.status  === "fulfilled" && Array.isArray(contest.value.data)
          ? contest.value.data.filter((c) => c.status?.toLowerCase() === "pending").length : prev.contest,
        overtime: overtime.status === "fulfilled" && Array.isArray(overtime.value.data)
          ? overtime.value.data.filter((o) => o.status?.toLowerCase() === "pending").length : prev.overtime,
        leave:    leaves.status   === "fulfilled" && Array.isArray(leaves.value.data)
          ? leaves.value.data.filter((l) => l.status?.toLowerCase() === "pending").length : prev.leave,
        deletion: deletion.status === "fulfilled" && Array.isArray(deletion.value.data)
          ? deletion.value.data.filter((r) => r.status?.toLowerCase() === "pending").length : prev.deletion,
        cutoff:   cutoff.status   === "fulfilled" && Array.isArray(cutoff.value.data)
          ? cutoff.value.data.filter((p) => p.status?.toLowerCase() === "locked").length : prev.cutoff,
      }));
    });
  }, [token]);

  // Fetch profile
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setProfileData(d.data);
          const p = d.data.subscription?.plan?.name?.toLowerCase() || "free";
          setPlan(p);
          useAuthStore.setState((state) => ({ ...state, plan: p }));
          const endDate = d.data.subscription?.endDate;
          if (endDate) {
            const daysLeft = (new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24);
            setCounts((prev) => ({ ...prev, subscriptionExpiring: daysLeft <= 30 }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // ✅ Build the single unified notify map
  const notifyMap = buildNotifyMap(counts);

  const navigate = (route) => {
    if (onNavigateStart) onNavigateStart();
    closeSidebar?.();
    startTransition(() => router.push(route));
  };

  const role    = profileData?.user?.role || "employee";
  const roleLower = role.toLowerCase();

  const payrollItem            = getPayrollItems(role);
  const employeePanelWithPayroll = [...EmployeePanelItems, payrollItem];

  const features  = applyPlanLock(employeePanelWithPayroll, plan);
  const settings  = applyPlanLock(filterCompanyPanelByRole(CompanyPanelItems, roleLower), plan);
  const bizbuddy  = getBizBuddyItems(role);

  const toggle = (id) => setOpenDropdown(openDropdown === id ? null : id);

  if (!token) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: isSidebarOpen ? 0 : "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 z-50 h-screen w-[300px] sm:w-[320px] md:w-[340px] lg:w-[320px] xl:w-[340px] max-w-[85vw] bg-gradient-to-b from-white via-neutral-50 to-white dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 border-r border-neutral-200 dark:border-neutral-700 shadow-2xl"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {loading || !profileData ? (
            <SidebarSkeleton />
          ) : (
            <>
              <SidebarHeader
                isSidebarPinned={isSidebarPinned}
                togglePin={togglePin}
                closeSidebar={closeSidebar}
              />

              <SidebarUserInfo profileData={profileData} plan={plan} />

              <div className="flex-1 overflow-y-auto px-2 sm:px-3 lg:px-4 py-3 sm:py-4 lg:py-6 space-y-3 sm:space-y-4 lg:space-y-6 scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600">

                {/* Employee Panel */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <h2 className="mb-1 sm:mb-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1 sm:gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full flex-shrink-0" />
                    <span className="truncate">Employee Panel</span>
                  </h2>
                  <ul className="space-y-0.5 sm:space-y-1">
                    {features.map((g, index) => (
                      <motion.div
                        key={g.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <CollapsibleNavItem
                          item={g}
                          currentPath={pathname}
                          onNavigate={navigate}
                          expanded={openDropdown === g.id}
                          onToggle={toggle}
                          notifyMap={notifyMap}
                        />
                      </motion.div>
                    ))}
                  </ul>
                </motion.div>

                {/* Company Panel */}
                {settings.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="mb-1 sm:mb-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1 sm:gap-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full flex-shrink-0" />
                      <span className="truncate">Company Panel</span>
                    </h2>
                    <ul className="space-y-0.5 sm:space-y-1">
                      {settings.map((g, index) => (
                        <motion.div
                          key={g.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + index * 0.05 }}
                        >
                          <CollapsibleNavItem
                            item={g}
                            currentPath={pathname}
                            onNavigate={navigate}
                            expanded={openDropdown === g.id}
                            onToggle={toggle}
                            notifyMap={notifyMap}
                          />
                        </motion.div>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {/* BizBuddy Panel */}
                {bizbuddy.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="mb-1 sm:mb-2 px-1 sm:px-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1 sm:gap-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full flex-shrink-0" />
                      <span className="truncate">BizBuddy Panel</span>
                    </h2>
                    <ul className="space-y-0.5 sm:space-y-1">
                      {bizbuddy.map((g, index) => (
                        <motion.div
                          key={g.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.05 }}
                        >
                          <CollapsibleNavItem
                            item={g}
                            currentPath={pathname}
                            onNavigate={navigate}
                            expanded={openDropdown === g.id}
                            onToggle={toggle}
                            notifyMap={notifyMap}
                          />
                        </motion.div>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}