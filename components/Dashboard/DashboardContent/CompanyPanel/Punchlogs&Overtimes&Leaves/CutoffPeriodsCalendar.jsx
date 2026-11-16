// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffPeriodsCalendar.jsx
// BB-121: Calendar Type cutoff list page (/dashboard/company/cutoff-periods when
// Company.cutoffPageView = "calendar"). Same endpoints and actions as the List Type
// (shared via ./cutoffPeriodsShared). Uses only GET /api/cutoff-periods +
// departments + cutoff settings — never /approvals (hand-off: no per-period loads).
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  MoreVertical,
  Search,
  Building2,
  SlidersHorizontal,
  Trash2,
  Eye,
  Download,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FREQUENCY_LABELS,
  STATUS_CONFIG,
  formatDate,
  dateOnly,
  DeptConfigPanel,
  useCutoffPeriods,
  CutoffPeriodDialogs,
} from "./cutoffPeriodsShared";
import { CALENDAR_PREVIEW_ONLY as PREVIEW, PREVIEW_TIP, listViewHref } from "@/lib/cutoffCalendarPreview";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const GROUPS_PER_PAGE = 3;

const STATUS_TABS = [
  { id: "all",       label: "All" },
  { id: "open",      label: "Open" },
  { id: "locked",    label: "Locked" },
  { id: "processed", label: "Processed" },
];

const STATUS_DOT = {
  all:       "bg-neutral-400",
  open:      "bg-green-500",
  locked:    "bg-amber-500",
  processed: "bg-blue-500",
};

const todayMidnight = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

/** "Oct 28 – Nov 10, 2026" (year on the start too when the range crosses years) */
const formatRange = (start, end) => {
  const s = dateOnly(start);
  const e = dateOnly(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
  const eLabel = e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${sLabel} – ${eLabel}`;
};

/** "Fri, Nov 13" */
const formatPayDay = (d) =>
  d ? dateOnly(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—";

/** "Nov 13" */
const formatShort = (d) =>
  d ? dateOnly(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

const rangeKey = (p) => `${p.periodStart.slice(0, 10)}_${p.periodEnd.slice(0, 10)}`;

const statsOf = (p) => ({
  approved: p.approvalStats?.approved || 0,
  pending:  p.approvalStats?.pending  || 0,
  // Server rolls rejected into excluded (hand-off) — label it as excluded.
  excluded: p.approvalStats?.excluded || p.approvalStats?.rejected || 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return (
    <Badge className={`${cfg.color} gap-1.5 border-0 font-semibold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || STATUS_DOT.open}`} />
      {cfg.label}
    </Badge>
  );
};

/** Approved / pending / excluded bar with counts underneath */
const ApprovalBar = ({ period }) => {
  const { approved, pending, excluded } = statsOf(period);
  const total = approved + pending + excluded;

  if (period.status === "processed") {
    return <span className="text-xs text-neutral-500 dark:text-neutral-400">Paid out · read-only</span>;
  }

  if (total === 0) {
    return <span className="text-xs text-neutral-500 dark:text-neutral-400">No records synced yet</span>;
  }

  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1.5 min-w-[220px]">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        {/* widths are computed at runtime from the counts */}
        {approved > 0 && <div className="bg-green-500" style={{ width: pct(approved) }} />}
        {pending  > 0 && <div className="bg-amber-400" style={{ width: pct(pending) }} />}
        {excluded > 0 && <div className="bg-red-500"   style={{ width: pct(excluded) }} />}
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span><strong className="text-green-700 dark:text-green-400">{approved}</strong> approved</span>
        <span><strong className="text-amber-700 dark:text-amber-400">{pending}</strong> pending</span>
        <span><strong className="text-red-700 dark:text-red-400">{excluded}</strong> excluded</span>
      </div>
    </div>
  );
};

/** Open → Locked → Processed, with the period's current step highlighted */
const LIFECYCLE = ["open", "locked", "processed"];
const LifecycleSteps = ({ status }) => (
  <div className="flex items-center gap-1.5 mt-1.5">
    {LIFECYCLE.map((s, i) => {
      const current = s === status;
      return (
        <span key={s} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight className="w-3 h-3 text-neutral-400" />}
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${
            current
              ? `${STATUS_CONFIG[s].color} border-current`
              : "border-transparent bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          }`}>
            {STATUS_CONFIG[s].label}
          </span>
        </span>
      );
    })}
  </div>
);

/** One ⋮-menu action: icon box, title, one-line explanation */
const MenuAction = ({ icon: Icon, title, desc, danger, ...props }) => (
  <DropdownMenuItem
    {...props}
    className={`items-start gap-3 px-3 py-2.5 cursor-pointer ${danger ? "focus:bg-red-50 dark:focus:bg-red-950/30" : ""}`}
  >
    <span className={`mt-0.5 w-7 h-7 rounded-md border flex items-center justify-center flex-shrink-0 ${
      danger
        ? "border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30"
        : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
    }`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span className="min-w-0">
      <span className={`block text-sm font-semibold ${danger ? "text-red-600" : "text-neutral-800 dark:text-neutral-100"}`}>{title}</span>
      <span className={`block text-xs leading-snug mt-0.5 ${danger ? "text-red-600/80" : "text-neutral-500 dark:text-neutral-400"}`}>{desc}</span>
    </span>
  </DropdownMenuItem>
);

const AttentionCard = ({ tag, tagClass, title, body, action }) => (
  <Card className="shadow-sm">
    <CardContent className="p-4 flex flex-col h-full gap-2">
      <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-md ${tagClass}`}>{tag}</span>
      <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{title}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 flex-1">{body}</p>
      <div className="pt-1">{action}</div>
    </CardContent>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CutoffPeriodsCalendar() {
  const router = useRouter();
  const cp = useCutoffPeriods({ useCompanyName: true }); // no-department periods show the company name
  const {
    isSupport,
    departments, departmentSettings, cutoffPeriods,
    isLoading, isGenerating,
    setStatusConfirm, setIsReportPreviewOpen,
    handleGenerate, handleUpdateStatus, handleDelete,
    handleViewPayrollExport, handleDownloadPayrollExport, loadingAction,
    getDepartmentName, getDepartmentSetting,
    openConfigFor, openManual,
  } = cp;

  const [statusTab,      setStatusTab]      = useState("all");
  const [deptFilter,     setDeptFilter]     = useState("all"); // "all" | "none" | deptId
  const [search,         setSearch]         = useState("");
  const [groupsShown,    setGroupsShown]    = useState(GROUPS_PER_PAGE);
  const [scheduleOpen,   setScheduleOpen]   = useState(false);
  const [scheduleDeptId, setScheduleDeptId] = useState("");

  // Mark processed (Calendar page's own confirm: counts + payroll-released checkbox)
  const [processTarget,  setProcessTarget]  = useState(null); // period
  const [processAck,     setProcessAck]     = useState(false);
  const [processing,     setProcessing]     = useState(false);

  const openProcess = (period) => { setProcessTarget(period); setProcessAck(false); };
  const confirmProcess = async () => {
    if (PREVIEW) return;
    if (!processTarget || !processAck) return;
    setProcessing(true);
    await handleUpdateStatus(processTarget.id, "processed"); // same PATCH /status as the List page
    setProcessing(false);
    setProcessTarget(null);
  };

  const openSchedule = (deptId = "") => {
    setScheduleDeptId(deptId || departments[0]?.id || "");
    setScheduleOpen(true);
  };

  const goToReview = (period) => router.push(`/dashboard/company/cutoff-periods/${period.id}/review`);

  // ── Started periods only: future periods are hidden on this page ──
  const startedPeriods = useMemo(() => {
    const today = todayMidnight();
    return cutoffPeriods.filter((p) => dateOnly(p.periodStart) <= today);
  }, [cutoffPeriods]);

  // ── Needs your attention ─────────────────────────────────────────────────
  const attention = useMemo(() => {
    const today = todayMidnight();
    const cards = {};

    // 1) Open period with pending records — earliest payment date first
    const toReview = startedPeriods
      .filter((p) => p.status === "open" && statsOf(p).pending > 0)
      .sort((a, b) => dateOnly(a.paymentDate || a.periodEnd) - dateOnly(b.paymentDate || b.periodEnd));
    if (toReview.length) cards.review = { period: toReview[0], more: toReview.length - 1 };

    // 2) Locked periods whose payment date has passed (not yet marked processed)
    const overdue = startedPeriods
      .filter((p) => p.status === "locked" && p.paymentDate && dateOnly(p.paymentDate) < today)
      .sort((a, b) => dateOnly(a.periodStart) - dateOnly(b.periodStart));
    if (overdue.length) cards.overdue = overdue;

    // 3) Departments with periods or a schedule, but nothing starting after today
    const gaps = departments
      .map((d) => {
        const own = cutoffPeriods.filter((p) => p.departmentId === d.id);
        if (!own.length && !getDepartmentSetting(d.id)) return null;
        if (own.some((p) => dateOnly(p.periodStart) > today)) return null;
        const lastEnd = own.reduce((max, p) => (!max || p.periodEnd > max ? p.periodEnd : max), null);
        return { dept: d, lastEnd };
      })
      .filter(Boolean);
    if (gaps.length) cards.gaps = gaps;

    return cards;
  }, [startedPeriods, cutoffPeriods, departments, getDepartmentSetting]);

  // ── Counts for tabs and chips ────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const c = { all: startedPeriods.length, open: 0, locked: 0, processed: 0 };
    startedPeriods.forEach((p) => { if (c[p.status] !== undefined) c[p.status] += 1; });
    return c;
  }, [startedPeriods]);

  const deptPending = useMemo(() => {
    const c = { none: 0 };
    startedPeriods.forEach((p) => {
      const k = p.departmentId || "none";
      c[k] = (c[k] || 0) + statsOf(p).pending;
    });
    return c;
  }, [startedPeriods]);

  // ── Filtered + grouped rows ──────────────────────────────────────────────
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = startedPeriods.filter((p) => {
      if (statusTab !== "all" && p.status !== statusTab) return false;
      if (deptFilter === "none" && p.departmentId) return false;
      if (deptFilter !== "all" && deptFilter !== "none" && p.departmentId !== deptFilter) return false;
      if (q) {
        const hay = `${getDepartmentName(p.departmentId)} ${formatRange(p.periodStart, p.periodEnd)} ${formatDate(p.periodStart)} ${formatDate(p.periodEnd)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const byRange = new Map();
    filtered.forEach((p) => {
      const k = rangeKey(p);
      if (!byRange.has(k)) byRange.set(k, []);
      byRange.get(k).push(p);
    });

    const today = todayMidnight();
    const list = Array.from(byRange.values())
      .map((periods) => {
        periods.sort((a, b) => getDepartmentName(a.departmentId).localeCompare(getDepartmentName(b.departmentId)));
        const first = periods[0];
        const isCurrent = dateOnly(first.periodStart) <= today && dateOnly(first.periodEnd) >= today;
        return { key: rangeKey(first), periods, first, isCurrent };
      })
      .sort((a, b) => b.first.periodStart.localeCompare(a.first.periodStart));

    // Label: Current (contains today) · Previous (most recent past) · Earlier
    let pastSeen = 0;
    list.forEach((g) => {
      if (g.isCurrent) g.label = "Current";
      else g.label = pastSeen++ === 0 ? "Previous" : "Earlier";
    });
    return list;
  }, [startedPeriods, statusTab, deptFilter, search, getDepartmentName]);

  const visibleGroups = groups.slice(0, groupsShown);
  const visibleRows   = visibleGroups.reduce((n, g) => n + g.periods.length, 0);
  const totalRows     = groups.reduce((n, g) => n + g.periods.length, 0);

  const resetPaging = () => setGroupsShown(GROUPS_PER_PAGE);

  // ── Schedule dialog data ─────────────────────────────────────────────────
  const scheduleDept = departments.find((d) => d.id === scheduleDeptId);
  const scheduleUpcoming = useMemo(() => {
    const today = todayMidnight();
    return cutoffPeriods
      .filter((p) => p.departmentId === scheduleDeptId && dateOnly(p.periodStart) >= today)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .slice(0, 3);
  }, [cutoffPeriods, scheduleDeptId]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const chipClass = (active) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
      active
        ? "bg-orange-500 border-orange-500 text-white"
        : "bg-white border-neutral-200 text-neutral-700 hover:border-orange-300 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300"
    }`;

  const chipCount = (active, n) => (
    <span className={`px-1.5 rounded-full text-xs font-bold ${
      active ? "bg-white/25 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    }`}>
      {n}
    </span>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {PREVIEW && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-orange-900 dark:text-orange-200">
            <strong>Preview of the new Calendar view.</strong> Creating, locking, processing and approving cutoffs still happen in the List view.
          </p>
          <Button size="sm" variant="outline" className="bg-white dark:bg-neutral-900" onClick={() => { window.location.href = listViewHref(); }}>
            Open List view
          </Button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">
            Cutoff periods
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated payroll cutoffs for each department
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isSupport && (
            <Button variant="outline" size="icon" title="Preview Payroll Reports" onClick={() => setIsReportPreviewOpen(true)}>
              <Search className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => openSchedule()}>
            <SlidersHorizontal className="w-4 h-4" /> Configure schedule
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={PREVIEW ? undefined : openManual} disabled={PREVIEW} title={PREVIEW ? PREVIEW_TIP : ""}>
            <Plus className="w-4 h-4" /> Manual cutoff
          </Button>
        </div>
      </div>

      {/* ── Needs your attention ── */}
      {!isLoading && (attention.review || attention.overdue || attention.gaps) && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Needs your attention</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {attention.review && (() => {
              const { period, more } = attention.review;
              const s = statsOf(period);
              return (
                <AttentionCard
                  tag={`To review · pays ${formatShort(period.paymentDate)}`}
                  tagClass="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  title={`${getDepartmentName(period.departmentId)} · ${formatRange(period.periodStart, period.periodEnd)}`}
                  body={`${s.pending} record${s.pending === 1 ? "" : "s"} pending, ${s.excluded} excluded${more > 0 ? ` · ${more} more period${more === 1 ? "" : "s"} to review` : ""}`}
                  action={
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5" onClick={() => goToReview(period)}>
                      Review records <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  }
                />
              );
            })()}

            {attention.overdue && (() => {
              const list = attention.overdue;
              const first = list[0];
              const last  = list[list.length - 1];
              const lastPay = list.reduce((max, p) => (p.paymentDate > max ? p.paymentDate : max), list[0].paymentDate);
              const title = list.length === 1
                ? `${getDepartmentName(first.departmentId)} · ${formatRange(first.periodStart, first.periodEnd)} still locked`
                : `${list.length} periods from ${formatRange(first.periodStart, last.periodEnd)} still locked`;
              return (
                <AttentionCard
                  tag="Payment date passed"
                  tagClass="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  title={title}
                  body={`Paid ${formatShort(lastPay)} and not yet marked processed`}
                  action={
                    <Button size="sm" variant="outline" onClick={() => { setStatusTab("locked"); resetPaging(); }}>
                      Show locked periods
                    </Button>
                  }
                />
              );
            })()}

            {attention.gaps && (() => {
              const list = attention.gaps;
              const lastEnd = list.reduce((max, g) => (g.lastEnd && (!max || g.lastEnd > max) ? g.lastEnd : max), null);
              const names = list.map((g) => g.dept.name);
              const nameText = names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
              return (
                <AttentionCard
                  tag={lastEnd ? `Nothing scheduled after ${formatShort(lastEnd)}` : "Nothing scheduled"}
                  tagClass="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  title={`${nameText} ${names.length === 1 ? "has" : "have"} no upcoming period`}
                  body="Generate periods so new timesheets have a cutoff to land in"
                  action={
                    <Button size="sm" variant="outline" onClick={() => openSchedule(list[0].dept.id)}>
                      Set up {list[0].dept.name}
                    </Button>
                  }
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Periods table ── */}
      <Card className="shadow-sm overflow-hidden">
        {/* Status tabs */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {STATUS_TABS.map((t) => {
              const active = statusTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setStatusTab(t.id); resetPaging(); }}
                  className={`flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
                    active
                      ? "border-orange-500 text-neutral-900 dark:text-neutral-100"
                      : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.id]}`} />
                  {t.label}
                  <span className={`px-1.5 rounded-md text-xs font-bold ${
                    active ? "bg-orange-500 text-white" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}>
                    {statusCounts[t.id]}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Department chips + search */}
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className={chipClass(deptFilter === "all")} onClick={() => { setDeptFilter("all"); resetPaging(); }}>
              All departments
            </button>
            {departments.map((d) => {
              const active = deptFilter === d.id;
              const pending = deptPending[d.id] || 0;
              return (
                <button key={d.id} type="button" className={chipClass(active)} onClick={() => { setDeptFilter(d.id); resetPaging(); }}>
                  {d.name}
                  {pending > 0 && chipCount(active, pending)}
                </button>
              );
            })}
            <button type="button" className={chipClass(deptFilter === "none")} onClick={() => { setDeptFilter("none"); resetPaging(); }}>
              {getDepartmentName(null)}
              {deptPending.none > 0 && chipCount(deptFilter === "none", deptPending.none)}
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <Input
              placeholder="Search department or date"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
              className="pl-9 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Calendar className="w-12 h-12 mx-auto text-neutral-200 dark:text-neutral-700 mb-3" />
              <p className="font-semibold text-neutral-500">No cutoff periods found</p>
              <p className="text-sm text-neutral-400 mt-1">Try another filter, or create a period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    {["Department", "Status", "Approvals", "Next step"].map((h) => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 ${h === "Next step" ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                {visibleGroups.map((g) => {
                  const pays = g.first.paymentDate;
                  const paid = pays && dateOnly(pays) < todayMidnight();
                  return (
                    <tbody key={g.key}>
                      {/* Group header */}
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                        <td colSpan={4} className="px-4 py-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs font-extrabold uppercase tracking-wider ${g.isCurrent ? "text-orange-600" : "text-neutral-500"}`}>
                              {g.label}
                            </span>
                            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                              {formatRange(g.first.periodStart, g.first.periodEnd)}
                            </span>
                            {pays && (
                              <span className="text-xs text-neutral-500">
                                {paid ? "Paid" : "Pays"} {formatPayDay(pays)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {g.periods.map((period) => {
                        const s = statsOf(period);
                        const isOpen = period.status === "open";
                        const isLocked = period.status === "locked";
                        const isProcessed = period.status === "processed";
                        const payPassed = !!period.paymentDate && dateOnly(period.paymentDate) < todayMidnight();
                        const canExport = !isSupport && period.payrollExport?.generated;
                        const hasMenu = !isProcessed || canExport;
                        const busy = loadingAction?.periodId === period.id;
                        const markProcessed = () => openProcess(period);
                        return (
                          <tr key={period.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                            {/* Department */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-md border border-neutral-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                                    {getDepartmentName(period.departmentId)}
                                  </p>
                                  <p className="text-[11px] leading-tight text-neutral-500 whitespace-nowrap">
                                    {period.isAutoGenerated ? "Auto" : "Manual"} · {FREQUENCY_LABELS[period.frequency] || period.frequency}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusPill status={period.status} />
                              {isLocked && payPassed && (
                                <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 mt-1">Pay date passed</p>
                              )}
                            </td>

                            {/* Approvals */}
                            <td className="px-4 py-3 w-full"><ApprovalBar period={period} /></td>

                            {/* Next step */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                {isOpen ? (
                                  <Button
                                    size="sm"
                                    variant={s.pending > 0 ? "default" : "outline"}
                                    className={s.pending > 0 ? "bg-orange-500 hover:bg-orange-600 text-white gap-2" : ""}
                                    onClick={() => goToReview(period)}
                                  >
                                    Review
                                    {s.pending > 0 && <span className="text-xs font-bold opacity-90">{s.pending}</span>}
                                  </Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => goToReview(period)}>
                                    View
                                  </Button>
                                )}

                                {isLocked && payPassed && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300"
                                    onClick={PREVIEW ? undefined : markProcessed}
                                    disabled={PREVIEW}
                                    title={PREVIEW ? PREVIEW_TIP : ""}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark processed
                                  </Button>
                                )}

                                {hasMenu && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-8 h-8 p-0 data-[state=open]:border-orange-300 data-[state=open]:bg-orange-50 data-[state=open]:text-orange-700 dark:data-[state=open]:bg-orange-950/30"
                                        aria-label="More actions"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
                                      {/* Header: which period + where it is in its lifecycle */}
                                      <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800">
                                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
                                          {getDepartmentName(period.departmentId)} · {formatRange(period.periodStart, period.periodEnd)}
                                        </p>
                                        <LifecycleSteps status={period.status} />
                                      </div>

                                      <div className="p-1">
                                        {isOpen && (
                                          <MenuAction
                                            icon={Lock}
                                            title="Lock period"
                                            desc={`Freeze punches and approvals.${s.pending > 0 ? ` ${s.pending} record${s.pending === 1 ? " is" : "s are"} still pending.` : ""}`}
                                            disabled={PREVIEW}
                                            onClick={() => setStatusConfirm({ periodId: period.id, departmentId: period.departmentId, newStatus: "locked" })}
                                          />
                                        )}

                                        {isLocked && (
                                          <>
                                            <MenuAction
                                              icon={CheckCircle2}
                                              title="Mark processed"
                                              desc={`${period.paymentDate ? `Payroll ${payPassed ? "went" : "goes"} out ${formatPayDay(period.paymentDate)}. ` : ""}Makes the period read-only.`}
                                              disabled={PREVIEW}
                                              onClick={markProcessed}
                                            />
                                            <MenuAction
                                              icon={Unlock}
                                              title="Unlock period"
                                              desc="Reopen for corrections."
                                              disabled={PREVIEW}
                                              onClick={() => handleUpdateStatus(period.id, "open")}
                                            />
                                          </>
                                        )}

                                        {canExport && (
                                          <>
                                            {!isProcessed && <DropdownMenuSeparator />}
                                            <MenuAction
                                              icon={Eye}
                                              title="View payroll export"
                                              desc="The payroll summary saved for this period."
                                              disabled={busy}
                                              onClick={() => handleViewPayrollExport(period)}
                                            />
                                            <MenuAction
                                              icon={Download}
                                              title="Download payroll export"
                                              desc="Save it as a JSON file."
                                              disabled={busy}
                                              onClick={() => handleDownloadPayrollExport(period)}
                                            />
                                          </>
                                        )}

                                        {isOpen && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <MenuAction
                                              icon={Trash2}
                                              title="Delete period"
                                              desc="Remove this cutoff. Its timesheets will need another cutoff."
                                              danger
                                              disabled={PREVIEW}
                                              onClick={() => handleDelete(period.id)}
                                            />
                                          </>
                                        )}
                                      </div>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          )}

          {/* Footer */}
          {!isLoading && groups.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500">
                Showing {visibleRows} of {totalRows}{" "}
                {deptFilter === "all" ? "cutoffs" : `${getDepartmentName(deptFilter === "none" ? null : deptFilter)} periods`}
              </p>
              {groupsShown < groups.length && (
                <Button size="sm" variant="outline" onClick={() => setGroupsShown((n) => n + GROUPS_PER_PAGE)}>
                  Load older periods
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Configure schedule (per department: schedule, edit, generate) ── */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-orange-500" /> Configure schedule
            </DialogTitle>
            <DialogDescription>
              Each department's cutoff schedule, and generating its periods
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 pt-2">
            <Label className="text-xs font-bold uppercase tracking-wide text-neutral-500">Department</Label>
            <Select value={scheduleDeptId} onValueChange={setScheduleDeptId}>
              <SelectTrigger className="sm:w-72">
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scheduleDept ? (
            <DeptConfigPanel
              key={scheduleDept.id}
              dept={scheduleDept}
              setting={getDepartmentSetting(scheduleDept.id)}
              upcomingPeriods={scheduleUpcoming}
              isGenerating={!!isGenerating[scheduleDept.id]}
              onGenerate={handleGenerate}
              onEditConfig={() => { setScheduleOpen(false); openConfigFor(scheduleDept.id); }}
              formatDate={formatDate}
              readOnly={PREVIEW}
            />
          ) : (
            <p className="text-sm text-neutral-500 py-6 text-center">
              {departments.length ? "Pick a department to see its schedule." : "No departments yet."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Mark processed confirm ── */}
      <Dialog open={!!processTarget} onOpenChange={(open) => { if (!open && !processing) setProcessTarget(null); }}>
        <DialogContent className="w-[90vw] sm:max-w-[460px]">
          {processTarget && (() => {
            const s = statsOf(processTarget);
            const pay = processTarget.paymentDate;
            const payPassed = !!pay && dateOnly(pay) < todayMidnight();
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-950/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 text-left">
                      <DialogTitle className="text-base leading-snug">
                        Mark {getDepartmentName(processTarget.departmentId)} · {formatRange(processTarget.periodStart, processTarget.periodEnd)} as processed?
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        {s.approved} approved record{s.approved === 1 ? " was" : "s were"} paid.
                        {s.excluded > 0 && ` ${s.excluded} excluded record${s.excluded === 1 ? " was" : "s were"} not.`}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-3 rounded-lg border border-neutral-200 dark:border-neutral-800 divide-x divide-neutral-200 dark:divide-neutral-800">
                  {[
                    { label: "Approved", value: s.approved, cls: "text-green-700 dark:text-green-400" },
                    { label: "Pending",  value: s.pending,  cls: "text-amber-700 dark:text-amber-400" },
                    { label: "Excluded", value: s.excluded, cls: "text-red-700 dark:text-red-400" },
                  ].map((m) => (
                    <div key={m.label} className="px-3 py-2.5">
                      <p className="text-xs text-neutral-500">{m.label}</p>
                      <p className={`text-lg font-bold ${m.cls}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {s.pending > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {s.pending} record{s.pending === 1 ? " is" : "s are"} still pending and won't be paid in this period.
                  </p>
                )}

                <label className="flex items-start gap-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 p-3 cursor-pointer">
                  <Checkbox
                    checked={processAck}
                    onCheckedChange={(v) => setProcessAck(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    I confirm payroll for this period {pay ? `${payPassed ? "was" : "will be"} released on ${formatPayDay(pay)}` : "was released"}.
                    {" "}Processed periods become read-only.
                  </span>
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setProcessTarget(null)} disabled={processing}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    onClick={PREVIEW ? undefined : confirmProcess}
                    disabled={PREVIEW || !processAck || processing}
                  >
                    {processing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                    Mark processed
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CutoffPeriodDialogs cp={cp} />
    </div>
  );
}
