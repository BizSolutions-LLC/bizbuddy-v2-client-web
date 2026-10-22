"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/ModernCompanyConfigurations.jsx
// Converted from HTML prototype — all original APIs preserved.

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Loader2, Save, Clock, User, CheckSquare, AlertCircle,
  Info, Trash2, Plus, Settings, Users, Calendar, TrendingUp,
  Edit3, Timer, RefreshCw, Globe, Coffee, ChevronDown, X,
  Zap, Check, BookOpen, AlarmClock,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import Spinner from "@/components/common/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

// ── Timezones ────────────────────────────────────────────────────────────────
const TIMEZONES = [
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
  { value: "America/New_York",    label: "America/New York (EST/EDT)" },
  { value: "America/Chicago",     label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver",      label: "America/Denver (MST/MDT)" },
  { value: "America/Phoenix",     label: "America/Phoenix (MST)" },
  { value: "America/Anchorage",   label: "America/Anchorage (AKST/AKDT)" },
  { value: "Pacific/Honolulu",    label: "Pacific/Honolulu (HST)" },
  { value: "Europe/London",       label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris",        label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/Berlin",       label: "Europe/Berlin (CET/CEST)" },
  { value: "Asia/Dubai",          label: "Asia/Dubai (GST)" },
  { value: "Asia/Kolkata",        label: "Asia/Kolkata (IST)" },
  { value: "Asia/Shanghai",       label: "Asia/Shanghai (CST)" },
  { value: "Asia/Tokyo",          label: "Asia/Tokyo (JST)" },
  { value: "Asia/Singapore",      label: "Asia/Singapore (SGT)" },
  { value: "Asia/Hong_Kong",      label: "Asia/Hong Kong (HKT)" },
  { value: "Asia/Manila",         label: "Asia/Manila (PHT)" },
  { value: "Australia/Sydney",    label: "Australia/Sydney (AEDT/AEST)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEDT/AEST)" },
  { value: "Pacific/Auckland",    label: "Pacific/Auckland (NZDT/NZST)" },
];

// ── Quick Guide data ─────────────────────────────────────────────────────────
const GUIDE_SECTIONS = [
  {
    icon: Globe, color: "orange", title: "Company TimeZone", badge: "Critical", badgeColor: "red",
    who: "Superadmin / Admin",
    desc: "The single timezone all time calculations anchor to — shifts, clock records, payroll, OT, and every report.",
    bullets: [
      "Set to the timezone where employees physically work",
      "A confirmation dialog appears before any change applies",
      "Does not retroactively alter past punch records",
      "Live clock preview shows selected zone time before confirming",
    ],
  },
  {
    icon: Clock, color: "blue", title: "Time-keeping Defaults", badge: "Admin", badgeColor: "purple",
    who: "Admin / Superadmin",
    desc: "Company-wide baseline numbers that apply to all employees unless overridden at department level.",
    bullets: [
      "Default Shift Hours — used when no shift is assigned",
      "Minimum Lunch Deduction — auto-deducted minutes for lunch",
      "Grace Period — minutes late still considered on-time before deductions",
      "Changes take effect on the next payroll cycle",
    ],
  },
  {
    icon: TrendingUp, color: "amber", title: "OT Configuration", badge: "Payroll", badgeColor: "amber",
    who: "Admin / Superadmin",
    desc: "Controls how overtime is measured and when the OT request button becomes available. Pick one basis model.",
    bullets: [
      "Daily — OT triggers when a single session exceeds the threshold",
      "Weekly — OT triggers when cumulative hours in 7 days exceed threshold",
      "Cutoff — OT triggers when cumulative hours in payroll period exceed threshold",
      "Only employees submit OT requests — supervisors approve or reject",
    ],
  },
  {
    icon: Building2, color: "green", title: "Dept Lunch Break Policy", badge: "Admin", badgeColor: "purple",
    who: "Admin / Supervisor",
    desc: "Each department independently decides whether lunch breaks are paid or unpaid — affects payable hours directly.",
    bullets: [
      "Paid — lunch counts toward payable hours, employee paid for full session",
      "Unpaid — lunch duration auto-deducted from payable hours on approval",
      "Toggle applies immediately, no save button needed",
      "Different departments can have different policies",
    ],
  },
  {
    icon: Coffee, color: "amber", title: "Dept Coffee Break Policy", badge: "Admin", badgeColor: "purple",
    who: "Admin / Supervisor",
    desc: "Controls how many coffee breaks, how long each, and whether paid or deducted per department.",
    bullets: [
      "Maximum 5 breaks per day, up to 30 minutes each",
      "Total consumable time = Breaks × Minutes (shown as live calculation)",
      "Excess time over the limit is auto-deducted on cutoff approval",
      "Setting breaks to 0 disables coffee break tracking entirely",
    ],
  },
  {
    icon: Timer, color: "blue", title: "DayCare Settings", badge: "DayCare Only", badgeColor: "purple",
    who: "Admin / Superadmin", dayCareOnly: true,
    desc: "Controls DayCare-specific punch behaviour for both driver and non-driver employees.",
    bullets: [
      "Driver-Aide Threshold — minutes early on time-in or late on time-out before the AM/PM modal appears (non-driver employees)",
      "Shift Assignment Window — minutes around a shift boundary where a driver's punch is auto-assigned and snapped to scheduled time, no prompt shown",
      "Only affects DayCare employees",
      "Actual drivers always punch as Driver/Aide regardless of this setting",
      "Defaults to <strong>45 minutes</strong> if not configured",
    ],
  },
];

// ── Icon color map ────────────────────────────────────────────────────────────
const ICON_COLOR = {
  orange: "bg-orange-50 text-orange-600 border-orange-200",
  blue:   "bg-blue-50   text-blue-600   border-blue-200",
  green:  "bg-green-50  text-green-600  border-green-200",
  purple: "bg-purple-50 text-purple-600 border-purple-200",
  amber:  "bg-amber-50  text-amber-600  border-amber-200",
  teal:   "bg-teal-50   text-teal-600   border-teal-200",
};
const BADGE_COLOR = {
  red:    "bg-red-100    text-red-700",
  purple: "bg-purple-100 text-purple-700",
  amber:  "bg-amber-100  text-amber-700",
  green:  "bg-green-100  text-green-700",
};

// ── Shared sub-components ────────────────────────────────────────────────────

function CardStripe({ variant = "default" }) {
  return (
    <div className={`h-[3px] w-full ${
      variant === "critical"
        ? "bg-gradient-to-r from-orange-500 via-red-500 to-orange-500"
        : "bg-orange-500"
    }`} />
  );
}

function SectionIcon({ icon: Icon, color = "orange" }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${ICON_COLOR[color]}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

function MiniStat({ label, value, color, icon: Icon }) {
  const colors = {
    blue:   "bg-blue-50   border-blue-200   text-blue-600",
    green:  "bg-green-50  border-green-200  text-green-600",
    amber:  "bg-amber-50  border-amber-200  text-amber-600",
    orange: "bg-orange-50 border-orange-200 text-orange-600",
    purple: "bg-purple-50 border-purple-200 text-purple-600",
  };
  return (
    <div className={`flex items-center justify-between rounded-xl border p-3 ${colors[color]}`}>
      <div>
        <p className="text-[11px] font-semibold mb-0.5">{label}</p>
        <p className="text-xl font-extrabold font-mono">{value}</p>
      </div>
      <Icon className="w-6 h-6 opacity-60" />
    </div>
  );
}

function Toggle({ on, onChange, loading }) {
  return (
    <button
      onClick={() => !loading && onChange(!on)}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${on ? "bg-green-500" : "bg-neutral-300"}`}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-3 h-3 animate-spin text-white" />
        </span>
      ) : (
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-6" : "translate-x-1"}`} />
      )}
    </button>
  );
}

function NumberField({ label, value, onChange, step, icon: Icon, helpText }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
        {Icon && <Icon className="w-3.5 h-3.5 text-orange-500" />}
        {label}
      </label>
      <Input
        type="number" step={step} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="font-mono"
      />
      {helpText && <p className="text-xs text-neutral-400 italic">{helpText}</p>}
    </div>
  );
}

// ── Save Settings Bar (per tab section) ─────────────────────────────────────
function SaveSettingsBar({ onSave, saving, label = "Save Settings" }) {
  return (
    <div className="flex justify-end pt-1">
      <Button
        onClick={onSave}
        disabled={saving}
        className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        {saving ? "Saving…" : label}
      </Button>
    </div>
  );
}

// ── Quick Guide Panel ────────────────────────────────────────────────────────
// Split into trigger + panel so the button sits cleanly in the header flex row
// and the panel expands below the entire header.
function QuickGuidePanel({ open, onClose, isDayCare }) {
  const visibleSections = GUIDE_SECTIONS.filter((s) => !s.dayCareOnly || isDayCare);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: .35, ease: [.4, 0, .2, 1] }}
          className="overflow-hidden"
        >
            <div className="bg-white dark:bg-neutral-900 border-[1.5px] border-orange-200 rounded-xl shadow-md overflow-hidden">
              <div className="h-[3px] bg-gradient-to-r from-orange-500 via-red-400 to-orange-500" />
              <div className="p-5">
                {/* Guide header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="font-extrabold text-[15px] text-neutral-800 dark:text-neutral-100 mb-0.5">
                        Company Configurations — Quick Guide
                      </h2>
                      <p className="text-xs text-neutral-500 leading-relaxed max-w-xl">
                        A summary of what each section does, who manages it, and what to watch out for.
                        Read this once — you'll know exactly where to go for any setting.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-500 hover:bg-neutral-50 transition-all flex-shrink-0"
                  >
                    <X className="w-3 h-3" /> Close
                  </button>
                </div>

                <div className="border-t border-neutral-100 mb-4" />

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                  {visibleSections.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.title}
                        className="border border-neutral-200 rounded-xl p-3.5 bg-neutral-50 hover:border-orange-200 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-2.5 mb-2.5">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${ICON_COLOR[s.color]}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-bold text-neutral-800 dark:text-neutral-100">{s.title}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[s.badgeColor]}`}>
                                {s.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5">By: {s.who}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-500 leading-relaxed mb-2">{s.desc}</p>
                        <ul className="space-y-1">
                          {s.bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-500 border-b border-neutral-100 pb-1 last:border-0 last:pb-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                              <span dangerouslySetInnerHTML={{ __html: b }} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                {/* Quick tips strip */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex gap-3 items-start">
                  <Zap className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-bold text-orange-900 mb-1.5">Quick Tips!</p>
                    <ul className="space-y-1">
                      {[
                        "Always set the <strong>Company TimeZone first</strong> before creating shifts — everything anchors to it.",
                        "<strong>Save Settings</strong> (top right) saves: Timezone, Time-keeping Defaults, and OT Config. Department toggles save instantly on click.",
                        "When a new employee joins mid-period, use <strong>Sync Records</strong> in Cutoff Review to pull their punches in.",
                        "Leave credits can be bulk-adjusted — select all leave types and enter one hour value to apply to all at once.",
                      ].map((tip, i) => (
                        <li key={i} className="flex gap-2 text-[11px] text-orange-800">
                          <span className="flex-shrink-0">→</span>
                          <span dangerouslySetInnerHTML={{ __html: tip }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
  );
}

function QuickGuideTrigger({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border-[1.5px]
        bg-orange-50 text-orange-600 border-orange-200 text-sm font-semibold
        hover:bg-orange-100 hover:border-orange-400 transition-all"
    >
      {!open && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-ping" />
      )}
      <BookOpen className="w-4 h-4" />
      Quick Guide
      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: .25 }}>
        <ChevronDown className="w-3.5 h-3.5" />
      </motion.span>
    </button>
  );
}

// ── Company Timezone Card ────────────────────────────────────────────────────
function CompanyTimezoneCard({ loading, draft, currentTime, onTimezoneChange }) {
  const [search, setSearch] = useState("");
  const filtered = TIMEZONES.filter((tz) =>
    tz.label.toLowerCase().includes(search.toLowerCase()) ||
    tz.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-[1.5px] border-orange-300 shadow-md overflow-hidden">
      <CardStripe variant="critical" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Globe} color="orange" />
          Company TimeZone
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <AlertCircle className="w-2.5 h-2.5" /> Critical Setting
          </span>
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">This timezone affects all shift schedules, time calculations, and payroll deductions</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning banner */}
        <div className="bg-orange-50 border-[1.5px] border-orange-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-orange-900 mb-1.5">Critical: This Setting Impacts All Time-Based Operations</p>
            <ul className="text-[11px] text-orange-800 space-y-1">
              <li>• <strong>Payroll Calculations:</strong> Overtime, deductions, and pay periods follow this timezone</li>
              <li>• <strong>Break Policies:</strong> Lunch and coffee break tracking uses this timezone</li>
              <li>• <strong>Reports & Analytics:</strong> All time-based reports reference this timezone</li>
            </ul>
            <p className="text-[11px] font-bold text-orange-900 mt-2">Changing this setting requires careful consideration and confirmation.</p>
          </div>
        </div>

        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">

            {/* ── Left block: Selector ── */}
            <div className="border-[1.5px] border-neutral-200 rounded-xl p-4 space-y-3 bg-white dark:bg-neutral-900 flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <Label className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  Select Company TimeZone
                </Label>
              </div>
              <Select value={draft?.timezone || "America/Los_Angeles"} onValueChange={onTimezoneChange}>
                <SelectTrigger className="border-[1.5px] border-orange-200 h-10">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 sticky top-0 bg-background z-10">
                    <Input
                      placeholder="Search timezones…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <ScrollArea className="h-56">
                    {filtered.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
              <div className="mt-auto pt-1 flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-400">Current:</span>
                <code className="text-[11px] font-mono font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                  {draft?.timezone || "America/Los_Angeles"}
                </code>
              </div>
            </div>

            {/* ── Right block: Live Clock ── */}
            <div className="border-[1.5px] border-orange-200 rounded-xl p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                </div>
                <Label className="text-sm font-bold text-orange-800 dark:text-orange-200">
                  Current Time Preview
                </Label>
              </div>
              <div className="flex-1 flex items-center justify-center py-3">
                <p className="font-mono font-extrabold text-orange-600 dark:text-orange-400 text-xl sm:text-2xl text-center leading-tight">
                  {currentTime || "Loading…"}
                </p>
              </div>
              <p className="text-[11px] text-orange-600/60 text-center mt-2">
                All employee operations will use this timezone
              </p>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Timezone Confirm Modal ───────────────────────────────────────────────────
function TimezoneConfirmModal({ open, onOpenChange, pendingTz, currentTz, onConfirm, previewTime }) {
  const pendingLabel  = TIMEZONES.find((tz) => tz.value === pendingTz)?.label  || pendingTz;
  const currentLabel  = TIMEZONES.find((tz) => tz.value === currentTz)?.label  || currentTz;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <div className="h-[3px] bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 -mt-6 mb-4 -mx-6" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-orange-500" />
            </span>
            Confirm TimeZone Change
          </DialogTitle>
          <DialogDescription>
            You are about to change the company timezone. This is a critical operation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* Change summary */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Current</p>
              <p className="font-mono text-sm font-bold">{currentLabel}</p>
            </div>
            <div className="text-center text-orange-500 font-bold">↓</div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">New</p>
              <p className="font-mono text-sm font-bold text-orange-600">{pendingLabel}</p>
            </div>
          </div>
          {/* Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-blue-700 mb-1">Current time in new timezone:</p>
            <p className="font-mono font-extrabold text-blue-600 text-lg">{previewTime}</p>
          </div>
          {/* Impact */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-bold text-red-800 mb-1">This change will immediately affect:</p>
              <ul className="text-[11px] text-red-700 space-y-0.5">
                {["All future shift schedules","Break time calculations","Payroll processing timestamps","Overtime and deduction calculations","All time-based reports and analytics"].map((item) => (
                  <li key={item}>✓ {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Check className="w-4 h-4 mr-2" /> Confirm Change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Time Defaults Card ───────────────────────────────────────────────────────
function TimeDefaultsCard({ loading, draft, setDraft }) {
  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Clock} color="blue" />
          Time-keeping Defaults
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <NumberField label="Default Shift Hours" value={draft?.defaultShiftHours} onChange={(v) => setDraft((o) => ({ ...o, defaultShiftHours: v }))} step="0.25" icon={Timer} />
            <NumberField label="Minimum Lunch Deduction (min)" value={draft?.minimumLunchMinutes} onChange={(v) => setDraft((o) => ({ ...o, minimumLunchMinutes: v }))} step="5" icon={Clock} />
            <NumberField label="Grace Period (minutes)" value={draft?.gracePeriodMinutes ?? 15} onChange={(v) => setDraft((o) => ({ ...o, gracePeriodMinutes: v }))} step="5" icon={AlertCircle} helpText="Allowed lateness before deductions apply" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── OT Config Card ───────────────────────────────────────────────────────────
const OT_BASIS = {
  daily:  { label: "Daily OT Threshold",  field: "dailyOtThresholdHours",  default: 8,  step: "0.25", unit: "hours / day",    example: "e.g. 8h → any session exceeding 8 hours triggers OT" },
  weekly: { label: "Weekly OT Threshold", field: "weeklyOtThresholdHours", default: 40, step: "0.5",  unit: "hours / week",   example: "e.g. 40h → cumulative weekly hours past 40 trigger OT" },
  cutoff: { label: "Cutoff OT Threshold", field: "cutoffOtThresholdHours", default: 80, step: "1",    unit: "hours / cutoff", example: "e.g. 80h → cumulative cutoff hours past 80 trigger OT" },
};

function toLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function cadenceLabel(days) {
  if (days === 7)  return "Weekly";
  if (days === 14) return "Bi-weekly";
  if (days === 15 || days === 16) return "Semi-monthly";
  if (days >= 28 && days <= 31) return "Monthly";
  return `Every ${days} days`;
}

function OvertimeConfigCard({ loading, draft, setDraft }) {
  const basis  = draft?.otBasis ?? "daily";
  const active = OT_BASIS[basis];
  const val    = draft?.[active.field] ?? active.default;

  const cutoffSeedStr = draft?.cutoffSettings?.seedStartDate
    ? String(draft.cutoffSettings.seedStartDate).slice(0, 10)
    : "";
  const cutoffDuration = draft?.cutoffSettings?.durationDays ?? 14;

  const periodEndDate = (() => {
    if (!cutoffSeedStr) return "";
    const d = toLocalDate(cutoffSeedStr);
    if (!d) return "";
    d.setDate(d.getDate() + cutoffDuration - 1);
    return d.toLocaleDateString("en-CA");
  })();

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={TrendingUp} color="amber" />
          Overtime (OT) Configuration
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Define how overtime is measured. Employees submit OT requests — this setting determines when the button becomes available.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {/* Basis selector cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(OT_BASIS).map(([key, cfg]) => {
                const isActive = basis === key;
                const displayVal = draft?.[cfg.field] ?? cfg.default;
                return (
                  <button
                    key={key}
                    onClick={() => setDraft((prev) => ({ ...prev, otBasis: key }))}
                    className={`text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                      isActive
                        ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20 shadow-sm"
                        : "border-neutral-200 bg-white hover:border-orange-200 hover:bg-orange-50/50 dark:bg-neutral-900 dark:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isActive ? "text-orange-600" : "text-neutral-400"}`}>{key}</span>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? "border-orange-500 bg-orange-500" : "border-neutral-300"}`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div className={`text-3xl font-extrabold font-mono mb-0.5 ${isActive ? "text-orange-600" : "text-neutral-700 dark:text-neutral-200"}`}>
                      {displayVal}h
                    </div>
                    <div className="text-[11px] text-neutral-400 mb-2">{cfg.unit}</div>
                    <p className={`text-[11px] leading-relaxed ${isActive ? "text-orange-800 dark:text-orange-200" : "text-neutral-500"}`}>
                      {cfg.description || cfg.example}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Threshold input */}
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-orange-500" />{active.label}
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number" step={active.step} min="0" value={val}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    [active.field]: e.target.value === "" ? null : Number(e.target.value),
                  }))}
                  className="font-mono text-base font-bold"
                />
                <span className="text-sm text-neutral-400 whitespace-nowrap">{active.unit}</span>
              </div>
              <p className="text-xs text-neutral-400 italic">{active.example}</p>
            </div>

            {/* Cutoff seed date — only when basis is cutoff */}
            {basis === "cutoff" && (
              <div className="border border-orange-200 bg-orange-50/40 dark:bg-orange-950/10 dark:border-orange-800/40 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold">Cutoff Period Seed</span>
                  {cutoffSeedStr && cutoffDuration > 0 && (
                    <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      {cadenceLabel(cutoffDuration)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Period Start</Label>
                    <Input
                      type="date"
                      value={cutoffSeedStr}
                      onChange={(e) => {
                        const newSeed = e.target.value;
                        setDraft((prev) => ({
                          ...prev,
                          cutoffSettings: {
                            ...(prev.cutoffSettings || {}),
                            seedStartDate: newSeed,
                            durationDays: prev.cutoffSettings?.durationDays ?? 14,
                          },
                        }));
                      }}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Period End (derived)</Label>
                    <Input
                      type="date"
                      value={periodEndDate}
                      onChange={(e) => {
                        if (!cutoffSeedStr) return;
                        const start = toLocalDate(cutoffSeedStr);
                        const end   = toLocalDate(e.target.value);
                        if (!start || !end || end < start) return;
                        const days = Math.round((end - start) / 86400000) + 1;
                        setDraft((prev) => ({
                          ...prev,
                          cutoffSettings: {
                            ...(prev.cutoffSettings || {}),
                            seedStartDate: prev.cutoffSettings?.seedStartDate,
                            durationDays: days,
                          },
                        }));
                      }}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                {cutoffSeedStr && cutoffDuration > 0 && (
                  <p className="text-[11px] text-neutral-500">
                    Each cutoff runs <strong>{cutoffDuration} days</strong> starting from this seed date, then repeats.
                  </p>
                )}
              </div>
            )}

            {/* Info callout */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-blue-900 mb-1.5">How OT Requests Work</p>
                <ul className="text-[11px] text-blue-700 space-y-0.5">
                  <li>• Only <strong>employees</strong> can submit OT requests — from their own Punch Logs view</li>
                  <li>• Supervisors and Admins <strong>approve or reject</strong> requests — they do not submit them</li>
                  <li>• Unapproved OT hours are <strong>not credited</strong> — session is capped at scheduled end</li>
                  <li>• Each company uses exactly <strong>one basis model</strong> — daily, weekly, or per cutoff</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Dept Lunch Break Card ────────────────────────────────────────────────────
function DepartmentBreakPolicyCard({ departments, departmentBreakSettings, departmentAutoLunchSettings, setDepartmentAutoLunchSettings, departmentLoading, updateDepartmentBreakSetting, updateDepartmentAutoLunchSetting, loading, autoBreakBasis, autoLunchEnabled, departmentAutoBreakEntitlement, setDepartmentAutoBreakEntitlement, updateDepartmentAutoBreakConfig }) {
  const paid   = Object.values(departmentBreakSettings).filter(Boolean).length;
  const unpaid = departments.length - paid;

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Building2} color="blue" />
          Department Lunch Break Policy
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">Configure paid lunch break settings for each department individually</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniStat label="Total Departments" value={departments.length} color="blue"   icon={Building2} />
          <MiniStat label="Paid Breaks"        value={paid}             color="green"  icon={CheckSquare} />
          <MiniStat label="Unpaid Breaks"      value={unpaid}           color="amber"  icon={Clock} />
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No departments found. Create departments first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {departments.map((dept) => {
              const isPaid = departmentBreakSettings[dept.id] || false;
              return (
                <div
                  key={dept.id}
                  className={`p-4 rounded-xl border-[1.5px] transition-all ${
                    isPaid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isPaid ? "bg-green-100" : "bg-amber-100"}`}>
                        <Building2 className={`w-4 h-4 ${isPaid ? "text-green-600" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{dept.name}</p>
                        <p className="text-[11px] text-neutral-400 font-mono">{dept.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className={`text-sm font-semibold ${isPaid ? "text-green-600" : "text-amber-600"}`}>
                          {isPaid ? "Paid Lunch Breaks" : "Unpaid Lunch Breaks"}
                        </p>
                        <p className="text-[11px] text-neutral-400">{isPaid ? "Employees paid during lunch" : "Lunch time deducted from pay"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Toggle
                          on={isPaid}
                          loading={!!departmentLoading[dept.id]}
                          onChange={(v) => updateDepartmentBreakSetting(dept.id, v)}
                        />
                        <span className={`text-sm font-semibold ${isPaid ? "text-green-600" : "text-neutral-500"}`}>
                          {departmentLoading[dept.id] ? "Saving…" : isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-lunch config — only shown when paid lunch is on */}
                  {isPaid && (() => {
                    const als = departmentAutoLunchSettings[dept.id] || { autoLunchDurationMinutes: 60, autoLunchAfterHours: 4 };
                    const isAutoLunchLoading = !!departmentLoading[`autolunch_${dept.id}`];
                    return (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-[11px] font-semibold text-green-700 mb-2 flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Auto-Lunch Defaults
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-green-500" /> Duration (min)
                            </label>
                            <Input
                              type="number" min="1" value={als.autoLunchDurationMinutes}
                              className="h-9 text-sm font-mono"
                              onChange={(e) => {
                                const v = Math.max(1, parseInt(e.target.value) || 1);
                                setDepartmentAutoLunchSettings((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoLunchDurationMinutes: v } }));
                              }}
                              onBlur={() => updateDepartmentAutoLunchSetting(dept.id, { autoLunchDurationMinutes: als.autoLunchDurationMinutes })}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                              <Timer className="w-3 h-3 text-green-500" /> After (hours)
                            </label>
                            <Input
                              type="number" min="0.5" step="0.5" value={als.autoLunchAfterHours}
                              className="h-9 text-sm font-mono"
                              onChange={(e) => {
                                const v = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                                setDepartmentAutoLunchSettings((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoLunchAfterHours: v } }));
                              }}
                              onBlur={() => updateDepartmentAutoLunchSetting(dept.id, { autoLunchAfterHours: als.autoLunchAfterHours })}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Preview</label>
                            <div className="h-9 border rounded-lg bg-white flex items-center justify-center font-mono text-xs font-semibold text-neutral-700 px-2 text-center">
                              {als.autoLunchDurationMinutes}m after {als.autoLunchAfterHours}h
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Status</label>
                            <div className="h-9 flex items-center">
                              <span className="text-[11px] font-semibold text-green-600">
                                {isAutoLunchLoading ? "Saving…" : "Saved"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Auto-break lunch config — only when company autoLunchEnabled + dept basis */}
                  {autoBreakBasis === "department" && autoLunchEnabled && (() => {
                    const cfg = departmentAutoBreakEntitlement[dept.id] || {};
                    const isEntitledLoading    = !!departmentLoading[`autobreak_autoLunchEntitled_${dept.id}`];
                    const isDeductibleLoading  = !!departmentLoading[`autobreak_autoBreakLunchDeductible_${dept.id}`];
                    return (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Auto-Lunch Injection
                          </p>
                          <div className="flex items-center gap-2">
                            <Toggle
                              on={cfg.autoLunchEntitled || false}
                              loading={isEntitledLoading}
                              onChange={(v) => updateDepartmentAutoBreakConfig(dept.id, { autoLunchEntitled: v })}
                            />
                            <span className={`text-xs font-semibold ${cfg.autoLunchEntitled ? "text-green-600" : "text-neutral-500"}`}>
                              {isEntitledLoading ? "Saving…" : cfg.autoLunchEntitled ? "Entitled" : "Not Entitled"}
                            </span>
                          </div>
                        </div>
                        {cfg.autoLunchEntitled && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-500" /> Duration (min)
                              </label>
                              <Input
                                type="number" min="1" value={cfg.autoBreakLunchMinutes ?? 60}
                                className="h-9 text-sm font-mono"
                                onChange={(e) => {
                                  const v = Math.max(1, parseInt(e.target.value) || 1);
                                  setDepartmentAutoBreakEntitlement((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoBreakLunchMinutes: v } }));
                                }}
                                onBlur={() => updateDepartmentAutoBreakConfig(dept.id, { autoBreakLunchMinutes: cfg.autoBreakLunchMinutes ?? 60 })}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                                <Timer className="w-3 h-3 text-blue-500" /> After (hours)
                              </label>
                              <Input
                                type="number" min="0.5" step="0.5" value={cfg.autoBreakLunchAfterHours ?? 5}
                                className="h-9 text-sm font-mono"
                                onChange={(e) => {
                                  const v = Math.max(0.5, parseFloat(e.target.value) || 0.5);
                                  setDepartmentAutoBreakEntitlement((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoBreakLunchAfterHours: v } }));
                                }}
                                onBlur={() => updateDepartmentAutoBreakConfig(dept.id, { autoBreakLunchAfterHours: cfg.autoBreakLunchAfterHours ?? 5 })}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Deductible</label>
                              <div className="flex items-center gap-2 h-9">
                                <Toggle
                                  on={cfg.autoBreakLunchDeductible || false}
                                  loading={isDeductibleLoading}
                                  onChange={(v) => updateDepartmentAutoBreakConfig(dept.id, { autoBreakLunchDeductible: v })}
                                />
                                <span className={`text-[11px] font-semibold ${cfg.autoBreakLunchDeductible ? "text-red-600" : "text-green-600"}`}>
                                  {cfg.autoBreakLunchDeductible ? "Deducted" : "Paid"}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Preview</label>
                              <div className="h-9 border rounded-lg bg-white flex items-center justify-center font-mono text-xs font-semibold text-neutral-700 px-2 text-center">
                                {cfg.autoBreakLunchMinutes ?? 60}m after {cfg.autoBreakLunchAfterHours ?? 5}h
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-blue-900 mb-1">How Department Lunch Break Policy Works</p>
            <ul className="text-[11px] text-blue-700 space-y-0.5">
              <li>• <strong>Paid Breaks:</strong> Employees in this department are paid during lunch breaks</li>
              <li>• <strong>Unpaid Breaks:</strong> Lunch time is deducted from employee pay calculations</li>
              <li>• Changes are applied immediately and affect future payroll calculations</li>
              <li>• Each department can have different lunch break policies</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Dept Coffee Break Card ───────────────────────────────────────────────────
function DepartmentCoffeeBreakPolicyCard({ departments, departmentCoffeeSettings, departmentLoading, updateDepartmentCoffeeSetting, loading, autoBreakBasis, autoCoffeeEnabled, departmentAutoBreakEntitlement, setDepartmentAutoBreakEntitlement, updateDepartmentAutoBreakConfig }) {
  const withBreaks = Object.values(departmentCoffeeSettings).filter((s) => s.coffeeBreakMaxCount > 0).length;
  const paidCount  = Object.values(departmentCoffeeSettings).filter((s) => s.coffeeBreakPaid && s.coffeeBreakMaxCount > 0).length;
  const totalMins  = Object.values(departmentCoffeeSettings).reduce((a, s) => a + (s.coffeeBreakMaxCount * s.coffeeBreakMinutes), 0);
  const avgMins    = departments.length > 0 ? Math.round(totalMins / departments.length) : 0;

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Coffee} color="amber" />
          Department Coffee Break Policy
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">Configure coffee break allowances and paid status for each department</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label={`Depts w/ Breaks`} value={`${withBreaks}/${departments.length}`} color="amber"  icon={Coffee} />
          <MiniStat label="Paid Coffee"         value={paidCount}                              color="green"  icon={CheckSquare} />
          <MiniStat label="Unpaid Coffee"        value={withBreaks - paidCount}                color="orange" icon={Clock} />
          <MiniStat label="Avg Break Time"       value={`${avgMins}m`}                         color="purple" icon={Timer} />
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <Coffee className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No departments found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => {
              const s = departmentCoffeeSettings[dept.id] || { coffeeBreakMaxCount: 0, coffeeBreakMinutes: 0, coffeeBreakPaid: false };
              const total = s.coffeeBreakMaxCount * s.coffeeBreakMinutes;
              const hasBreaks = s.coffeeBreakMaxCount > 0;
              const isCoffeeLoading = !!departmentLoading[`coffee_${dept.id}`];

              return (
                <div
                  key={dept.id}
                  className={`p-4 rounded-xl border-[1.5px] transition-all ${
                    hasBreaks && s.coffeeBreakPaid ? "bg-green-50 border-green-200" :
                    hasBreaks                      ? "bg-amber-50 border-amber-200" :
                                                     "bg-neutral-50 border-neutral-200"
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        hasBreaks && s.coffeeBreakPaid ? "bg-green-100" :
                        hasBreaks                      ? "bg-amber-100" : "bg-neutral-100"
                      }`}>
                        <Coffee className={`w-4 h-4 ${
                          hasBreaks && s.coffeeBreakPaid ? "text-green-600" :
                          hasBreaks                      ? "text-amber-600" : "text-neutral-400"
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{dept.name}</p>
                        <p className="text-[11px] text-neutral-400 font-mono">{dept.id}</p>
                      </div>
                    </div>
                    {hasBreaks && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {total} min ({(total / 60).toFixed(2)}h) Total
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-semibold flex items-center gap-1 mb-1 text-neutral-600">
                        <Coffee className="w-3 h-3 text-amber-500" /> Breaks (max 5)
                      </label>
                      <Input
                        type="number" min="0" max="5" value={s.coffeeBreakMaxCount}
                        className="h-9 text-sm font-mono"
                        onChange={(e) => {
                          const v = Math.min(5, Math.max(0, parseInt(e.target.value) || 0));
                          updateDepartmentCoffeeSetting(dept.id, { coffeeBreakMaxCount: v, coffeeBreakMinutes: s.coffeeBreakMinutes, coffeeBreakPaid: s.coffeeBreakPaid });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold flex items-center gap-1 mb-1 text-neutral-600">
                        <Timer className="w-3 h-3 text-amber-500" /> Min/Break (max 30)
                      </label>
                      <Input
                        type="number" min="0" max="30" value={s.coffeeBreakMinutes}
                        className="h-9 text-sm font-mono"
                        onChange={(e) => {
                          const v = Math.min(30, Math.max(0, parseInt(e.target.value) || 0));
                          updateDepartmentCoffeeSetting(dept.id, { coffeeBreakMaxCount: s.coffeeBreakMaxCount, coffeeBreakMinutes: v, coffeeBreakPaid: s.coffeeBreakPaid });
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Total Time</label>
                      <div className="h-9 border rounded-lg bg-white flex items-center justify-center font-mono text-sm font-semibold text-neutral-700">
                        {total} min / {(total / 60).toFixed(2)}h
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Payment</label>
                      <div className="flex items-center gap-2 h-9">
                        <Toggle
                          on={s.coffeeBreakPaid}
                          loading={isCoffeeLoading}
                          onChange={(v) => updateDepartmentCoffeeSetting(dept.id, { coffeeBreakMaxCount: s.coffeeBreakMaxCount, coffeeBreakMinutes: s.coffeeBreakMinutes, coffeeBreakPaid: v })}
                        />
                        <span className={`text-xs font-semibold ${s.coffeeBreakPaid ? "text-green-600" : "text-neutral-500"}`}>
                          {isCoffeeLoading ? "Saving…" : s.coffeeBreakPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-break coffee config — only when company autoCoffeeEnabled + dept basis */}
                  {autoBreakBasis === "department" && autoCoffeeEnabled && (() => {
                    const cfg = departmentAutoBreakEntitlement[dept.id] || {};
                    const isEntitledLoading   = !!departmentLoading[`autobreak_autoCoffeeEntitled_${dept.id}`];
                    const isDeductibleLoading = !!departmentLoading[`autobreak_autoBreakCoffeeDeductible_${dept.id}`];
                    return (
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                            <Coffee className="w-3 h-3" /> Auto-Coffee Injection
                          </p>
                          <div className="flex items-center gap-2">
                            <Toggle
                              on={cfg.autoCoffeeEntitled || false}
                              loading={isEntitledLoading}
                              onChange={(v) => updateDepartmentAutoBreakConfig(dept.id, { autoCoffeeEntitled: v })}
                            />
                            <span className={`text-xs font-semibold ${cfg.autoCoffeeEntitled ? "text-green-600" : "text-neutral-500"}`}>
                              {isEntitledLoading ? "Saving…" : cfg.autoCoffeeEntitled ? "Entitled" : "Not Entitled"}
                            </span>
                          </div>
                        </div>
                        {cfg.autoCoffeeEntitled && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                                <Coffee className="w-3 h-3 text-amber-500" /> Breaks
                              </label>
                              <Input
                                type="number" min="1" max="10" value={cfg.autoBreakCoffeeCount ?? 2}
                                className="h-9 text-sm font-mono"
                                onChange={(e) => {
                                  const v = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                                  setDepartmentAutoBreakEntitlement((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoBreakCoffeeCount: v } }));
                                }}
                                onBlur={() => updateDepartmentAutoBreakConfig(dept.id, { autoBreakCoffeeCount: cfg.autoBreakCoffeeCount ?? 2 })}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                                <Timer className="w-3 h-3 text-amber-500" /> Min/Break
                              </label>
                              <Input
                                type="number" min="1" value={cfg.autoBreakCoffeeMinutes ?? 15}
                                className="h-9 text-sm font-mono"
                                onChange={(e) => {
                                  const v = Math.max(1, parseInt(e.target.value) || 1);
                                  setDepartmentAutoBreakEntitlement((p) => ({ ...p, [dept.id]: { ...p[dept.id], autoBreakCoffeeMinutes: v } }));
                                }}
                                onBlur={() => updateDepartmentAutoBreakConfig(dept.id, { autoBreakCoffeeMinutes: cfg.autoBreakCoffeeMinutes ?? 15 })}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Deductible</label>
                              <div className="flex items-center gap-2 h-9">
                                <Toggle
                                  on={cfg.autoBreakCoffeeDeductible || false}
                                  loading={isDeductibleLoading}
                                  onChange={(v) => updateDepartmentAutoBreakConfig(dept.id, { autoBreakCoffeeDeductible: v })}
                                />
                                <span className={`text-[11px] font-semibold ${cfg.autoBreakCoffeeDeductible ? "text-red-600" : "text-green-600"}`}>
                                  {cfg.autoBreakCoffeeDeductible ? "Deducted" : "Paid"}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Total</label>
                              <div className="h-9 border rounded-lg bg-white flex items-center justify-center font-mono text-xs font-semibold text-neutral-700 px-2 text-center">
                                {(cfg.autoBreakCoffeeCount ?? 2)} × {(cfg.autoBreakCoffeeMinutes ?? 15)}m
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-amber-900 mb-1">How Department Coffee Break Policy Works</p>
            <ul className="text-[11px] text-amber-800 space-y-0.5">
              <li>• <strong>Maximum Limits:</strong> Up to 5 coffee breaks per day, each up to 30 minutes</li>
              <li>• <strong>Total Consumable Time:</strong> Breaks × Minutes. Example: 2 × 15 min = 30 min</li>
              <li>• <strong>⚠️ Excess Time:</strong> If an employee exceeds the allowed total, excess is auto-deducted on approval</li>
              <li>• Setting breaks to 0 disables coffee break tracking for that department entirely</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Department Fixed Hours Card (BB-089) ─────────────────────────────────────
// Two switches must both be on: the department master switch (holds the hours) and each
// employee's own switch. Everyone else in the department stays punch-based.
// The hours input keeps a local draft and saves on blur, so departmentFixedHours only ever
// holds server-confirmed values. Member lists are loaded here (per enabled department) and
// re-fetched after every change so isOnFixedHours and the counts stay server-accurate.
function DepartmentFixedHoursCard({ departments, departmentFixedHours, departmentLoading, updateDepartmentFixedHours, loading, api, token }) {
  const [hoursDraft,     setHoursDraft]     = useState({}); // { [deptId]: string }
  const [members,        setMembers]        = useState({}); // { [deptId]: member[] }
  const [membersLoading, setMembersLoading] = useState({}); // { [deptId]: bool }
  const [expanded,       setExpanded]       = useState({}); // { [deptId]: bool }
  const [savingMembers,  setSavingMembers]  = useState({}); // { [`${deptId}:${userId|all}`]: bool }

  const enabledIds = departments.filter((d) => departmentFixedHours[d.id]?.fixedHoursEnabled).map((d) => d.id);
  const enabledKey = enabledIds.join(",");

  // ── API: GET /api/departments/:id/fixed-hours-members ──────────────────────
  const loadMembers = useCallback(async (deptId) => {
    setMembersLoading((p) => ({ ...p, [deptId]: true }));
    try {
      const r = await fetch(`${api}/api/departments/${deptId}/fixed-hours-members`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setMembers((p) => ({ ...p, [deptId]: j.data?.members || [] }));
      else toast.error(j.message || j.error || "Failed to load department employees");
    } catch { toast.error("Network error loading department employees"); }
    setMembersLoading((p) => ({ ...p, [deptId]: false }));
  }, [api, token]);

  // Load members for every enabled department not loaded yet — gives the counts without expanding
  useEffect(() => {
    enabledIds.forEach((id) => { if (!members[id] && !membersLoading[id]) loadMembers(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledKey, loadMembers]);

  // ── API: PUT /api/departments/:id/fixed-hours-members ──────────────────────
  const setMembersEnabled = async (deptId, userIds, enabled, savingKey) => {
    if (userIds.length === 0) return;
    setSavingMembers((p) => ({ ...p, [savingKey]: true }));
    try {
      const r = await fetch(`${api}/api/departments/${deptId}/fixed-hours-members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds, enabled }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) toast.success(j.message || "Fixed hours updated");
      else toast.error(j.message || j.error || "Failed to update employees");
    } catch { toast.error("Network error"); }
    await loadMembers(deptId);
    setSavingMembers((p) => ({ ...p, [savingKey]: false }));
  };

  const commitHours = (deptId, saved) => {
    const raw = hoursDraft[deptId];
    setHoursDraft((p) => { const n = { ...p }; delete n[deptId]; return n; });
    if (raw === undefined) return;
    const v = Number(raw);
    if (raw === "" || !Number.isFinite(v) || v <= 0 || v > 999) {
      toast.error("Hours must be above 0 and at most 999");
      return;
    }
    if (v === saved) return;
    updateDepartmentFixedHours(deptId, { fixedHoursPerCutoff: v });
  };

  const onFixedCount = (deptId) => (members[deptId] || []).filter((m) => m.isOnFixedHours).length;
  const totalOnFixed = enabledIds.reduce((n, id) => n + onFixedCount(id), 0);
  const countsLoading = enabledIds.some((id) => !members[id]);

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Timer} color="blue" />
          Department Fixed Hours
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">Pay selected employees a flat number of hours per cutoff, regardless of clock-ins</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Fixed-Hours Depts"          value={`${enabledIds.length}/${departments.length}`}   color="blue"  icon={Timer} />
          <MiniStat label="Employees on Fixed Hours"   value={countsLoading ? "…" : totalOnFixed}           color="green" icon={Users} />
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-10 text-neutral-400">
            <Timer className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No departments found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => {
              const s = departmentFixedHours[dept.id] || { fixedHoursEnabled: false, fixedHoursPerCutoff: 80 };
              const isToggleLoading = !!departmentLoading[`fixedhours_fixedHoursEnabled_${dept.id}`];
              const isHoursLoading  = !!departmentLoading[`fixedhours_fixedHoursPerCutoff_${dept.id}`];
              const list      = members[dept.id];
              const isOpen    = !!expanded[dept.id];
              const isBulking = !!savingMembers[`${dept.id}:all`];

              return (
                <div
                  key={dept.id}
                  className={`p-4 rounded-xl border-[1.5px] transition-all ${
                    s.fixedHoursEnabled ? "bg-blue-50 border-blue-200" : "bg-neutral-50 border-neutral-200"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${s.fixedHoursEnabled ? "bg-blue-100" : "bg-neutral-100"}`}>
                        <Timer className={`w-4 h-4 ${s.fixedHoursEnabled ? "text-blue-600" : "text-neutral-400"}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{dept.name}</p>
                        <p className="text-[11px] text-neutral-400 font-mono">{dept.id}</p>
                      </div>
                      {s.fixedHoursEnabled && list && (
                        <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {onFixedCount(dept.id)} on fixed hours
                        </span>
                      )}
                    </div>

                    <div className="flex items-end gap-4 flex-wrap">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-600 mb-1 block">Fixed hours</label>
                        <div className="flex items-center gap-2 h-9">
                          <Toggle
                            on={s.fixedHoursEnabled}
                            loading={isToggleLoading}
                            onChange={(v) => updateDepartmentFixedHours(dept.id, { fixedHoursEnabled: v })}
                          />
                          <span className={`text-xs font-semibold ${s.fixedHoursEnabled ? "text-blue-600" : "text-neutral-500"}`}>
                            {isToggleLoading ? "Saving…" : s.fixedHoursEnabled ? "On" : "Off"}
                          </span>
                        </div>
                      </div>
                      {s.fixedHoursEnabled && (
                        <div className="w-28">
                          <label className="text-[11px] font-semibold flex items-center gap-1 mb-1 text-neutral-600">
                            <Clock className="w-3 h-3 text-blue-500" /> Hours per cutoff
                          </label>
                          <Input
                            type="number" min="0.01" max="999" step="0.5"
                            value={hoursDraft[dept.id] ?? s.fixedHoursPerCutoff}
                            disabled={isHoursLoading}
                            className="h-9 text-sm font-mono"
                            onChange={(e) => setHoursDraft((p) => ({ ...p, [dept.id]: e.target.value }))}
                            onBlur={() => commitHours(dept.id, s.fixedHoursPerCutoff)}
                            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Employee list — only while the master switch is on (employee switches are kept server-side either way) */}
                  {s.fixedHoursEnabled && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded((p) => ({ ...p, [dept.id]: !p[dept.id] }))}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          Manage employees{list ? ` (${list.length})` : ""}
                        </button>
                        {isOpen && list?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              disabled={isBulking}
                              onClick={() => setMembersEnabled(dept.id, list.filter((m) => !m.fixedHoursEnabled).map((m) => m.userId), true, `${dept.id}:all`)}
                            >
                              All on
                            </Button>
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs"
                              disabled={isBulking}
                              onClick={() => setMembersEnabled(dept.id, list.filter((m) => m.fixedHoursEnabled).map((m) => m.userId), false, `${dept.id}:all`)}
                            >
                              All off
                            </Button>
                          </div>
                        )}
                      </div>

                      {isOpen && (
                        !list ? (
                          <div className="space-y-2 mt-3">{[1,2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
                        ) : list.length === 0 ? (
                          <p className="text-xs text-neutral-400 mt-3">No employees in this department.</p>
                        ) : (
                          <div className="mt-3 rounded-lg border border-blue-200 bg-white divide-y divide-neutral-100">
                            {list.map((m) => {
                              const rowSaving = !!savingMembers[`${dept.id}:${m.userId}`] || isBulking;
                              const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email;
                              return (
                                <div key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate">{name}</p>
                                      {m.fixedHoursEnabled && !m.isOnFixedHours && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">inactive</span>
                                      )}
                                    </div>
                                    {m.employeeId && <p className="text-[11px] text-neutral-400 font-mono">{m.employeeId}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Toggle
                                      on={!!m.fixedHoursEnabled}
                                      loading={rowSaving}
                                                onChange={(v) => setMembersEnabled(dept.id, [m.userId], v, `${dept.id}:${m.userId}`)}
                                    />
                                    <span className={`text-xs font-semibold w-20 ${m.fixedHoursEnabled ? "text-blue-600" : "text-neutral-500"}`}>
                                      {m.fixedHoursEnabled ? "Fixed hours" : "Punch-based"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-blue-900 mb-1">How Fixed Hours Work</p>
            <ul className="text-[11px] text-blue-800 space-y-0.5">
              <li>• Turn a department on, then pick which employees are on fixed hours. Everyone else stays punch-based</li>
              <li>• Each selected employee gets the department's hours per cutoff (default 80), whatever their clock-ins are</li>
              <li>• <strong>Paid leave is included:</strong> 8h of leave gives 72h regular + 8h leave = 80h. Leave balances are still used up as normal</li>
              <li>• Punches are kept for reference but not counted for pay, never create OT, and never block Lock or Finalize</li>
              <li>• Turning a department or an employee off only affects open cutoffs. Locked and processed cutoffs stay as they are</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Auto Clock-Out Card ───────────────────────────────────────────────────────
function AutoClockOutCard({ loading, draft, setDraft }) {
  const [emailInput, setEmailInput] = useState("");
  const emails = draft?.autoClockOutNotifyEmails ?? [];

  const addEmail = () => {
    const val = emailInput.trim();
    if (!val || !val.includes("@")) return;
    if (emails.includes(val)) { setEmailInput(""); return; }
    setDraft((o) => ({ ...o, autoClockOutNotifyEmails: [...emails, val] }));
    setEmailInput("");
  };

  const removeEmail = (email) => {
    setDraft((o) => ({ ...o, autoClockOutNotifyEmails: emails.filter((e) => e !== email) }));
  };

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Timer} color="orange" />
          Auto Clock-Out
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField
                label="Warning Hours Before Shift End"
                value={draft?.autoClockOutWarningHours ?? 0.5}
                onChange={(v) => setDraft((o) => ({ ...o, autoClockOutWarningHours: v }))}
                step="0.25"
                icon={Clock}
                helpText="Employee is notified this many hours before their shift ends"
              />
              <NumberField
                label="Grace Hours After Shift End"
                value={draft?.autoClockOutGraceHours ?? 1}
                onChange={(v) => setDraft((o) => ({ ...o, autoClockOutGraceHours: v }))}
                step="0.25"
                icon={Clock}
                helpText="System auto-closes the session this many hours after shift end"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                Notify Emails
              </label>
              <p className="text-xs text-neutral-400 italic">Supervisors notified when an auto clock-out fires</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="supervisor@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addEmail} type="button">Add</Button>
              </div>
              {emails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {emails.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1 pr-1">
                      {email}
                      <button onClick={() => removeEmail(email)} className="ml-1 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── DayCare Settings Card ─────────────────────────────────────────────────────
function DayCareSettingsCard({ loading, draft, setDraft }) {
  return (
    <Card className="border-[1.5px] border-blue-300 shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Timer} color="blue" />
          DayCare Settings
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            DayCare Only
          </span>
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Settings specific to DayCare companies
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <NumberField
              label="Driver-Aide Threshold (minutes)"
              value={draft?.driverAideThresholdMinutes ?? 45}
              onChange={(v) => setDraft((o) => ({ ...o, driverAideThresholdMinutes: v }))}
              step="5"
              icon={Timer}
              helpText="Minutes early on time-in or late on time-out that triggers the AM/PM Driver-Aide modal for non-driver employees"
            />
            <NumberField
              label="Shift Assignment Window (minutes)"
              value={draft?.shiftAssignmentWindowMinutes ?? 30}
              onChange={(v) => setDraft((o) => ({ ...o, shiftAssignmentWindowMinutes: v }))}
              step="5"
              icon={Zap}
              helpText="Minutes before/after a shift boundary where a driver's punch is auto-assigned and snapped to the scheduled time — no prompt shown"
            />
            <NumberField
              label="Early Clock-In Grace (minutes)"
              value={draft?.earlyClockInGraceMinutes}
              onChange={(v) => setDraft((o) => ({ ...o, earlyClockInGraceMinutes: v }))}
              step="5"
              icon={AlarmClock}
              helpText="Employees who clock in more than this many minutes before their shift start will have their actual time kept as-is and be flagged as Too Early. Leave blank to always snap early arrivals to shift start."
            />
            <NumberField
              label="Early Clock-Out Grace (minutes)"
              value={draft?.earlyClockOutGraceMinutes ?? 20}
              onChange={(v) => setDraft((o) => ({ ...o, earlyClockOutGraceMinutes: v }))}
              step="5"
              icon={AlarmClock}
              helpText="Driver/Aide and Driver PM employees who clock out within this window before their scheduled PM shift end will have their clock-out snapped to the shift end time. Does not apply to regular employees."
            />
          </div>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-blue-900 mb-1">How the Driver-Aide Threshold Works</p>
            <ul className="text-[11px] text-blue-700 space-y-0.5">
              <li>• Non-driver/aide employees clocking in <strong>this many minutes early</strong> are prompted for an AM Driver-Aide punch</li>
              <li>• Non-driver/aide employees clocking out <strong>this many minutes late</strong> are prompted for a PM Driver-Aide punch</li>
              <li>• Defaults to <strong>45 minutes</strong> if not set</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Auto-Break Policy Card ────────────────────────────────────────────────────
function AutoBreakPolicyCard({ loading, draft, setDraft }) {
  const lunchOn  = draft?.autoLunchEnabled  ?? false;
  const coffeeOn = draft?.autoCoffeeEnabled ?? false;
  const anyOn    = lunchOn || coffeeOn;
  const basis    = draft?.autoBreakBasis    ?? "department";

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Coffee} color="amber" />
          Auto-Break Policy
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Automatically inject lunch and coffee breaks into employee time logs. Entitlements are set per department or per shift template below.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {/* Break Basis — only shown when at least one feature is on */}
            {anyOn && (
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
                  <Building2 className="w-3.5 h-3.5 text-orange-500" />
                  Break Basis
                </label>
                <div className="flex gap-2">
                  {["department", "shift"].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, autoBreakBasis: b }))}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold capitalize transition-all focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                        basis === b
                          ? "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950/20"
                          : "border-neutral-200 bg-white text-neutral-600 hover:border-orange-200 dark:bg-neutral-900 dark:border-neutral-700"
                      }`}
                    >
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-400">
                  {basis === "department"
                    ? "Entitlement is toggled per department in the Lunch/Coffee policy sections below."
                    : "Entitlement is toggled per shift template in Shift Management."}
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Auto-Lunch enable */}
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold">Auto-Lunch</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Duration &amp; config set per {basis}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle on={lunchOn} loading={false} onChange={(v) => setDraft((p) => ({ ...p, autoLunchEnabled: v }))} />
                  <span className={`text-sm font-semibold ${lunchOn ? "text-green-600" : "text-neutral-500"}`}>
                    {lunchOn ? "On" : "Off"}
                  </span>
                </div>
              </div>

              {/* Auto-Coffee enable */}
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold">Auto-Coffee</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Count &amp; config set per {basis}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle on={coffeeOn} loading={false} onChange={(v) => setDraft((p) => ({ ...p, autoCoffeeEnabled: v }))} />
                  <span className={`text-sm font-semibold ${coffeeOn ? "text-green-600" : "text-neutral-500"}`}>
                    {coffeeOn ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>

            {/* Info callout */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-amber-900 mb-1">How Auto-Break Policy Works</p>
                <ul className="text-[11px] text-amber-800 space-y-0.5">
                  <li>• Breaks are <strong>automatically injected server-side</strong> at clock-out — no employee action needed</li>
                  <li>• <strong>Department basis:</strong> entitlement toggled per department in the Lunch/Coffee sections below</li>
                  <li>• <strong>Shift basis:</strong> entitlement toggled per shift template in Shift Management</li>
                  <li>• Injected breaks are labelled <strong>"Auto-injected"</strong> in time log detail views</li>
                  <li>• Switching basis does not clear entitlement flags — server only evaluates the active basis</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ModernCompanyConfigurations() {
  const { token, role } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (role && !["admin", "superadmin", "supervisor"].includes(role.toLowerCase())) window.location.href = "/dashboard";
    if (!token) { toast.error("Session expired. Please log in again."); window.location.href = "/login"; }
  }, [role, token]);

  // ── State ────────────────────────────────────────────────────────────────
  const [companyId,               setCompanyId]               = useState(null);
  const [departments,             setDepartments]             = useState([]);
  const [departmentBreakSettings,     setDepartmentBreakSettings]     = useState({});
  const [departmentCoffeeSettings,    setDepartmentCoffeeSettings]    = useState({});
  const [departmentAutoLunchSettings, setDepartmentAutoLunchSettings] = useState({});
  const [departmentAutoBreakEntitlement, setDepartmentAutoBreakEntitlement] = useState({});
  const [departmentFixedHours,        setDepartmentFixedHours]        = useState({});
  const [departmentLoading,       setDepartmentLoading]       = useState({});
  const [loadingDepartments,      setLoadingDepartments]      = useState(true);
  const [draft,                   setDraft]                   = useState(null);
  const [loadingSettings,         setLoadingSettings]         = useState(true);
  const [savingSettings,          setSavingSettings]          = useState(false);
  const [refreshing,              setRefreshing]              = useState(false);
  const [showTimezoneModal,       setShowTimezoneModal]       = useState(false);
  const [pendingTimezone,         setPendingTimezone]         = useState(null);
  const [currentTime,             setCurrentTime]             = useState("");
  const [guideOpen,               setGuideOpen]               = useState(false);
  const [activeTab,               setActiveTab]               = useState("time-settings");

  // ── Live clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const tz = pendingTimezone || draft?.timezone || "America/Los_Angeles";
      try {
        setCurrentTime(new Intl.DateTimeFormat("en-US", {
          timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: true, weekday: "short", year: "numeric", month: "short", day: "numeric",
        }).format(new Date()));
      } catch { setCurrentTime("Invalid timezone"); }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [pendingTimezone, draft?.timezone]);

  // ── API: GET /api/company-settings + GET /api/company/me ─────────────────
  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const [settingsRes, profileRes] = await Promise.all([
        fetch(`${API}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/company/me`,        { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [settingsJson, profileJson] = await Promise.all([settingsRes.json(), profileRes.json()]);
      if (settingsRes.ok) setDraft(settingsJson.data || {});
      else toast.error(settingsJson.message || "Failed to load settings");
      if (profileRes.ok) setCompanyId(profileJson.data?.id || null);
    } catch { toast.error("Network error loading settings"); }
    setLoadingSettings(false);
  };

  // ── API: GET /api/departments ─────────────────────────────────────────────
  const loadDepartments = async () => {
    setLoadingDepartments(true);
    try {
      const r = await fetch(`${API}/api/departments`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok && j.data) {
        setDepartments(j.data);
        const bs = {}, cs = {}, als = {}, abe = {}, fh = {};
        j.data.forEach((d) => {
          bs[d.id] = d.paidBreak || false;
          cs[d.id] = {
            coffeeBreakMaxCount: d.coffeeBreakMaxCount || 0,
            coffeeBreakMinutes:  d.coffeeBreakMinutes  || 0,
            coffeeBreakPaid:     d.coffeeBreakPaid     || false,
          };
          als[d.id] = {
            autoLunchDurationMinutes: d.autoLunchDurationMinutes ?? 60,
            autoLunchAfterHours:      d.autoLunchAfterHours      ?? 4,
          };
          abe[d.id] = {
            autoLunchEntitled:        d.autoLunchEntitled        || false,
            autoBreakLunchMinutes:    d.autoBreakLunchMinutes    ?? 60,
            autoBreakLunchAfterHours: d.autoBreakLunchAfterHours ?? 5,
            autoBreakLunchDeductible: d.autoBreakLunchDeductible || false,
            autoCoffeeEntitled:       d.autoCoffeeEntitled       || false,
            autoBreakCoffeeCount:     d.autoBreakCoffeeCount     ?? 2,
            autoBreakCoffeeMinutes:   d.autoBreakCoffeeMinutes   ?? 15,
            autoBreakCoffeeDeductible:d.autoBreakCoffeeDeductible|| false,
          };
          fh[d.id] = {
            fixedHoursEnabled:   d.fixedHoursEnabled   || false,
            fixedHoursPerCutoff: d.fixedHoursPerCutoff ?? 80,
          };
        });
        setDepartmentBreakSettings(bs);
        setDepartmentCoffeeSettings(cs);
        setDepartmentAutoLunchSettings(als);
        setDepartmentAutoBreakEntitlement(abe);
        setDepartmentFixedHours(fh);
      } else toast.error(j.message || "Failed to load departments");
    } catch { toast.error("Network error loading departments"); }
    setLoadingDepartments(false);
  };

  // ── API: PUT /api/departments/update/:id (break) ──────────────────────────
  const updateDepartmentBreakSetting = async (deptId, paidBreak) => {
    setDepartmentLoading((p) => ({ ...p, [deptId]: true }));
    try {
      const r = await fetch(`${API}/api/departments/update/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paidBreak }),
      });
      const j = await r.json();
      if (r.ok) { setDepartmentBreakSettings((p) => ({ ...p, [deptId]: paidBreak })); toast.success(`${paidBreak ? "Enabled" : "Disabled"} paid lunch breaks`); }
      else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setDepartmentLoading((p) => ({ ...p, [deptId]: false }));
  };

  // ── API: PUT /api/departments/update/:id (coffee) ─────────────────────────
  const updateDepartmentCoffeeSetting = async (deptId, updates) => {
    setDepartmentLoading((p) => ({ ...p, [`coffee_${deptId}`]: true }));
    try {
      const r = await fetch(`${API}/api/departments/update/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (r.ok) { setDepartmentCoffeeSettings((p) => ({ ...p, [deptId]: { ...p[deptId], ...updates } })); toast.success("Coffee break settings updated"); }
      else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setDepartmentLoading((p) => ({ ...p, [`coffee_${deptId}`]: false }));
  };

  // ── API: PUT /api/departments/update/:id (auto-lunch) ────────────────────
  const updateDepartmentAutoLunchSetting = async (deptId, updates) => {
    setDepartmentLoading((p) => ({ ...p, [`autolunch_${deptId}`]: true }));
    try {
      const r = await fetch(`${API}/api/departments/update/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (r.ok) {
        setDepartmentAutoLunchSettings((p) => ({ ...p, [deptId]: { ...p[deptId], ...updates } }));
        toast.success("Auto-lunch settings updated");
      } else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setDepartmentLoading((p) => ({ ...p, [`autolunch_${deptId}`]: false }));
  };

  // ── API: PUT /api/departments/update/:id (auto-break config) ────────────
  const updateDepartmentAutoBreakConfig = async (deptId, updates) => {
    const firstKey = Object.keys(updates)[0];
    const loadingKey = `autobreak_${firstKey}_${deptId}`;
    setDepartmentLoading((p) => ({ ...p, [loadingKey]: true }));
    try {
      const r = await fetch(`${API}/api/departments/update/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (r.ok) {
        setDepartmentAutoBreakEntitlement((p) => ({ ...p, [deptId]: { ...p[deptId], ...updates } }));
        toast.success("Department auto-break config updated");
      } else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setDepartmentLoading((p) => ({ ...p, [loadingKey]: false }));
  };

  // ── API: PUT /api/departments/update/:id (fixed hours — BB-089) ──────────
  const updateDepartmentFixedHours = async (deptId, updates) => {
    const firstKey = Object.keys(updates)[0];
    const loadingKey = `fixedhours_${firstKey}_${deptId}`;
    setDepartmentLoading((p) => ({ ...p, [loadingKey]: true }));
    try {
      const r = await fetch(`${API}/api/departments/update/${deptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      const j = await r.json();
      if (r.ok) {
        setDepartmentFixedHours((p) => ({ ...p, [deptId]: { ...p[deptId], ...updates } }));
        toast.success("Fixed hours settings updated");
      } else toast.error(j.message || j.error || "Failed to update");
    } catch { toast.error("Network error"); }
    setDepartmentLoading((p) => ({ ...p, [loadingKey]: false }));
  };

  // ── API: PATCH /api/company-settings ─────────────────────────────────────
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const r = await fetch(`${API}/api/company-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      });
      const j = await r.json();
      if (r.ok) toast.success("Settings saved successfully!");
      else toast.error(j.message || "Failed to save settings");
    } catch { toast.error("Network error saving settings"); }
    setSavingSettings(false);
  };

  const handleTimezoneChange = (val) => { setPendingTimezone(val); setShowTimezoneModal(true); };
  const confirmTimezoneChange = () => {
    if (!pendingTimezone) return;
    setDraft((p) => ({ ...p, timezone: pendingTimezone }));
    setShowTimezoneModal(false);
    toast.success("Timezone updated. Don't forget to save settings!");
    setPendingTimezone(null);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadDepartments(), loadSettings()]);
    toast.success("Data refreshed");
    setRefreshing(false);
  };

  useEffect(() => {
    if (token) { loadSettings(); loadDepartments(); }
  }, [token]);

  // ── DayCare detection ────────────────────────────────────────────────────
  const DAYCARE_COMPANY_IDS = (process.env.NEXT_PUBLIC_DAYCARE_COMPANY_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  const isDayCare = companyId ? DAYCARE_COMPANY_IDS.includes(companyId) : false;

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: "time-settings",  label: "Time Settings" },
    { id: "ot-config",      label: "OT Configurations" },
    ...(isDayCare ? [{ id: "daycare", label: "DayCare Settings" }] : []),
    { id: "break-policy",   label: "Break Policy" },
    { id: "fixed-hours",    label: "Fixed Hours" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <Toaster position="top-center" />

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            Company Configurations
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Manage time-keeping, breaks, and department settings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuickGuideTrigger open={guideOpen} onClick={() => setGuideOpen((v) => !v)} />
          <Button variant="outline" onClick={refreshData} disabled={refreshing} className="border-orange-200 text-orange-600 hover:bg-orange-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Quick Guide panel — spans full width below header */}
      <QuickGuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} isDayCare={isDayCare} />

      {/* Tab navigation — horizontally scrollable on narrow viewports */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 sm:px-5 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors focus:outline-none ${
                activeTab === tab.id
                  ? "text-orange-600 border-orange-600"
                  : "text-neutral-500 border-transparent hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Timezone confirm modal — shared across tabs, only ever opened from the Time Settings tab */}
      <TimezoneConfirmModal
        open={showTimezoneModal} onOpenChange={setShowTimezoneModal}
        pendingTz={pendingTimezone} currentTz={draft?.timezone || "America/Los_Angeles"}
        onConfirm={confirmTimezoneChange} previewTime={currentTime}
      />

      {/* Tab content */}
      {activeTab === "time-settings" && (
        <div className="space-y-5">
          <CompanyTimezoneCard
            loading={loadingSettings} draft={draft}
            currentTime={currentTime} onTimezoneChange={handleTimezoneChange}
          />
          <TimeDefaultsCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
          <AutoClockOutCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
          <SaveSettingsBar onSave={saveSettings} saving={savingSettings || loadingSettings} />
        </div>
      )}

      {activeTab === "ot-config" && (
        <div className="space-y-5">
          <OvertimeConfigCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
          <SaveSettingsBar onSave={saveSettings} saving={savingSettings || loadingSettings} />
        </div>
      )}

      {activeTab === "daycare" && isDayCare && (
        <div className="space-y-5">
          <DayCareSettingsCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
          <SaveSettingsBar onSave={saveSettings} saving={savingSettings || loadingSettings} />
        </div>
      )}

      {activeTab === "break-policy" && (
        <div className="space-y-5">
          <AutoBreakPolicyCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
          <SaveSettingsBar onSave={saveSettings} saving={savingSettings || loadingSettings} label="Save Break Policy" />
          <DepartmentBreakPolicyCard
            departments={departments} departmentBreakSettings={departmentBreakSettings}
            departmentAutoLunchSettings={departmentAutoLunchSettings}
            setDepartmentAutoLunchSettings={setDepartmentAutoLunchSettings}
            departmentLoading={departmentLoading}
            updateDepartmentBreakSetting={updateDepartmentBreakSetting}
            updateDepartmentAutoLunchSetting={updateDepartmentAutoLunchSetting}
            loading={loadingDepartments}
            autoBreakBasis={draft?.autoBreakBasis ?? "department"}
            autoLunchEnabled={draft?.autoLunchEnabled ?? false}
            departmentAutoBreakEntitlement={departmentAutoBreakEntitlement}
            setDepartmentAutoBreakEntitlement={setDepartmentAutoBreakEntitlement}
            updateDepartmentAutoBreakConfig={updateDepartmentAutoBreakConfig}
          />
          <DepartmentCoffeeBreakPolicyCard
            departments={departments} departmentCoffeeSettings={departmentCoffeeSettings}
            departmentLoading={departmentLoading} updateDepartmentCoffeeSetting={updateDepartmentCoffeeSetting}
            loading={loadingDepartments}
            autoBreakBasis={draft?.autoBreakBasis ?? "department"}
            autoCoffeeEnabled={draft?.autoCoffeeEnabled ?? false}
            departmentAutoBreakEntitlement={departmentAutoBreakEntitlement}
            setDepartmentAutoBreakEntitlement={setDepartmentAutoBreakEntitlement}
            updateDepartmentAutoBreakConfig={updateDepartmentAutoBreakConfig}
          />
        </div>
      )}

      {activeTab === "fixed-hours" && (
        <div className="space-y-5">
          <DepartmentFixedHoursCard
            departments={departments} departmentFixedHours={departmentFixedHours}
            departmentLoading={departmentLoading}
            updateDepartmentFixedHours={updateDepartmentFixedHours}
            loading={loadingDepartments}
            api={API} token={token}
          />
        </div>
      )}
    </div>
  );
}