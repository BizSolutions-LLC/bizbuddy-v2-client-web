// components/Dashboard/DashboardContent/CompanyPanel/PunchlogsB&OvertimesB&Leaves/CutoffReview.jsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Car,
  ChevronRight,
  CircleDot,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Timer,
  Check,
  X,
  Pencil,
  XCircle,
  Zap,
  GitMerge,
  CalendarCheck,
  ChevronDown,
  Search,
  Loader2,
  LayoutList,
  AlertCircle,
  CalendarX,
  Info,
  FileText,
  RefreshCw,
  RotateCcw,
  GraduationCap,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ModalPortal from "@/components/ui/modal-portal";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";

import {
  STATUS_CONFIG,
  ROW_TYPE_CONFIG,
  EXCLUDE_REASONS,
  TAG_TOOLTIPS,
  SEGMENT_LABELS,
  SEGMENT_ORDER,
  PUNCH_TYPE_LABELS,
  formatDate,
  isRecordFlagged,
  InfoTooltip,
  formatDateTime,
  toCompanyTzInput,
  fromCompanyTzInput,
  fmtShiftTime,
  enumeratePeriodDays,
  dateOnlyToLabel,
  resolveLeavePayStatus,
  NO_SHIFT_TOOLTIP,
  SHOW_LEFT_EARLY_TAG,
  SHOW_TOO_EARLY_TAG,
  SHOW_AUTO_CLOCKOUT_TAG,
  collectBulkApprovable,
  useCutoffReview,
  SyncOverlay,
  CutoffReviewDialogs,
} from "./cutoffReviewShared";
import { FacePhotoProvider, FacePhotoIcons, FacePhotoViewer } from "./cutoffFacePhotos"; // BB-141
import { CutoffHistoryButton } from "./cutoffPeriodsShared"; // BB-149 follow-up

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Sticky page header */
const PageHeader = ({ cutoff, status, onFinalize, finalizeReady, getDepartmentName, onSync, syncing, otBasis, dailyOtThresholdHours, cutoffOtThresholdHours, refreshingOT, cutoffId, leaveConflictAutoRevert }) => {
  const StatusIcon = STATUS_CONFIG[status]?.icon || CircleDot;
  return (
    <div className="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
      {/* Top row */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-neutral-500 hover:text-neutral-800"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <span className="text-neutral-300 dark:text-neutral-600 text-lg font-light">/</span>
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="text-neutral-500 whitespace-nowrap">Cutoff Periods</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
            <span className="text-neutral-500 whitespace-nowrap">{getDepartmentName(cutoff?.departmentId)}</span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-300" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
              {formatDate(cutoff?.periodStart)} – {formatDate(cutoff?.periodEnd)}
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={`gap-1.5 border whitespace-nowrap ${STATUS_CONFIG[status]?.color || ""}`}>
            <StatusIcon className="w-3 h-3" />
            {STATUS_CONFIG[status]?.label || status}
          </Badge>
          <CutoffHistoryButton cutoff={cutoff} />
          <span className="text-xs text-neutral-400 whitespace-nowrap">
            Payment: <strong className="text-neutral-700 dark:text-neutral-300">{formatDate(cutoff?.paymentDate)}</strong>
          </span>

          {/* ✅ Sync button — picks up new employees/punches added after cutoff was created */}
          {status === "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSync}
              disabled={syncing}
              className="gap-2 border-neutral-200 text-neutral-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Records"}
            </Button>
          )}

          <Button
            size="sm"
            disabled={!finalizeReady}
            onClick={onFinalize}
            className={`gap-2 transition-all ${
              finalizeReady
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Finalize Cutoff
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-0 px-6 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
        {[
          { label: "Total Records", value: null, id: "total",     icon: LayoutList,   color: "text-neutral-800 dark:text-neutral-200" },
          { label: "Approved",      value: null, id: "approved",   icon: CheckCircle2, color: "text-green-600" },
          { label: "Unreviewed",    value: null, id: "unreviewed", icon: Clock,        color: "text-neutral-700 dark:text-neutral-300" },
          { label: "Flagged",       value: null, id: "flagged",    icon: AlertTriangle,color: "text-red-600" },
          { label: "Total Hours",   value: null, id: "hours",      icon: Timer,        color: "text-blue-600" },
        ].map((s, i) => (
          <div key={s.id} className={`flex items-center gap-2.5 pr-6 mr-6 ${i < 4 ? "border-r border-neutral-200 dark:border-neutral-700" : ""}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}
              style={{ background: "var(--stat-bg)" }}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{s.label}</div>
              <div className={`text-lg font-extrabold leading-none ${s.color}`} id={`stat-${s.id}`}>—</div>
            </div>
          </div>
        ))}
        {/* BB-051 — read-only: informs the reviewer, doesn't gate Honor Punch/Honor
            Leave below. An auto-resolved conflict never reaches this screen as a
            pending row, so nothing here needs to change based on this setting. */}
        {leaveConflictAutoRevert && (
          <div className="ml-auto flex items-center gap-2.5 border-l border-neutral-200 dark:border-neutral-700 pl-6 ml-6">
            <Badge className="gap-1.5 border whitespace-nowrap bg-amber-50 text-amber-700 border-amber-200">
              <ShieldAlert className="w-3 h-3" />
              Auto-revert: ON
            </Badge>
          </div>
        )}
        {/* OT config indicator — shows threshold normally; pulses "Computing OT…" while refreshOTBlocks is in flight */}
        {(otBasis || refreshingOT) && (
          <div className={`flex items-center gap-2.5 border-l border-neutral-200 dark:border-neutral-700 pl-6 ml-6 ${leaveConflictAutoRevert ? "" : "ml-auto"}`}>
            {refreshingOT ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500 flex-shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">OT Basis</div>
                  <div className="text-sm font-bold text-purple-500 animate-pulse leading-none">Computing OT…</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">OT Basis</div>
                <div className="text-lg font-extrabold leading-none text-purple-600 dark:text-purple-400">
                  {otBasis === "cutoff"
                    ? `${cutoffOtThresholdHours ?? "—"}h / period`
                    : `${dailyOtThresholdHours ?? 8}h / day`
                  }
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div id="progress-wrap" className="h-0.5 bg-neutral-100 dark:bg-neutral-800">
        <div
          id="progress-fill"
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
};

/** Filter bar */
const FilterBar = ({ tabs, activeTab, onTab, search, onSearch, chips, onChip, showTrainingDay, onTrainingDay }) => (
  <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6">
    {/* Tabs */}
    <div className="flex items-center gap-1 border-b border-neutral-100 dark:border-neutral-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all
            ${activeTab === t.id
              ? "text-orange-500 border-orange-500 font-bold"
              : "text-neutral-500 border-transparent hover:text-neutral-800"
            }`}
        >
          {t.label}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
            ${activeTab === t.id ? "bg-orange-100 text-orange-500" : "bg-neutral-100 text-neutral-500"}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
    {/* Chips */}
    <div className="flex items-center gap-2 py-2.5 flex-wrap">
      <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 max-w-[240px]">
        <Search className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="bg-transparent text-sm outline-none text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 w-full"
        />
      </div>
      {chips.map((c) => (
        <button
          key={c.id}
          onClick={() => onChip(c.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
            ${c.active
              ? "bg-orange-500 border-orange-500 text-white"
              : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-orange-400 hover:text-orange-500"
            }`}
        >
          <c.icon className="w-3 h-3" /> {c.label}
        </button>
      ))}
      {/* BB-095: whole-day Training designation across all employees */}
      {showTrainingDay && (
        <Button
          variant="outline"
          size="sm"
          onClick={onTrainingDay}
          className="ml-auto h-8 gap-1.5 text-xs font-semibold border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700"
        >
          <Plus className="w-3.5 h-3.5" /> Add Training Day
        </Button>
      )}
    </div>
  </div>
);

/** Tag pill with tooltip */
const TagPill = ({ cls, label, tooltip }) => {
  const styles = {
    snap:         "bg-emerald-50 text-emerald-700 border border-emerald-200",
    late:         "bg-red-50    text-red-600    border border-red-200",
    flag:         "bg-amber-50  text-amber-700  border border-amber-200",
    ot:           "bg-violet-50 text-violet-700 border border-violet-200",
    auto:         "bg-sky-50    text-sky-700    border border-sky-200",
    tooEarly:     "bg-orange-50 text-orange-700 border border-orange-200",
    paidLeave:    "bg-emerald-50  text-emerald-700  border border-emerald-200",
    partialLeave: "bg-amber-50    text-amber-700    border border-amber-200",
    unpaidLeave:  "bg-neutral-100 text-neutral-500  border border-neutral-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
      ${styles[cls] || "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
      {label}
      {tooltip && <InfoTooltip text={tooltip} />}
    </span>
  );
};

/** Action button */
const ActionBtn = ({ color, icon: Icon, label, onClick, disabled = false, title }) => {
  const variants = {
    green:   "text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500",
    purple:  "text-violet-600  border-violet-200  hover:bg-violet-500  hover:text-white hover:border-violet-500",
    blue:    "text-blue-600    border-blue-200    hover:bg-blue-500    hover:text-white hover:border-blue-500",
    neutral: "text-neutral-600 border-neutral-200 hover:bg-neutral-100",
    red:     "text-red-500     border-red-200     hover:bg-red-500     hover:text-white hover:border-red-500",
    amber:   "text-amber-600   border-amber-200   hover:bg-amber-500   hover:text-white hover:border-amber-500",
  };
  // Wrapped in a span so the hover tooltip still shows while the button is disabled
  // (disabled buttons don't fire hover events). Same dark tooltip as InfoTooltip.
  return (
    <span className={`relative group inline-flex ${disabled ? "cursor-not-allowed" : ""}`}>
      <button onClick={onClick} disabled={disabled} aria-label={title ? `${label} — ${title}` : undefined}
        className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white transition-all duration-150 ${
          disabled ? "text-neutral-300 border-neutral-200 pointer-events-none" : variants[color] || variants.neutral
        }`}>
        <Icon className="w-3 h-3" /> {label}
      </button>
      {title && (
        <span className="pointer-events-none absolute z-[9999] bottom-full right-0 mb-2 w-56 rounded-xl bg-neutral-900 text-white text-[11px] font-normal leading-relaxed px-3 py-2.5 shadow-2xl text-left opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 origin-bottom whitespace-normal break-words">
          {title}
        </span>
      )}
    </span>
  );
};

/** Single timeline row inside an employee card */
const TimelineRow = ({ rec, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => {
  if (rec.type === "absent") {
    return (
      <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-neutral-50/60 dark:bg-neutral-900/20">
        <td className="px-4 py-2.5 w-20 align-middle">
          <span className="font-mono text-[11px] font-medium text-neutral-300 dark:text-neutral-600">{rec.date}</span>
        </td>
        <td className="px-3 py-2.5 w-24 align-middle">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800">
            <CalendarX className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />
            <span className="text-neutral-300 dark:text-neutral-600">Absent</span>
          </div>
        </td>
        <td className="px-3 py-2.5 align-middle">
          <span className="text-[11px] text-neutral-300 dark:text-neutral-600 italic">No punch record</span>
        </td>
        <td className="px-3 py-2.5 w-24 text-right align-middle">
          <span className="text-neutral-300 text-sm">—</span>
        </td>
        <td className="px-3 py-2.5 w-72" />
      </tr>
    );
  }

  if (rec.type === "unsynced") {
    return (
      <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-amber-50/50 dark:bg-amber-900/5">
        <td className="px-4 py-3 w-20 align-top">
          <span className="font-mono text-[11px] font-medium text-neutral-400">{rec.date}</span>
        </td>
        <td className="px-3 py-3 w-24 align-top">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-900/20">
            <Clock className="w-3 h-3 text-amber-500" />
            <span className="text-amber-600">Punch</span>
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <AlertCircle className="w-2.5 h-2.5" />
              Not in cutoff — run Sync to include
            </span>
          </div>
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        </td>
        <td className="px-3 py-3 w-24 text-right align-top">
          <span className="text-neutral-300 text-sm">—</span>
        </td>
        <td className="px-3 py-3 w-72 align-top">
          <div className="flex justify-end">
            <span className="text-[11px] text-amber-500 font-semibold">Sync needed</span>
          </div>
        </td>
      </tr>
    );
  }

  const cfg = ROW_TYPE_CONFIG[rec.localStatus || rec.type] || ROW_TYPE_CONFIG.punch;
  const TypeIcon = cfg.icon;
  const isLocked         = ["approved", "excluded", "resolved"].includes(rec.localStatus);
  const isRestOrPreApproved = rec.type === "rest" || rec.actions?.includes("pre-approved");
  const isLeaveRow    = rec.type === "leave";
  // Unpaid leave shows no hour value at all; paid/partial leave shows the payable
  // portion (not the full scheduled hours) — only paid time should read as a number here.
  const displayHours  = isLeaveRow ? (rec.payStatus === "unpaid" ? 0 : (rec.payableHours ?? rec.hours)) : rec.hours;

  return (
    <tr className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${cfg.rowBg}`}>

      {/* Date */}
      <td className="px-4 py-3 w-20 align-top">
        <span className="font-mono text-[11px] font-medium text-neutral-400">{rec.date}</span>
      </td>

      {/* Type badge */}
      <td className="px-3 py-3 w-24 align-top">
        <div className="flex flex-col gap-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.typeBg}`}>
            <TypeIcon className={`w-3 h-3 ${cfg.typeColor}`} />
            <span className={cfg.typeColor}>{cfg.label}</span>
          </div>
          {rec.punchType === "TRAINING" && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <GraduationCap className="w-2.5 h-2.5" />
              Training
            </div>
          )}
        </div>
      </td>

      {/* Detail column */}
      <td className="px-3 py-3 align-top">

        {/* BB-141: face photo In / Out (only when this punch has one) */}
        <FacePhotoIcons timeLogId={rec.timeLogId} className="mb-2" />

        {/* Schedule strip */}
        {rec.scheduleInfo && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500">
              {rec.scheduleInfo.scheduledHours}h scheduled
              <InfoTooltip text="Total hours in this shift. Payable hours are calculated from this baseline after applying snap rules and break deductions." />
            </span>
            {rec.scheduleInfo.shiftStart && rec.scheduleInfo.shiftEnd && (
              <span className="font-mono text-[10px] text-neutral-400">
                {fmtShiftTime(rec.scheduleInfo.shiftStart)} – {fmtShiftTime(rec.scheduleInfo.shiftEnd)}
              </span>
            )}
          </div>
        )}

        {/* No schedule warning + employee remark */}
        {!rec.scheduleInfo && rec.type !== "leave" && rec.type !== "rest" && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              No schedule for this day
              <InfoTooltip text="No shift assigned. If approved, actual clocked hours will be used as payable hours." />
            </span>
          </div>
        )}

        {/* Employee reason — shown whenever a no_schedule remark exists,
            regardless of whether a schedule was matched (timezone mismatches
            can cause a wrong shift to be found even for unscheduled punches) */}
        {rec.noScheduleRemark && (
          <div className="mb-2 flex items-start gap-2 px-2.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 max-w-md">
            <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Employee Reason</p>
              <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
                {rec.noScheduleRemark.message}
              </p>
            </div>
          </div>
        )}

        {/* Pending leave warning */}
        {rec.pendingLeave && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              <CalendarCheck className="w-2.5 h-2.5" />
              Pending {rec.pendingLeave.leaveType} leave
              <InfoTooltip text="A pending leave request exists for this day. Review and approve or reject the leave before finalizing this punch." />
            </span>
          </div>
        )}

        {/* Punch times */}
        {rec.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        )}

        {/* Tag pills */}
        {rec.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {rec.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>

      {/* Hours */}
      <td className="px-3 py-3 w-24 text-right align-top">
        {rec.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : displayHours > 0 ? (
          <div>
            <div className="inline-flex items-center gap-0.5 justify-end">
              <span className={`font-mono text-sm font-extrabold
                ${rec.isFixedHours ? "line-through text-neutral-400" :
                  isLeaveRow && rec.payStatus === "partial" ? "text-amber-600" :
                  rec.type === "leave"    ? "text-emerald-600" :
                  rec.type === "conflict" ? "text-red-500"     :
                  rec.type === "rest"     ? "text-neutral-300" :
                  "text-neutral-800 dark:text-neutral-100"}`}>
                {parseFloat(displayHours).toFixed(2).replace(/\.?0+$/, "")}h
              </span>
              <InfoTooltip text={rec.isFixedHours
                ? "Not counted for pay — this employee is on fixed hours for the cutoff."
                : isLeaveRow
                ? "Payable portion of this leave day. Unpaid leave hours are excluded from payroll."
                : "Payable hours after snap rules and break deductions. This goes to payroll on approval."} />
            </div>
            {rec.scheduledHours > 0 && (
              <div className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                / {rec.scheduledHours}h sched.
              </div>
            )}
          </div>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 w-72 align-top">
        {rec.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="flex items-center justify-end gap-2">
                {rec.isFixedHours
                  ? <FixedHoursNotCounted />
                  : rec.localStatus === "excluded"
                  ? <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                  : <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                }
              </div>
            )}
            {isRestOrPreApproved && !isLocked && (
              <div className="flex justify-end">
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Pre-approved
                </span>
              </div>
            )}
            {!isLocked && !isRestOrPreApproved && (
              <div className="flex items-center justify-end gap-1.5">
                {rec.actions?.includes("approve")          && <ActionBtn color="green"   icon={Check}         label="Approve"      onClick={() => onApprove(rec.id)} />}
                {rec.actions?.includes("approve-ot")       && <ActionBtn color="purple"  icon={Zap}           label="+ OT"         onClick={() => onApproveOT(rec.id)} />}
                {rec.actions?.includes("approve-schedule") && <ActionBtn color="green"   icon={Check}         label="Schedule"     onClick={() => onApproveSchedule(rec)} disabled={rec.noShiftToPick} title={rec.noShiftToPick ? NO_SHIFT_TOOLTIP : undefined} />}
                {rec.actions?.includes("approve-raw")      && <ActionBtn color="blue"    icon={Clock}         label="Raw"          onClick={() => onApproveRaw(rec.id)} />}
                {rec.actions?.includes("honor-punch")      && <ActionBtn color="blue"    icon={Clock}         label="Honor Punch"  onClick={() => onConflict(rec.id, "punch")} />}
                {rec.actions?.includes("honor-leave")      && <ActionBtn color="green"   icon={CalendarCheck} label="Honor Leave"  onClick={() => onConflict(rec.id, "leave")} />}
                {rec.actions?.includes("toggle-training")  && <ActionBtn
                  color={rec.punchType === "TRAINING" ? "neutral" : "amber"}
                  icon={GraduationCap}
                  label={rec.punchType === "TRAINING" ? "Regular" : "Training"}
                  onClick={(e) => { e.stopPropagation(); onSetPunchType(rec.id, rec.punchType === "TRAINING" ? "REGULAR" : "TRAINING"); }}
                />}
                {rec.actions?.includes("edit")             && <ActionBtn color="neutral" icon={Pencil}        label="Edit"         onClick={(e) => { e.stopPropagation(); onEdit(rec); }} />}
                {rec.actions?.includes("exclude")          && <ActionBtn color="red"     icon={X}             label="Exclude"      onClick={(e) => { e.stopPropagation(); onExclude(rec.id); }} />}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

/** Sub-row for a regular punch inside a multi-shift day group */
const PunchSubRow = ({ rec, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => {
  const cfg = ROW_TYPE_CONFIG[rec.localStatus || rec.type] || ROW_TYPE_CONFIG.punch;
  const TypeIcon = cfg.icon;
  const isLocked         = ["approved", "excluded", "resolved"].includes(rec.localStatus);
  const isRestOrPreApproved = rec.type === "rest" || rec.actions?.includes("pre-approved");

  return (
    <tr className={`border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors ${cfg.rowBg}`}>
      <td className="px-4 py-3 w-20 align-top">
        <span className="font-mono text-[10px] text-neutral-300 pl-2">└</span>
      </td>
      <td className="px-3 py-3 w-24 align-top">
        <div className="flex flex-col gap-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.typeBg}`}>
            <TypeIcon className={`w-3 h-3 ${cfg.typeColor}`} />
            <span className={cfg.typeColor}>{cfg.label}</span>
          </div>
          {rec.punchType === "TRAINING" && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <GraduationCap className="w-2.5 h-2.5" />
              Training
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        {/* BB-141: face photo In / Out */}
        <FacePhotoIcons timeLogId={rec.timeLogId} className="mb-2" />
        {rec.scheduleInfo && (
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500">
              {rec.scheduleInfo.scheduledHours}h scheduled
              <InfoTooltip text="Total hours in this shift. Payable hours are calculated from this baseline after applying snap rules and break deductions." />
            </span>
            {rec.scheduleInfo.shiftStart && rec.scheduleInfo.shiftEnd && (
              <span className="font-mono text-[10px] text-neutral-400">
                {fmtShiftTime(rec.scheduleInfo.shiftStart)} – {fmtShiftTime(rec.scheduleInfo.shiftEnd)}
              </span>
            )}
          </div>
        )}
        {!rec.scheduleInfo && rec.type !== "leave" && rec.type !== "rest" && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-2.5 h-2.5" />
              No schedule for this day
              <InfoTooltip text="No shift assigned. If approved, actual clocked hours will be used as payable hours." />
            </span>
          </div>
        )}
        {rec.noScheduleRemark && (
          <div className="mb-2 flex items-start gap-2 px-2.5 py-2 rounded-xl bg-neutral-50 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700 max-w-md">
            <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-0.5">Employee Reason</p>
              <p className="text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
                {rec.noScheduleRemark.message}
              </p>
            </div>
          </div>
        )}
        {rec.pendingLeave && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
              <CalendarCheck className="w-2.5 h-2.5" />
              Pending {rec.pendingLeave.leaveType} leave
              <InfoTooltip text="A pending leave request exists for this day. Review and approve or reject the leave before finalizing this punch." />
            </span>
          </div>
        )}
        {rec.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: rec.detail }} />
        )}
        {rec.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {rec.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-3 w-24 text-right align-top">
        {rec.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : rec.hours > 0 ? (
          <div>
            <div className="inline-flex items-center gap-0.5 justify-end">
              <span className={`font-mono text-sm font-extrabold
                ${rec.isFixedHours          ? "line-through text-neutral-400" :
                  rec.type === "leave"    ? "text-emerald-600" :
                  rec.type === "conflict" ? "text-red-500"     :
                  rec.type === "rest"     ? "text-neutral-300" :
                  "text-neutral-800 dark:text-neutral-100"}`}>
                {parseFloat(rec.hours).toFixed(2).replace(/\.?0+$/, "")}h
              </span>
              <InfoTooltip text={rec.isFixedHours
                ? "Not counted for pay — this employee is on fixed hours for the cutoff."
                : "Payable hours after snap rules and break deductions. This goes to payroll on approval."} />
            </div>
            {rec.scheduledHours > 0 && (
              <div className="text-[10px] text-neutral-400 mt-0.5 tabular-nums">
                / {rec.scheduledHours}h sched.
              </div>
            )}
          </div>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-3 w-72 align-top">
        {rec.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="flex items-center justify-end gap-2">
                {rec.isFixedHours
                  ? <FixedHoursNotCounted />
                  : rec.localStatus === "excluded"
                  ? <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                  : <>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                      <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={(e) => { e.stopPropagation(); onReset(rec.id); }} />
                    </>
                }
              </div>
            )}
            {isRestOrPreApproved && !isLocked && (
              <div className="flex justify-end">
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Pre-approved
                </span>
              </div>
            )}
            {!isLocked && !isRestOrPreApproved && (
              <div className="flex items-center justify-end gap-1.5">
                {rec.actions?.includes("approve")          && <ActionBtn color="green"   icon={Check}         label="Approve"      onClick={() => onApprove(rec.id)} />}
                {rec.actions?.includes("approve-ot")       && <ActionBtn color="purple"  icon={Zap}           label="+ OT"         onClick={() => onApproveOT(rec.id)} />}
                {rec.actions?.includes("approve-schedule") && <ActionBtn color="green"   icon={Check}         label="Schedule"     onClick={() => onApproveSchedule(rec)} disabled={rec.noShiftToPick} title={rec.noShiftToPick ? NO_SHIFT_TOOLTIP : undefined} />}
                {rec.actions?.includes("approve-raw")      && <ActionBtn color="blue"    icon={Clock}         label="Raw"          onClick={() => onApproveRaw(rec.id)} />}
                {rec.actions?.includes("honor-punch")      && <ActionBtn color="blue"    icon={Clock}         label="Honor Punch"  onClick={() => onConflict(rec.id, "punch")} />}
                {rec.actions?.includes("honor-leave")      && <ActionBtn color="green"   icon={CalendarCheck} label="Honor Leave"  onClick={() => onConflict(rec.id, "leave")} />}
                {rec.actions?.includes("toggle-training")  && <ActionBtn
                  color={rec.punchType === "TRAINING" ? "neutral" : "amber"}
                  icon={GraduationCap}
                  label={rec.punchType === "TRAINING" ? "Regular" : "Training"}
                  onClick={(e) => { e.stopPropagation(); onSetPunchType(rec.id, rec.punchType === "TRAINING" ? "REGULAR" : "TRAINING"); }}
                />}
                {rec.actions?.includes("edit")             && <ActionBtn color="neutral" icon={Pencil}        label="Edit"         onClick={(e) => { e.stopPropagation(); onEdit(rec); }} />}
                {rec.actions?.includes("exclude")          && <ActionBtn color="red"     icon={X}             label="Exclude"      onClick={(e) => { e.stopPropagation(); onExclude(rec.id); }} />}
              </div>
            )}
          </>
        )}
      </td>
    </tr>
  );
};

/** Single segment row inside a driver day group */
const DriverSegmentRow = ({ seg, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onExclude, onReset }) => {
  const isLocked = ["approved", "excluded", "resolved"].includes(seg.localStatus);
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 bg-white dark:bg-neutral-900">
      <td className="px-4 py-2.5 w-20 align-top">
        <span className="font-mono text-[10px] text-neutral-300 pl-2">└</span>
      </td>
      <td className="px-3 py-2.5 w-28 align-top">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-violet-50 dark:bg-violet-900/20 whitespace-nowrap">
          <Clock className="w-3 h-3 text-violet-600" />
          <span className="text-violet-600">{SEGMENT_LABELS[seg.segmentType] || seg.segmentType}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        {seg.segmentWindow && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 font-mono">
              Segment window: {seg.segmentWindow}
            </span>
          </div>
        )}
        {seg.isApproving ? (
          <div className="flex items-center gap-1.5 text-neutral-400 text-[12px] mb-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…
          </div>
        ) : (
          <div className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
            dangerouslySetInnerHTML={{ __html: seg.detail }} />
        )}
        {seg.tags?.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {seg.tags.map((t, i) => (
              <TagPill key={i} cls={t.cls} label={t.label} tooltip={t.tooltip ?? TAG_TOOLTIPS[t.cls]} />
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 w-24 text-right align-top">
        {seg.isApproving ? (
          <Skeleton className="h-5 w-12 ml-auto rounded" />
        ) : seg.hours > 0 ? (
          <span className={`font-mono text-sm font-extrabold ${seg.isFixedHours ? "line-through text-neutral-400" : "text-neutral-800 dark:text-neutral-100"}`}>
            {parseFloat(seg.hours).toFixed(2).replace(/\.?0+$/, "")}h
          </span>
        ) : (
          <span className="text-neutral-300 text-sm">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 w-72 align-top">
        {seg.isApproving ? (
          <div className="flex justify-end">
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        ) : isLocked ? (
          <div className="flex items-center justify-end gap-2">
            {seg.isFixedHours
              ? <FixedHoursNotCounted />
              : seg.localStatus === "excluded"
              ? <>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-400 border border-neutral-200"><XCircle className="w-3 h-3" /> Excluded</span>
                  <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={() => onReset(seg.id)} />
                </>
              : <>
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
                  <ActionBtn color="neutral" icon={RotateCcw} label="Reset" onClick={() => onReset(seg.id)} />
                </>
            }
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {seg.actions?.includes("approve")          && <ActionBtn color="green"  icon={Check} label="Approve"  onClick={() => onApprove(seg.id)} />}
            {seg.actions?.includes("approve-ot")       && <ActionBtn color="purple" icon={Zap}   label="+ OT"    onClick={() => onApproveOT(seg.id)} />}
            {seg.actions?.includes("approve-schedule") && <ActionBtn color="green"  icon={Check} label="Schedule" onClick={() => onApproveSchedule(seg)} />}
            {seg.actions?.includes("approve-raw")      && <ActionBtn color="blue"   icon={Clock} label="Raw"      onClick={() => onApproveRaw(seg.id)} />}
            {seg.actions?.includes("exclude")          && <ActionBtn color="red"    icon={X}     label="Exclude"  onClick={() => onExclude(seg.id)} />}
          </div>
        )}
      </td>
    </tr>
  );
};

/** Driver day group — header row + one DriverSegmentRow per segment */
const DriverGroupRow = ({ group, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onExclude, onReset, companyTimezone }) => {
  const useOriginal = group.segments[0]?.originalTimeIn && group.segments[0]?.originalTimeOut;
  const rawIn  = useOriginal ? group.segments[0]?.originalTimeIn  : group.segments[0]?.rawTimeIn;
  const rawOut = useOriginal ? group.segments[0]?.originalTimeOut : group.segments[0]?.rawTimeOut;
  const punchType = group.segments[0]?.punchType;
  return (
    <>
      <tr className="bg-violet-50/40 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-900/20">
        <td className="px-4 py-2 w-20 align-middle">
          <span className="font-mono text-[11px] font-medium text-neutral-400">{group.date}</span>
        </td>
        <td colSpan={3} className="px-3 py-2 align-middle">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-600">
              <Timer className="w-3 h-3" /> Driver Day — {group.segments.length} segments
            </span>
            {punchType && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-600 whitespace-nowrap">
                {PUNCH_TYPE_LABELS[punchType] || punchType}
              </span>
            )}
            {rawIn && (
              <span className="inline-flex items-center font-mono text-[10px] text-neutral-400">
                {formatDateTime(rawIn, companyTimezone)} → {rawOut ? formatDateTime(rawOut, companyTimezone) : "Not clocked out"}
                <InfoTooltip text="Raw punch time — the actual clock in/out for this TimeLog, before schedule-window snapping." />
              </span>
            )}
            {/* BB-141: one photo per clock-in / clock-out, not per segment */}
            <FacePhotoIcons timeLogId={group.timeLogId} />
          </div>
        </td>
        <td className="px-3 py-2 text-right align-middle">
          {group.isApproving ? (
            <Skeleton className="h-5 w-20 ml-auto rounded" />
          ) : (
            <span className="font-mono text-sm font-extrabold text-neutral-600 dark:text-neutral-300">
              {parseFloat(group.hours).toFixed(2).replace(/\.?0+$/, "")}h total
            </span>
          )}
        </td>
      </tr>
      {group.segments.map((seg) => (
        <DriverSegmentRow key={seg.id} seg={seg} onApprove={onApprove} onApproveOT={onApproveOT} onApproveSchedule={onApproveSchedule} onApproveRaw={onApproveRaw} onExclude={onExclude} onReset={onReset} />
      ))}
    </>
  );
};

/** Multi-shift day group for regular punches */
const PunchGroupRow = ({ group, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onReset, onSetPunchType }) => (
  <>
    <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
      <td className="px-4 py-2 w-20 align-middle">
        <span className="font-mono text-[11px] font-medium text-neutral-400">{group.date}</span>
      </td>
      <td colSpan={3} className="px-3 py-2 align-middle">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
          <Clock className="w-3 h-3" /> {group.punches.length} shift{group.punches.length !== 1 ? "s" : ""}
        </span>
      </td>
      <td className="px-3 py-2 text-right align-middle">
        <span className="font-mono text-sm font-extrabold text-neutral-600 dark:text-neutral-300">
          {parseFloat(group.hours).toFixed(2).replace(/\.?0+$/, "")}h total
        </span>
      </td>
    </tr>
    {group.punches.map((punch) => (
      <PunchSubRow
        key={punch.id}
        rec={punch}
        onApprove={onApprove}
        onApproveOT={onApproveOT}
        onApproveSchedule={onApproveSchedule}
        onApproveRaw={onApproveRaw}
        onEdit={onEdit}
        onExclude={onExclude}
        onConflict={onConflict}
        onReset={onReset}
        onSetPunchType={onSetPunchType}
      />
    ))}
  </>
);

/** BB-089 — SV punch/segment label. The server excludes these (fixed-hours department), so
 *  they're shown for reference only, with no Reset (reset would push them back to pending). */
const FixedHoursNotCounted = () => (
  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
    <Timer className="w-3 h-3" /> Not counted: fixed hours
  </span>
);

/** BB-089 — fixed-hours (SV) row: flat hours for the cutoff, already approved server-side.
 *  Editable only while the cutoff is open (the PATCH returns 400 once locked/processed). */
const FixedHoursRow = ({ row, canEdit, onEdit, companyTimezone }) => {
  const fmt     = (n) => parseFloat(n || 0).toFixed(2).replace(/\.?0+$/, "");
  const hours   = Number(row.hours) || 0;
  const leave   = Number(row.leaveHours) || 0;
  const regular = Number(row.regularHours) || 0;
  const editor  = row.editedBy
    ? `${row.editedBy.profile?.firstName || ""} ${row.editedBy.profile?.lastName || ""}`.trim() || "an admin"
    : null;

  return (
    <tr className="bg-blue-50/40 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800/30">
      <td className="px-3 py-2.5 w-24">
        <span className="font-mono text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Cutoff</span>
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
          <Timer className="w-2.5 h-2.5" /> Fixed
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs text-neutral-700 dark:text-neutral-300">
          <strong>Fixed hours: {hours.toFixed(2)}h</strong>
          {leave > 0 && <span className="text-neutral-500"> · {fmt(regular)} regular + {fmt(leave)} leave</span>}
        </div>
        {editor && (
          <div className="text-[11px] text-neutral-400 mt-0.5">
            Edited by {editor}{row.editedAt ? ` on ${formatDateTime(row.editedAt, companyTimezone || "UTC")}` : ""}
          </div>
        )}
        {row.notes && <div className="text-[11px] text-neutral-400 italic mt-0.5">{row.notes}</div>}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">{fmt(hours)}h</span>
      </td>
      <td className="px-3 py-2.5 w-72">
        <div className="flex items-center justify-end gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"><Check className="w-3 h-3" /> Approved</span>
          {canEdit && <ActionBtn color="neutral" icon={Pencil} label="Edit" onClick={(e) => { e.stopPropagation(); onEdit(row); }} />}
        </div>
      </td>
    </tr>
  );
};

/** OT block row — rendered after the last punch row for a given date (B&C), or as a period summary (DayCare) */
const OTBlockRow = ({ block, onOTBlock, localOTBlockStatus, threshold, isCutoffBasis }) => {
  const [expanded, setExpanded] = useState(false);
  const status    = localOTBlockStatus[block.id] || block.status;
  // BB-089 rework: SV blocks hold off-day OT only (no threshold) and are approvable like any other
  const isFixedHours = block.isFixedHoursEmployee === true;
  const isPending = status === "pending";
  const bd        = block.breakdown;
  const hasBreakdown = isCutoffBasis && bd?.days?.length > 0;

  return (
    <>
      <tr className="bg-purple-50/40 dark:bg-purple-900/5 border-t border-purple-100 dark:border-purple-800/30">
        <td className="px-3 py-2.5 w-24" />
        <td className="px-3 py-2.5">
          <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
            <Zap className="w-2.5 h-2.5" /> OT
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {isFixedHours
                ? `Off-day OT · ${bd?.otHours ?? block.otHours}h on top of fixed hours`
                : isCutoffBasis
                ? `Period OT · ${bd?.totalHours ?? block.otHours}h total / ${bd?.threshold ?? threshold}h threshold`
                : `Overtime · ${block.otHours}h over ${threshold}h daily threshold`
              }
            </span>
            {hasBreakdown && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "Hide" : "Days"}
              </button>
            )}
            {status === "approved" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400 px-1.5 py-0.5 rounded">
                <Check className="w-2.5 h-2.5" /> Approved
              </span>
            )}
            {status === "excluded" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                <X className="w-2.5 h-2.5" /> Excluded
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className={`font-mono text-sm font-bold ${isPending ? "text-purple-600 dark:text-purple-400" : "text-neutral-400"}`}>
            {isCutoffBasis
              ? `+${parseFloat(bd?.otHours ?? block.otHours).toFixed(2).replace(/\.?0+$/, "")}h`
              : `${block.otHours}h`}
          </span>
        </td>
        <td className="px-3 py-2.5 w-72 text-right">
          {isPending && (
            <div className="flex items-center justify-end gap-1.5">
              <ActionBtn color="purple" icon={Zap}  label="Approve OT" onClick={() => onOTBlock(block.id, "approve")} />
              <ActionBtn color="red"    icon={X}    label="Exclude"    onClick={() => onOTBlock(block.id, "exclude")} />
            </div>
          )}
        </td>
      </tr>
      {expanded && hasBreakdown && (
        <tr className="bg-purple-50/40 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-800/30">
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="flex justify-end">
              <div className="w-80 rounded-lg border border-purple-200 dark:border-purple-800/50 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {bd.days.map((d) => (
                      <tr key={d.date} className="border-b border-purple-100/60 dark:border-purple-900/20 last:border-0">
                        <td className="px-3 py-1 text-neutral-500 dark:text-neutral-400">
                          <span>{formatDate(d.date)}</span>
                          {d.isTraining && (
                            <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">Training</span>
                          )}
                        </td>
                        <td className="px-3 py-1 text-right font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                          {parseFloat(d.hours).toFixed(2).replace(/\.?0+$/, "")}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-purple-200 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-900/20">
                      <td className="px-3 py-1.5 font-bold text-neutral-700 dark:text-neutral-200">Total</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-neutral-800 dark:text-neutral-100">
                        {parseFloat(bd.totalHours).toFixed(2).replace(/\.?0+$/, "")}h
                      </td>
                    </tr>
                    <tr className="bg-purple-100/50 dark:bg-purple-900/30">
                      <td colSpan={2} className="px-3 py-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        {parseFloat(bd.totalHours).toFixed(2).replace(/\.?0+$/, "")}h − {bd.threshold}h threshold = +{parseFloat(bd.otHours).toFixed(2).replace(/\.?0+$/, "")}h OT
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

/** Employee card */
const EmployeeCard = ({ emp, expanded, onToggle, onApprove, onApproveOT, onApproveSchedule, onApproveRaw, onEdit, onExclude, onConflict, onBulkApproveRaw, onBulkApproveSchedule, onOTBlock, localOTBlockStatus, companyTimezone, dailyOtThresholdHours, cutoffOtThresholdHours, otBasis, onReset, onSetPunchType, trainingDates, refreshingOT, cutoffStatus, onEditFixedHours }) => {
  const isCutoffBasis = otBasis === "cutoff";

  // BB-096: opening this card closes the previously open one, which can shift the page.
  // Wait for that collapse (0.2s) to finish, then bring this card's header into view.
  const cardRef = useRef(null);
  useEffect(() => {
    if (!expanded) return;
    const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 220);
    return () => clearTimeout(t);
  }, [expanded]);

  // B&C: build a map of formatted-date → OT block so we can inject OT rows after the last
  // punch row for each date without a second pass.
  // DayCare: one block per employee rendered as a period summary after all rows — skip the map.
  const otBlockByDate = useMemo(() => {
    if (isCutoffBasis) return {};
    const map = {};
    (emp.otBlocks || []).forEach((block) => {
      const [y, m, d] = block.date.slice(0, 10).split("-").map(Number);
      const safeDate  = new Date(Date.UTC(y, m - 1, d, 12));
      const formatted = safeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: companyTimezone || "UTC" });
      map[formatted] = block;
    });
    return map;
  }, [emp.otBlocks, companyTimezone, isCutoffBasis]);

  // DayCare only: single period-level OT block rendered at the bottom of the card
  const periodOTBlock = isCutoffBasis ? (emp.otBlocks?.[0] ?? null) : null;

  const hasConflict  = emp.records.some((r) => {
    if (r.type === "punch_group") return r.punches.some((p) => p.type === "conflict" && !p.localStatus);
    return r.type === "conflict" && !r.localStatus;
  });
  const hasFlag      = emp.records.some((r) => isRecordFlagged(r));
  const allDone      = emp.pending === 0;
  const punchCount   = emp.records.reduce((n, r) => {
    if (r.type === "driver_group") return n + r.segments.length;
    if (r.type === "punch_group")  return n + r.punches.length;
    return ["rest", "leave", "absent"].includes(r.type) ? n : n + 1;
  }, 0);
  const leaveCount   = emp.records.filter((r) => r.type === "leave").length;

  const cardBorder = hasConflict
    ? "border-red-200 dark:border-red-800"
    : hasFlag
    ? "border-amber-200 dark:border-amber-800"
    : allDone
    ? "border-green-200 dark:border-green-800"
    : "border-neutral-200 dark:border-neutral-800";

  return (
    <div ref={cardRef} className={`scroll-mt-40 bg-white dark:bg-neutral-900 rounded-xl border ${cardBorder} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
          style={{ background: emp.color }}
        >
          {emp.initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200 truncate">{emp.name}</span>
            {emp.isDriver && <Car className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
          </div>
          <div className="text-xs text-neutral-400 truncate">{emp.email}</div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasConflict  && <Badge className="bg-red-100    text-red-600    border-red-200    text-[10px] gap-1"><GitMerge className="w-2.5 h-2.5" /> Conflict</Badge>}
          {hasFlag && !hasConflict && <Badge className="bg-amber-100  text-amber-600  border-amber-200  text-[10px] gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Flagged</Badge>}
          {emp.unsyncedCount > 0 && <Badge className="bg-amber-100 text-amber-600 border-amber-200 text-[10px] gap-1"><AlertCircle className="w-2.5 h-2.5" /> {emp.unsyncedCount} unsynced</Badge>}
          {emp.fixedHours && <Badge className="bg-blue-100 text-blue-600 border-blue-200 text-[10px] gap-1"><Timer className="w-2.5 h-2.5" /> Fixed hours</Badge>}
          {emp.hasOT    && <Badge className="bg-purple-100 text-purple-600 border-purple-200 text-[10px] gap-1"><Zap className="w-2.5 h-2.5" /> OT</Badge>}
          {allDone      && <Badge className="bg-green-100  text-green-600  border-green-200  text-[10px] gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Done</Badge>}
          {/* Shown while the server is computing OT blocks after an approval — only for cutoff-basis companies where an OT block may still be incoming */}
          {refreshingOT && isCutoffBasis && allDone && !periodOTBlock && (
            <Badge className="bg-purple-50 text-purple-500 border-purple-200 text-[10px] gap-1 animate-pulse">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Computing OT…
            </Badge>
          )}
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 ml-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <Check className="w-2.5 h-2.5" /> {emp.approved}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
            <Clock className="w-2.5 h-2.5" /> {emp.pending}
          </span>
        </div>

        {/* Total */}
        <div className="text-right ml-2 min-w-[52px]">
          <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide">Payable</div>
          <div className={`text-base font-extrabold font-mono ${emp.pending > 0 ? "text-orange-500" : "text-neutral-800 dark:text-neutral-200"}`}>
            {parseFloat(emp.totalHours).toFixed(2).replace(/\.?0+$/, "")}h
          </div>
        </div>

        {/* Expand icon */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        </motion.div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800"
          >
            {/* Conflict banner */}
            {hasConflict && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Conflict detected — a punch and an approved leave exist on the same day. Resolve before approving.</span>
              </div>
            )}

            {/* Timeline table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800">
                    {["Date", "Type", "Details", "Hours", ""].map((h) => (
                      <th key={h} className={`px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-400 ${h === "" ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emp.fixedHours && (
                    <FixedHoursRow
                      row={emp.fixedHours}
                      canEdit={cutoffStatus === "open"}
                      onEdit={onEditFixedHours}
                      companyTimezone={companyTimezone}
                    />
                  )}
                  {emp.records.map((rec, idx) => {
                    const recDate  = rec.date || rec.punches?.[0]?.date || rec.segments?.[0]?.date;
                    const prevDate = idx > 0
                      ? (emp.records[idx - 1].date || emp.records[idx - 1].punches?.[0]?.date || emp.records[idx - 1].segments?.[0]?.date)
                      : null;
                    const nextDate = idx < emp.records.length - 1
                      ? (emp.records[idx + 1].date || emp.records[idx + 1].punches?.[0]?.date || emp.records[idx + 1].segments?.[0]?.date)
                      : null;
                    const isFirstForDate = recDate && recDate !== prevDate;
                    const isLastForDate  = recDate && recDate !== nextDate;
                    const otBlock = isLastForDate ? otBlockByDate[recDate] : null;
                    // Training Day sub-header — non-driver employees only; skip absent and driver_group rows
                    const showTrainingHeader =
                      !emp.isDriver &&
                      isFirstForDate &&
                      rec.type !== "absent" &&
                      rec.type !== "driver_group" &&
                      recDate && recDate !== "—";
                    return (
                      <React.Fragment key={rec.id}>
                        {showTrainingHeader && (
                          <tr className="bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
                            <td colSpan={5} className="px-4 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{recDate}</span>
                                <div className="flex items-center gap-2">
                                  {trainingDates.has(recDate) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                      <GraduationCap className="w-2.5 h-2.5" /> Training Day
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {rec.type === "driver_group" ? (
                          <DriverGroupRow
                            group={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onExclude={onExclude}
                            onReset={onReset}
                            companyTimezone={companyTimezone}
                          />
                        ) : rec.type === "punch_group" ? (
                          <PunchGroupRow
                            group={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onEdit={onEdit}
                            onExclude={onExclude}
                            onConflict={onConflict}
                            onReset={onReset}
                            onSetPunchType={onSetPunchType}
                          />
                        ) : (
                          <TimelineRow
                            rec={rec}
                            onApprove={onApprove}
                            onApproveOT={onApproveOT}
                            onApproveSchedule={onApproveSchedule}
                            onApproveRaw={onApproveRaw}
                            onEdit={onEdit}
                            onExclude={onExclude}
                            onConflict={onConflict}
                            onReset={onReset}
                            onSetPunchType={onSetPunchType}
                          />
                        )}
                        {otBlock && (
                          <OTBlockRow
                            block={otBlock}
                            onOTBlock={onOTBlock}
                            localOTBlockStatus={localOTBlockStatus}
                            threshold={dailyOtThresholdHours}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {periodOTBlock && (
                    <OTBlockRow
                      block={periodOTBlock}
                      onOTBlock={onOTBlock}
                      localOTBlockStatus={localOTBlockStatus}
                      threshold={cutoffOtThresholdHours ?? dailyOtThresholdHours}
                      isCutoffBasis
                    />
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800">
              <span className="text-xs text-neutral-500">
                {punchCount} punch {punchCount !== 1 ? "records" : "record"} · {leaveCount} leave {leaveCount !== 1 ? "records" : "record"}
              </span>
              <div className="flex items-center gap-3">
                {emp.hasBulkSchedule && emp.pending > 0 && (
                  <Button size="sm" className="bg-violet-500 hover:bg-violet-600 gap-1.5 text-xs h-7" onClick={() => onBulkApproveSchedule(emp.id)}>
                    <CalendarCheck className="w-3 h-3" /> Approve All Schedule
                  </Button>
                )}
                {emp.hasBulkRaw && emp.pending > 0 && (
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1.5 text-xs h-7" onClick={() => onBulkApproveRaw(emp.id)}>
                    <Clock className="w-3 h-3" /> Approve All Raw
                  </Button>
                )}
                <div className="text-right">
                  <div className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wide">Total Payable</div>
                  <div className="text-lg font-extrabold font-mono text-neutral-800 dark:text-neutral-200">{parseFloat(emp.totalHours).toFixed(2).replace(/\.?0+$/, "")}h</div>
                  <div className="text-[10px] text-neutral-400">{parseFloat(emp.punchHours).toFixed(2).replace(/\.?0+$/, "")}h {emp.fixedHours ? "regular" : "punch"}{emp.fixedHours && emp.otHours > 0 ? ` · ${parseFloat(emp.otHours).toFixed(2).replace(/\.?0+$/, "")}h OT` : ""} · {parseFloat(emp.leaveHours).toFixed(2).replace(/\.?0+$/, "")}h leave</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT (List Type) — data/actions/dialogs live in ./cutoffReviewShared (BB-121)
// ─────────────────────────────────────────────────────────────────────────────
export default function CutoffReview({ cutoffId }) {
  const r = useCutoffReview(cutoffId);
  const {
    facePhotos, // BB-141
    token,
    router,
    cutoff,
    setCutoff,
    departments,
    setDepartments,
    employees,
    setEmployees,
    isLoading,
    setIsLoading,
    syncing,
    setSyncing,
    companyTimezone,
    setCompanyTimezone,
    isBNC,
    setIsBNC,
    otBasis,
    setOtBasis,
    otBlocks,
    setOTBlocks,
    dailyOtThresholdHours,
    setDailyOtThresholdHours,
    cutoffOtThresholdHours,
    setCutoffOtThresholdHours,
    fixedHoursRows,
    setFixedHoursRows,
    leaveConflictAutoRevert,
    setLeaveConflictAutoRevert,
    localStatus,
    setLocalStatus,
    localApprovedTimes,
    setLocalApprovedTimes,
    approvingIds,
    setApprovingIds,
    localOTBlockStatus,
    setLocalOTBlockStatus,
    resetIds,
    setResetIds,
    localPunchType,
    setLocalPunchType,
    refreshingOT,
    setRefreshingOT,
    driverMapRef,
    editModal,
    setEditModal,
    editedClockIn,
    setEditedClockIn,
    editedClockOut,
    setEditedClockOut,
    editNotes,
    setEditNotes,
    excludeModal,
    setExcludeModal,
    rawConfirm,
    setRawConfirm,
    finalizeModal,
    setFinalizeModal,
    shiftPickerModal,
    setShiftPickerModal,
    usedShifts,
    setUsedShifts,
    isSaving,
    setIsSaving,
    excludeReason,
    setExcludeReason,
    excludeNote,
    setExcludeNote,
    fixedHoursModal,
    setFixedHoursModal,
    fixedHoursInput,
    setFixedHoursInput,
    fixedHoursNotes,
    setFixedHoursNotes,
    trainingDayModal,
    setTrainingDayModal,
    trainingDayDate,
    setTrainingDayDate,
    trainingDaySaving,
    setTrainingDaySaving,
    openEmpId,
    setOpenEmpId,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    chips,
    setChips,
    fetchData,
    refreshOTBlocks,
    refreshApprovals,
    doSync,
    buildDetails,
    buildUnsyncedRecord,
    groupRecordsByDate,
    mergedEmployees,
    trainingDates,
    trainingDayPunchesByDate,
    trainingDayCandidates,
    globalStats,
    filteredEmployees,
    tabs,
    getDepartmentName,
    findRecord,
    doApprove,
    handleApproveSchedule,
    doConflict,
    confirmExclude,
    openFixedHoursEdit,
    confirmFixedHoursEdit,
    doBulkApprove,
    doBulkApproveRaw,
    requestApproveRaw,
    requestBulkApproveRaw,
    confirmRawApproval,
    doBulkApproveSchedule,
    doOTBlock,
    doReset,
    doSetPunchType,
    doSetPunchTypeForDate,
    confirmFinalize,
    finalizeReady,
  } = r;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-full" />
        {[1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <FacePhotoProvider value={facePhotos}>
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* BB-104: no Toaster was mounted on this route, so every toast here rendered nothing */}
      <Toaster position="top-center" />

      <SyncOverlay syncing={syncing} />


      {/* Sticky Header */}
      <PageHeader
        cutoff={cutoff}
        status={cutoff?.status || "open"}
        onFinalize={() => setFinalizeModal(true)}
        finalizeReady={finalizeReady}
        getDepartmentName={getDepartmentName}
        onSync={doSync}
        syncing={syncing}
        otBasis={otBasis}
        dailyOtThresholdHours={dailyOtThresholdHours}
        cutoffOtThresholdHours={cutoffOtThresholdHours}
        refreshingOT={refreshingOT}
        cutoffId={cutoffId}
        leaveConflictAutoRevert={leaveConflictAutoRevert}
      />

      {/* Filter Bar */}
      <FilterBar
        tabs={tabs}
        activeTab={activeTab}
        onTab={setActiveTab}
        search={search}
        onSearch={setSearch}
        chips={chips}
        onChip={(id) => setChips((c) => c.map((chip) => chip.id === id ? { ...chip, active: !chip.active } : chip))}
        showTrainingDay={(cutoff?.status || "open") === "open" && trainingDayCandidates.length > 0}
        onTrainingDay={() => { setTrainingDayDate(trainingDayCandidates[0]?.date ?? ""); setTrainingDayModal(true); }}
      />

      {/* Employee Cards */}
      <div className="flex-1 p-6 space-y-3">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-24">
            <AlertCircle className="w-14 h-14 mx-auto text-neutral-200 mb-4" />
            <p className="font-semibold text-neutral-500">No employees match your filters</p>
            <button onClick={() => { setSearch(""); setActiveTab("all"); setChips((c) => c.map((ch) => ({ ...ch, active: false }))); }}
              className="mt-3 text-sm text-orange-500 hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          filteredEmployees.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <EmployeeCard
                emp={emp}
                expanded={openEmpId === emp.id}
                onToggle={() => setOpenEmpId((cur) => (cur === emp.id ? null : emp.id))}
                onApprove={(id) => doApprove(id)}
                onApproveOT={(id) => doApprove(id, { withOT: true })}
                onApproveSchedule={handleApproveSchedule}
                onApproveRaw={requestApproveRaw}
                onEdit={(rec) => {
                  setEditModal({ rec });
                  setEditedClockIn(rec.rawTimeIn ? toCompanyTzInput(rec.rawTimeIn, companyTimezone) : "");
                  setEditedClockOut(rec.rawTimeOut ? toCompanyTzInput(rec.rawTimeOut, companyTimezone) : "");
                  setEditNotes("");
                }}
                onExclude={(id) => setExcludeModal({ recId: id })}
                onConflict={doConflict}
                onBulkApproveRaw={requestBulkApproveRaw}
                onBulkApproveSchedule={doBulkApproveSchedule}
                cutoffStatus={cutoff?.status || "open"}
                onEditFixedHours={openFixedHoursEdit}
                onOTBlock={doOTBlock}
                localOTBlockStatus={localOTBlockStatus}
                companyTimezone={companyTimezone}
                dailyOtThresholdHours={dailyOtThresholdHours}
                cutoffOtThresholdHours={cutoffOtThresholdHours}
                otBasis={otBasis}
                onReset={doReset}
                onSetPunchType={doSetPunchType}
                trainingDates={trainingDates}
                refreshingOT={refreshingOT}
              />
            </motion.div>
          ))
        )}
      </div>

      <CutoffReviewDialogs r={r} />

      {/* BB-141: face photo viewer (opened from the camera icons on the rows) */}
      <FacePhotoViewer fp={facePhotos} token={token} timeZone={companyTimezone} />

    </div>
    </FacePhotoProvider>
  );
}
