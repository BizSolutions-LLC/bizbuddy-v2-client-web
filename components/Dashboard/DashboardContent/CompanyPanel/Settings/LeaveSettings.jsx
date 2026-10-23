"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx
// Extracted out of CompanyConfigurations.jsx — Leave Type/Credits/Accrual/Approval
// had grown into their own domain (5 cards) inside an already-2900-line file.

import { useEffect, useState, useMemo } from "react";
import {
  AlertCircle, Archive, ArchiveRestore, Award, Calendar, Check, ChevronDown, CreditCard, Download, Edit3, FileText, Info, Loader2,
  Plus, RefreshCw, Save, Settings, ShieldAlert, Timer, Trash2, TrendingUp, User, Users,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { normalizeLeaveMatrixRow } from "@/lib/leaveBalanceUtils";
import MultiSelect from "@/components/common/MultiSelect";
import LeaveReportDialog from "./LeaveReportDialog";

// ── Icon color map ────────────────────────────────────────────────────────────
const ICON_COLOR = {
  orange: "bg-orange-50 text-orange-600 border-orange-200",
  blue:   "bg-blue-50   text-blue-600   border-blue-200",
  green:  "bg-green-50  text-green-600  border-green-200",
  purple: "bg-purple-50 text-purple-600 border-purple-200",
  amber:  "bg-amber-50  text-amber-600  border-amber-200",
};

// ── Shared sub-components ────────────────────────────────────────────────────

function CardStripe() {
  return <div className="h-[3px] w-full bg-orange-500" />;
}

function SectionIcon({ icon: Icon, color = "orange" }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${ICON_COLOR[color]}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

// ── Month options (fiscal year start) ────────────────────────────────────────

const MONTH_OPTIONS = [
  { value: 1,  label: "January" },
  { value: 2,  label: "February" },
  { value: 3,  label: "March" },
  { value: 4,  label: "April" },
  { value: 5,  label: "May" },
  { value: 6,  label: "June" },
  { value: 7,  label: "July" },
  { value: 8,  label: "August" },
  { value: 9,  label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// ── Leave Credits Card (BB-098) ──────────────────────────────────────────────
// Fiscal-year grants, regularization and expiration — docs/CLIENT_LEAVE_CONTRACT.md
// BB-098. Replaces the old Leave Accrual card, whose fields the server never read.
//
// This card saves its own fields and is kept out of the page-level Save on purpose:
// the server validates the leave credit fields as one set, and a toggle sent from
// stale form state would quietly turn the feature off. A toggle is only ever sent
// when the admin flips it, and turning one on always goes through preview → apply.

const LEAVE_CREDIT_FIELDS = [
  "leaveGrantMode", "leaveGrantHours", "leaveYearStartMonth", "leaveYearStartDay",
  "leaveCreditLifetimeYears", "leaveExpiryReminderDays", "leaveRegularizationMonths", "leaveRegularizationGrant",
];

// Everything BB-098 owns — stripped from the page-level settings PATCH.
const LEAVE_CREDIT_KEYS = [...LEAVE_CREDIT_FIELDS, "leaveGrantEnabled", "leaveExpirationEnabled", "leaveCreditsInitializedAt"];

const LEAVE_CREDIT_NUMERIC = new Set([
  "leaveGrantHours", "leaveYearStartMonth", "leaveYearStartDay",
  "leaveCreditLifetimeYears", "leaveExpiryReminderDays", "leaveRegularizationMonths",
]);

const GRANT_MODE_OPTIONS = [
  { value: "yearly_lump",     label: "Yearly lump sum" },
  { value: "monthly_accrual", label: "Monthly accrual" },
];

// Valid regularization rules differ per grant mode — the server rejects any other pairing.
const REGULARIZATION_OPTIONS = {
  yearly_lump: [
    { value: "none",     label: "None — first grant at the next fiscal year" },
    { value: "prorated", label: "Prorated — months left in the fiscal year" },
    { value: "full",     label: "Full — the whole yearly grant" },
  ],
  monthly_accrual: [
    { value: "none",     label: "None — start accruing after regularization" },
    { value: "catch_up", label: "Catch up — credit the waiting-period months" },
  ],
};

// "YYYY-MM-DD" → "Mar 1, 2027" without a UTC shift.
function formatYmd(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function creditFormFrom(settings) {
  const form = {};
  LEAVE_CREDIT_FIELDS.forEach((k) => { form[k] = settings?.[k] != null ? String(settings[k]) : ""; });
  if (!form.leaveGrantMode) form.leaveGrantMode = "yearly_lump";
  if (!form.leaveRegularizationGrant) form.leaveRegularizationGrant = "none";
  return form;
}

function creditBodyFrom(form) {
  const body = {};
  LEAVE_CREDIT_FIELDS.forEach((k) => { body[k] = LEAVE_CREDIT_NUMERIC.has(k) ? Number(form[k]) : form[k]; });
  return body;
}

function CreditToggle({ checked, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 ml-4 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  );
}

// Preview (read-only) → Apply. Same body goes to both endpoints.
function LeaveCreditSetupDialog({ open, onClose, token, API, body, onApplied }) {
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !body || !token) return;
    setPreview(null); setError(null); setLoading(true);
    fetch(`${API}/api/leave-balances/credit-setup/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || j.error || "Failed to build the preview");
        setPreview(j.data);
      })
      .catch((e) => setError(e.message || "Failed to build the preview"))
      .finally(() => setLoading(false));
  }, [open, body, token, API]);

  const apply = async () => {
    setApplying(true);
    try {
      const r = await fetch(`${API}/api/leave-balances/credit-setup/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.status === 409) {
        toast.info("Leave credit setup was already applied by someone else. Settings have been refreshed.");
        onApplied(null);
        onClose();
        return;
      }
      if (!r.ok) { toast.error(j.message || j.error || "Failed to apply leave credit setup"); return; }
      const applied = j.data?.applied || {};
      if (applied.lotsCreatedFor != null) {
        toast.success(`Leave credits set up for ${applied.lotsCreatedFor} balance${applied.lotsCreatedFor === 1 ? "" : "s"}${applied.expiredHours ? ` — ${applied.expiredHours}h expired` : ""}.`);
      } else if (applied.expired) {
        toast.success(`Leave credit settings applied — ${applied.expired.hours || 0}h expired.`);
      } else {
        toast.success("Leave credit settings applied.");
      }
      onApplied(j.data?.settings || null);
      onClose();
    } catch { toast.error("Network error applying leave credit setup"); }
    finally { setApplying(false); }
  };

  const totals = preview?.totals;
  const missing = preview?.regularization?.missingHireDate || [];
  const waiting = preview?.regularization?.inWaitingPeriod || [];

  // One column per fiscal year present in any row's lots, newest first.
  const lotYears = useMemo(() => {
    const byYear = new Map();
    for (const row of preview?.rows || []) {
      for (const l of row.lots) if (!byYear.has(l.fiscalYear)) byYear.set(l.fiscalYear, l.label);
    }
    return [...byYear].sort((a, b) => b[0] - a[0]).map(([fiscalYear, label]) => ({ fiscalYear, label }));
  }, [preview]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <DialogContent className="sm:max-w-4xl overflow-hidden">
        <div className="h-[3px] bg-orange-500 -mt-6 mb-4 -mx-6" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Award className="w-4 h-4 text-orange-600" />
            </span>
            Review Leave Credit Setup
          </DialogTitle>
          <DialogDescription>
            Nothing changes until you click Apply. Check what each employee keeps and what expires first.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
          </div>
        ) : preview ? (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <p className="text-xs text-neutral-500">
              Current fiscal year: <span className="font-semibold text-neutral-700 dark:text-neutral-200">{preview.currentFiscalYear?.label}</span>
              {" "}({formatYmd(preview.currentFiscalYear?.startsOn)} – {formatYmd(preview.currentFiscalYear?.endsOn)})
              {!preview.initialized && " · Existing balances are split into fiscal-year lots, newest first."}
            </p>

            {totals && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Employees With Balance", value: totals.activeEmployeesWithBalance,  color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
                  { label: "Current Balance",        value: `${totals.balanceHours}h`,          color: "text-green-600",  bg: "bg-green-50 border-green-200" },
                  { label: "Expiring Now",           value: `${totals.expiringNowHours}h`,      color: "text-red-600",    bg: "bg-red-50 border-red-200" },
                  { label: "Balance After",          value: `${totals.balanceAfterHours}h`,     color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl border-[1.5px] p-3 ${bg}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</p>
                    <p className={`text-xl font-extrabold font-mono ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-400 -mt-2">Totals count active employees only.</p>

            {missing.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold text-amber-900 mb-1">
                    {missing.length} employee{missing.length === 1 ? " has" : "s have"} no hire date
                  </p>
                  <p className="text-[11px] text-amber-700 mb-1.5">Grants skip them until a hire date is set on their profile.</p>
                  <p className="text-[11px] text-amber-800">{missing.map((m) => m.name).join(", ")}</p>
                </div>
              </div>
            )}

            {waiting.length > 0 && (
              <div className="bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
                <p className="text-[12px] font-bold mb-1.5">In regularization waiting period ({waiting.length})</p>
                <ul className="text-[11px] text-neutral-500 space-y-0.5">
                  {waiting.map((w) => (
                    <li key={w.userId}>• {w.name} — regularizes {formatYmd(w.regularizationDate)}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.rows?.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">No employee has a leave balance yet.</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-800/60 sticky top-0">
                      <th className="text-left  px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Employee</th>
                      <th className="text-left  px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Leave Type</th>
                      <th className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Balance</th>
                      {lotYears.map((y) => (
                        <th key={y.fiscalYear} className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{y.label}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Expiring Now</th>
                      <th className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={`${row.userId}:${row.policyId}`} className="border-t border-neutral-100 dark:border-neutral-800 align-top">
                        <td className="px-3 py-2 text-xs">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200">{row.name}</span>
                          {row.status !== "active" && <span className="ml-1.5 text-[10px] text-neutral-400">({row.status})</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
                          {row.leaveType}
                          {row.isArchived && <span className="ml-1.5 text-[10px] text-neutral-400">(archived)</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{row.balanceHours}h</td>
                        {lotYears.map((y) => {
                          const l = row.lots.find((lot) => lot.fiscalYear === y.fiscalYear);
                          if (!l) return <td key={y.fiscalYear} className="px-3 py-2 text-right text-xs text-neutral-300">—</td>;
                          return (
                            <td
                              key={y.fiscalYear}
                              title={`Expires ${formatYmd(l.expiresOn)}`}
                              className={`px-3 py-2 text-right font-mono text-xs ${
                                l.expiresImmediately ? "text-red-600 line-through" : "text-neutral-600 dark:text-neutral-300"
                              }`}
                            >
                              {l.hours}h
                            </td>
                          );
                        })}
                        <td className={`px-3 py-2 text-right font-mono text-xs ${row.expiringNowHours > 0 ? "text-red-600 font-semibold" : "text-neutral-400"}`}>
                          {row.expiringNowHours > 0 ? `-${row.expiringNowHours}h` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{row.balanceAfterHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applying}>Cancel</Button>
          <Button
            onClick={apply}
            disabled={loading || applying || !preview}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveCreditsSettingsCard({ loading, settings, token, API, onSettingsChange, onApplied }) {
  const [form,        setForm]        = useState(() => creditFormFrom(settings));
  const [saving,      setSaving]      = useState(false);
  const [togglingKey, setTogglingKey] = useState(null);
  const [setupBody,   setSetupBody]   = useState(null);

  // Re-sync only when the saved credit fields change — edits in the other cards
  // also replace `settings`, and shouldn't wipe unsaved edits here.
  const savedKey = JSON.stringify(creditFormFrom(settings));
  useEffect(() => { setForm(JSON.parse(savedKey)); }, [savedKey]);

  const grantOn       = settings?.leaveGrantEnabled      ?? false;
  const expirationOn  = settings?.leaveExpirationEnabled ?? false;
  const initializedAt = settings?.leaveCreditsInitializedAt || null;
  const locked        = Boolean(initializedAt);

  const dirty = JSON.stringify(form) !== savedKey;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  // The valid regularization rules depend on the mode, so reset it on a mode change.
  const setMode = (mode) => setForm((f) => ({ ...f, leaveGrantMode: mode, leaveRegularizationGrant: "none" }));

  // PATCH only the leave credit fields — never the toggles.
  const saveFields = async () => {
    setSaving(true);
    try {
      const body = creditBodyFrom(form);
      const r = await fetch(`${API}/api/company-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || j.message || "Failed to save leave credit settings"); return; }
      onSettingsChange(body);
      toast.success("Leave credit settings saved");
    } catch { toast.error("Network error saving leave credit settings"); }
    finally { setSaving(false); }
  };

  const flipToggle = async (key, current) => {
    if (!current) {
      // Turning on: preview with the form as it stands (unsaved edits included), then apply.
      setSetupBody({
        ...creditBodyFrom(form),
        leaveGrantEnabled: grantOn,
        leaveExpirationEnabled: expirationOn,
        [key]: true,
      });
      return;
    }
    // Turning off is always allowed — send only this one toggle.
    setTogglingKey(key);
    try {
      const r = await fetch(`${API}/api/company-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: false }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || j.message || "Failed to update leave credit settings"); return; }
      onSettingsChange({ [key]: false });
      toast.success(key === "leaveGrantEnabled" ? "Automatic grants turned off" : "Expiration turned off");
    } catch { toast.error("Network error updating leave credit settings"); }
    finally { setTogglingKey(null); }
  };

  const regOptions = REGULARIZATION_OPTIONS[form.leaveGrantMode] || [];

  return (
    <>
      <LeaveCreditSetupDialog
        open={Boolean(setupBody)}
        onClose={() => setSetupBody(null)}
        token={token}
        API={API}
        body={setupBody}
        onApplied={onApplied}
      />
      <Card className="border-[1.5px] shadow-md overflow-hidden">
        <CardStripe />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
              <SectionIcon icon={Calendar} color="green" />
              Leave Credits
            </CardTitle>
            {!loading && (
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                locked ? "bg-green-50 text-green-700 border-green-200" : "bg-neutral-50 text-neutral-500 border-neutral-200"
              }`}>
                {locked ? `Set up ${new Date(initializedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "Not set up yet"}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Grant leave credits each fiscal year, hold them through a regularization period, and expire unused credits.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "leaveGrantEnabled",      on: grantOn,      title: "Automatic Grants",  desc: "Credit employees every fiscal year (or month) without manual adjustments." },
                  { key: "leaveExpirationEnabled", on: expirationOn, title: "Credit Expiration", desc: "Expire unused credits after their lifetime and remind employees beforehand." },
                ].map(({ key, on, title, desc }) => (
                  <div key={key} className="flex items-start justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
                    </div>
                    {togglingKey === key ? (
                      <Loader2 className="w-5 h-5 animate-spin text-orange-500 ml-4" />
                    ) : (
                      <CreditToggle checked={on} disabled={Boolean(togglingKey)} onClick={() => flipToggle(key, on)} />
                    )}
                  </div>
                ))}
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pl-1">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Grant Mode</Label>
                  <Select value={form.leaveGrantMode} onValueChange={setMode} disabled={locked}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select mode" /></SelectTrigger>
                    <SelectContent>
                      {GRANT_MODE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-400">All at the fiscal year start, or 1/12 each month.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Hours per Fiscal Year</Label>
                  <Input type="number" min={0} step="0.5" value={form.leaveGrantHours} onChange={(e) => setField("leaveGrantHours", e.target.value)} />
                  <p className="text-xs text-neutral-400">Total granted per employee per leave type each fiscal year.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Fiscal Year Start</Label>
                  <div className="flex gap-2">
                    <Select value={form.leaveYearStartMonth} onValueChange={(v) => setField("leaveYearStartMonth", v)} disabled={locked}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {MONTH_OPTIONS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number" min={1} max={28} className="w-24"
                      value={form.leaveYearStartDay} disabled={locked}
                      onChange={(e) => setField("leaveYearStartDay", e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-neutral-400">Month and day (1–28) each fiscal year begins.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Credit Lifetime (Fiscal Years)</Label>
                  <Input type="number" min={1} max={10} value={form.leaveCreditLifetimeYears} onChange={(e) => setField("leaveCreditLifetimeYears", e.target.value)} />
                  <p className="text-xs text-neutral-400">How many fiscal years credits stay usable, counting the year granted.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Expiry Reminder (Days Before)</Label>
                  <Input type="number" min={0} max={365} value={form.leaveExpiryReminderDays} onChange={(e) => setField("leaveExpiryReminderDays", e.target.value)} />
                  <p className="text-xs text-neutral-400">Notify the employee this many days before credits expire. 0 = no reminder.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Regularization Period (Months)</Label>
                  <Input type="number" min={0} max={60} value={form.leaveRegularizationMonths} onChange={(e) => setField("leaveRegularizationMonths", e.target.value)} />
                  <p className="text-xs text-neutral-400">Waiting period from hire date before grants start. 0 = none.</p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm font-semibold">Grant on Regularization</Label>
                  <Select value={form.leaveRegularizationGrant} onValueChange={(v) => setField("leaveRegularizationGrant", v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select rule" /></SelectTrigger>
                    <SelectContent>
                      {regOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-400">What an employee receives on the day their waiting period ends.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveFields} disabled={!dirty || saving} className="bg-orange-500 hover:bg-orange-600 text-white text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Credit Settings
                </Button>
              </div>

              {/* Info callout */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
                <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-bold text-green-900 mb-1.5">How Leave Credits Work</p>
                  <ul className="text-[11px] text-green-700 space-y-0.5">
                    <li>• Turning a toggle on opens a preview of every employee&apos;s fiscal-year credits — nothing changes until you apply</li>
                    <li>• Credits are used oldest first; each fiscal year&apos;s credits expire together when expiration is on</li>
                    <li>• Fiscal year start and grant mode are locked once setup has been applied</li>
                    <li>• Either toggle can be turned off at any time</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── Leave Approval Card ──────────────────────────────────────────────────────
function LeaveApprovalCard({ loading, draft, setDraft }) {
  const enabled = draft?.multiApprovalEnabled ?? false;

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Users} color="blue" />
          Leave Approval
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Configure how leave requests are approved before they take effect.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {/* Multi-approval enable toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div>
                <p className="text-sm font-semibold">Enable Two-Step Leave Approval</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  When enabled, leave requests are approved by the employee's selected supervisor first, then escalated to an eligible admin or the employee's department supervisor, chosen at the time of escalation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraft((o) => ({ ...o, multiApprovalEnabled: !enabled }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 ml-4 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                  enabled ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Info callout */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-blue-900 mb-1.5">How Two-Step Approval Works</p>
                <ul className="text-[11px] text-blue-700 space-y-0.5">
                  <li>• Employee submits a leave request and selects their direct supervisor as approver</li>
                  <li>• Supervisor approves and chooses an eligible admin or department supervisor to escalate to → status moves to <strong>Pending Final Approval</strong></li>
                  <li>• The chosen escalation target gives the last sign-off → status moves to <strong>Approved</strong></li>
                  <li>• Either approver can reject at any stage — request is immediately rejected</li>
                  <li>• When disabled, the supervisor's approval is final</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Leave Conflict Card (BB-051) ─────────────────────────────────────────────
// Toggle only — deliberately does not touch today's revert mechanics (whole-leave
// cancellation, flat default-shift-length refund, no ledger entry). Those stay
// as-is; this setting only changes who/what triggers the resolution. See
// docs/UPDATED_LEAVE_MODULE.md §15.2 — this is Phase 6 ("Cancel Leave"), narrowly
// scoped per that discussion rather than reopened in full.
function LeaveConflictCard({ loading, draft, setDraft }) {
  const enabled = draft?.leaveConflictAutoRevert ?? false;

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={ShieldAlert} color="amber" />
          Punch-vs-Leave Conflicts
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Choose whether a punch on an approved leave day resolves automatically or waits for an admin to decide.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div>
                <p className="text-sm font-semibold">Automatically Resolve Punch-vs-Leave Conflicts</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  When on, a punch on a day with an approved leave automatically honors the punch and refunds the leave. When off (default), an admin reviews and chooses in Cutoff Review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraft((o) => ({ ...o, leaveConflictAutoRevert: !enabled }))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 ml-4 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                  enabled ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Info callout */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-amber-900 mb-1.5">What This Does — and Doesn&apos;t — Change</p>
                <ul className="text-[11px] text-amber-700 space-y-0.5">
                  <li>• Only changes who/what triggers the resolution — an admin clicking Honor Punch/Honor Leave, or the system doing it automatically</li>
                  <li>• The refund itself is unchanged: the whole leave request is cancelled and a flat default-shift-length credit is returned</li>
                  <li>• A punch on a shift the employee explicitly excluded from their leave never counts as a conflict, regardless of this setting</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Leave Types Card ─────────────────────────────────────────────────────────
// Assignment picker selection is modeled as an array of employee ids, with the
// sentinel "all" meaning assignedToAll — mirrors MultiSelect's own "all" row so
// the picker can be reused as-is instead of building a second employee list UI.
function toggleAssignmentSelection(prev, val) {
  if (val === "all") return ["all"];
  let list = prev.filter((x) => x !== "all");
  list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  return list.length ? list : ["all"];
}

function LeaveTypeAccessFields({
  isPaid, setIsPaid, isNotPaid, setIsNotPaid,
  assignedIds, setAssignedIds, employeeOptions,
}) {
  const noPayMode = !isPaid && !isNotPaid;
  const assignedToAll = assignedIds.includes("all");
  const nobodySelected = !assignedToAll && assignedIds.length === 0;

  return (
    <>
      <div className="space-y-1.5">
        <Label>Pay mode <span className="text-orange-500">*</span></Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={isPaid} onCheckedChange={(v) => setIsPaid(!!v)} /> Paid
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={isNotPaid} onCheckedChange={(v) => setIsNotPaid(!!v)} /> Unpaid
          </label>
        </div>
        {noPayMode && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> At least one of Paid or Unpaid must be enabled.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Assigned to</Label>
        <MultiSelect
          options={employeeOptions}
          selected={assignedIds}
          onChange={(v) => setAssignedIds((prev) => toggleAssignmentSelection(prev, v))}
          allLabel="All employees"
          width={0}
          className="w-full"
          searchable
          sortable
        />
        {nobodySelected && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Select at least one employee, or choose "All employees".
          </p>
        )}
      </div>
    </>
  );
}

function LeaveTypesCard({ API, token, policies, reload }) {
  const [createModal, setCreateModal] = useState(false);
  const [editModal,   setEditModal]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [createName,  setCreateName]  = useState("");
  const [editName,    setEditName]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [archiving,   setArchiving]   = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [createIsPaid,    setCreateIsPaid]    = useState(true);
  const [createIsNotPaid, setCreateIsNotPaid] = useState(true);
  const [createAssigned,  setCreateAssigned]  = useState(["all"]);
  const [editIsPaid,       setEditIsPaid]      = useState(true);
  const [editIsNotPaid,    setEditIsNotPaid]   = useState(true);
  const [editAssigned,     setEditAssigned]    = useState(["all"]);

  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/employee?all=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j?.data) setEmployees(j.data); })
      .catch(() => {});
  }, [API, token]);

  const employeeOptions = useMemo(() => employees.map((e) => {
    const name = `${e.profile?.firstName || ""} ${e.profile?.lastName || ""}`.trim();
    return { value: e.id, label: name || e.email?.split("@")[0] || e.id };
  }), [employees]);

  const processed = policies
    .filter((p) => showArchived || !p.isArchived)
    .map((p, i) => ({ ...p, id: p.id || i, name: p.leaveType }));

  const columns = [
    {
      key: "name", label: "Leave Type", sortable: true,
      render: (name, p) => (
        <div className={`flex items-center gap-3 ${p.isArchived ? "opacity-60" : ""}`}>
          <div className="w-7 h-7 bg-green-50 border border-green-200 rounded-full flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-green-600" />
          </div>
          <span className="font-semibold text-sm">{name}</span>
          {p.isArchived && <Badge variant="outline" className="text-neutral-500 border-neutral-300 bg-neutral-50">Archived</Badge>}
        </div>
      ),
    },
    {
      key: "payMode", label: "Pay Mode",
      render: (_, p) => (
        <div className="flex gap-1.5">
          {p.isPaid !== false && <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">Paid</Badge>}
          {p.isNotPaid !== false && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Unpaid</Badge>}
        </div>
      ),
    },
    {
      key: "assignment", label: "Assigned To",
      render: (_, p) => p.assignedToAll === false ? (
        <span className="text-sm text-neutral-500 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> {(p.assignedUserIds || []).length} employee{(p.assignedUserIds || []).length === 1 ? "" : "s"}
        </span>
      ) : (
        <span className="text-sm text-neutral-500 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> All employees
        </span>
      ),
    },
  ];

  const actions = [
    {
      label: "Edit", icon: Edit3, className: "text-orange-600 hover:text-orange-700",
      onClick: (p) => {
        setSelected(p);
        setEditName(p.leaveType);
        setEditIsPaid(p.isPaid !== false);
        setEditIsNotPaid(p.isNotPaid !== false);
        setEditAssigned(p.assignedToAll === false ? (p.assignedUserIds?.length ? p.assignedUserIds : []) : ["all"]);
        setEditModal(true);
      },
    },
    {
      label: "Archive", icon: Archive, className: "text-neutral-600 hover:text-neutral-800",
      condition: (p) => !p.isArchived,
      onClick: (p) => setPolicyArchived(p, true),
    },
    {
      label: "Unarchive", icon: ArchiveRestore, className: "text-neutral-600 hover:text-neutral-800",
      condition: (p) => p.isArchived === true,
      onClick: (p) => setPolicyArchived(p, false),
    },
    { label: "Delete", icon: Trash2, onClick: (p) => { setSelected(p); setDeleteModal(true); },                           className: "text-red-600 hover:text-red-700" },
  ];

  // API: PUT /api/leave-policies/:id — isArchived toggle only, no other fields touched
  const setPolicyArchived = async (policy, isArchived) => {
    setArchiving(true);
    try {
      const r = await fetch(`${API}/api/leave-policies/${policy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isArchived }),
      });
      const j = await r.json();
      if (r.ok) { toast.success(isArchived ? "Leave type archived." : "Leave type restored."); reload(); }
      else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setArchiving(false);
  };

  // API: POST /api/leave-policies
  const createLeaveType = async () => {
    if (!createName.trim() || (!createIsPaid && !createIsNotPaid)) return;
    const assignedToAll = createAssigned.includes("all");
    if (!assignedToAll && createAssigned.length === 0) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/leave-policies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leaveType: createName.trim(),
          isPaid: createIsPaid,
          isNotPaid: createIsNotPaid,
          assignedToAll,
          ...(assignedToAll ? {} : { employeeIds: createAssigned }),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Leave type created!");
        setCreateModal(false);
        setCreateName(""); setCreateIsPaid(true); setCreateIsNotPaid(true); setCreateAssigned(["all"]);
        reload();
      } else toast.error(j.message || "Failed to create leave type");
    } catch { toast.error("Network error"); }
    setCreating(false);
  };

  // API: PUT /api/leave-policies/:id
  const updateLeaveType = async () => {
    if (!editName.trim() || !selected || (!editIsPaid && !editIsNotPaid)) return;
    const assignedToAll = editAssigned.includes("all");
    if (!assignedToAll && editAssigned.length === 0) return;
    setEditing(true);
    try {
      const r = await fetch(`${API}/api/leave-policies/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leaveType: editName.trim(),
          isPaid: editIsPaid,
          isNotPaid: editIsNotPaid,
          assignedToAll,
          ...(assignedToAll ? {} : { employeeIds: editAssigned }),
        }),
      });
      const j = await r.json();
      if (r.ok) { toast.success("Leave type updated!"); setEditModal(false); setSelected(null); reload(); }
      else toast.error(j.message || "Failed to update");
    } catch { toast.error("Network error"); }
    setEditing(false);
  };

  // API: DELETE /api/leave-policies/:id
  // See docs/ERROR_CODES.md — LEAVE_POLICY_IN_USE (409) is the one registered code
  // so far, returned when Leave/LeaveBalance/LeaveTransaction/LeavePolicyAssignment
  // rows still reference this policy.
  const deleteLeaveType = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/leave-policies/${selected.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { toast.success("Leave type deleted!"); setDeleteModal(false); setSelected(null); reload(); }
      else {
        const j = await r.json();
        if (j.code === "LEAVE_POLICY_IN_USE") {
          const blocked = selected;
          setDeleteModal(false);
          toast("Leave Type In Use", {
            description: j.message || `"${blocked.leaveType}" still has requests, balances, or transactions referencing it. Archive it instead to stop future use while keeping its history intact.`,
            icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
            duration: 10000,
            action: { label: "Archive Instead", onClick: () => setPolicyArchived(blocked, true) },
          });
        } else {
          toast.error(j.message || "Failed to delete");
        }
      }
    } catch { toast.error("Network error"); }
    setDeleting(false);
  };

  return (
    <>
      <Card className="border-[1.5px] shadow-md overflow-hidden">
        <CardStripe />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
              <SectionIcon icon={Calendar} color="green" />
              Manage Leave Types
            </CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 cursor-pointer select-none">
                <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(!!v)} />
                Show archived
              </label>
              <Button onClick={() => setCreateModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white text-sm">
                <Plus className="w-4 h-4 mr-1.5" /> Create Leave Type
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable data={processed} columns={columns} actions={actions} searchPlaceholder="Search leave types…" pageSize={10} showPagination={false} />
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent>
          <div className="h-[3px] bg-orange-500 -mt-6 mb-4 -mx-6" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Plus className="w-4 h-4 text-orange-500" /></span>
              Create Leave Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type Name <span className="text-orange-500">*</span></Label>
              <Input placeholder="e.g. Vacation, Sick Leave, Personal Leave" value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creating && createLeaveType()} />
            </div>
            <LeaveTypeAccessFields
              isPaid={createIsPaid} setIsPaid={setCreateIsPaid}
              isNotPaid={createIsNotPaid} setIsNotPaid={setCreateIsNotPaid}
              assignedIds={createAssigned} setAssignedIds={setCreateAssigned}
              employeeOptions={employeeOptions}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateModal(false); setCreateName(""); setCreateIsPaid(true); setCreateIsNotPaid(true); setCreateAssigned(["all"]); }}>Cancel</Button>
            <Button
              onClick={createLeaveType}
              disabled={creating || !createName.trim() || (!createIsPaid && !createIsNotPaid) || (!createAssigned.includes("all") && createAssigned.length === 0)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent>
          <div className="h-[3px] bg-orange-500 -mt-6 mb-4 -mx-6" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Edit3 className="w-4 h-4 text-orange-500" /></span>
              Edit Leave Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Leave Type Name <span className="text-orange-500">*</span></Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !editing && updateLeaveType()} />
            </div>
            <LeaveTypeAccessFields
              isPaid={editIsPaid} setIsPaid={setEditIsPaid}
              isNotPaid={editIsNotPaid} setIsNotPaid={setEditIsNotPaid}
              assignedIds={editAssigned} setAssignedIds={setEditAssigned}
              employeeOptions={employeeOptions}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditModal(false); setSelected(null); }}>Cancel</Button>
            <Button
              onClick={updateLeaveType}
              disabled={editing || !editName.trim() || (!editIsPaid && !editIsNotPaid) || (!editAssigned.includes("all") && editAssigned.length === 0)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {editing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />} Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <div className="h-[3px] bg-red-500 -mt-6 mb-4 -mx-6" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-red-500" /></span>
              Delete Leave Type
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">
                Are you sure you want to delete <strong>"{selected.leaveType}"</strong>? This action cannot be undone.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteModal(false); setSelected(null); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={deleteLeaveType}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Adjust Credits Modal ──────────────────────────────────────────────────────
function AdjustCreditsModal({ open, onClose, token, API, leaveTypes, matrix, onSuccess }) {
  const [empSearch,      setEmpSearch]      = useState("");
  const [empOpen,        setEmpOpen]        = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [direction,      setDirection]      = useState("add"); // "add" | "subtract"
  const [amount,         setAmount]         = useState("");
  const [note,           setNote]           = useState("");
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setSelectedTypes([...leaveTypes]);
      setDirection("add");
      setAmount("");
      setNote("");
      setEmpSearch("");
      setEmpOpen(false);
    }
  }, [open]);

  const selectedEmployee = matrix.find((r) => String(r.userId) === selectedUserId);

  const filteredEmployees = empSearch
    ? matrix.filter((r) =>
        r.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
        r.email.toLowerCase().includes(empSearch.toLowerCase())
      )
    : matrix;

  const toggleType = (t) =>
    setSelectedTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const allSelected = leaveTypes.length > 0 && selectedTypes.length === leaveTypes.length;

  const numAmount  = parseFloat(amount) || 0;
  const finalHours = direction === "add" ? numAmount : -numAmount;
  const isValid    = selectedUserId && numAmount > 0 && selectedTypes.length > 0 && note.trim().length > 0;

  // API: POST /api/leave-balances/adjust
  const applyAdjust = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/leave-balances/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: selectedUserId, leaveTypes: selectedTypes, hours: finalHours, note: note.trim() }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(
          `${direction === "add" ? "Added" : "Subtracted"} ${numAmount}h across ${selectedTypes.length} leave type${selectedTypes.length !== 1 ? "s" : ""}`
        );
        onSuccess();
        onClose();
      } else {
        toast.error(j.message || "Failed to adjust");
      }
    } catch { toast.error("Network error"); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <div className="h-[3px] bg-gradient-to-r from-orange-500 via-red-400 to-orange-500 -mt-6 mb-4 -mx-6" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Award className="w-4 h-4 text-orange-600" />
            </span>
            Adjust Leave Credits
          </DialogTitle>
          <DialogDescription>
            Select an employee, choose which leave types to adjust, then add or subtract hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1">

          {/* ── Step 1: Employee ── */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-orange-500" /> Employee
            </label>
            <Popover open={empOpen} onOpenChange={setEmpOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {selectedEmployee ? (
                    <span className="font-semibold truncate">{selectedEmployee.fullName}</span>
                  ) : (
                    <span className="text-muted-foreground">Search and select an employee…</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-neutral-400 ml-2 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search by name or email…"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <ScrollArea className="h-52">
                  {filteredEmployees.length === 0 ? (
                    <div className="text-sm text-neutral-400 py-4 text-center">No employees found</div>
                  ) : (
                    filteredEmployees.map((r) => (
                      <button
                        key={r.userId}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(String(r.userId));
                          setEmpSearch("");
                          setEmpOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors flex items-center justify-between gap-2 ${
                          String(r.userId) === selectedUserId ? "bg-orange-50 dark:bg-orange-950/20" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.fullName}</p>
                          <p className="text-xs text-neutral-400 truncate">{r.email}</p>
                        </div>
                        {String(r.userId) === selectedUserId && (
                          <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {selectedEmployee && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                <div className="w-9 h-9 rounded-full bg-orange-200 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0">
                  {selectedEmployee.fullName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-sm text-orange-900">{selectedEmployee.fullName}</p>
                  <p className="text-xs text-orange-600">{selectedEmployee.email}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: Leave Types ── */}
          {selectedUserId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" /> Leave Types
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedTypes(allSelected ? [] : [...leaveTypes])}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-800 transition-colors"
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="space-y-1.5">
                {leaveTypes.map((t) => {
                  const cell      = selectedEmployee?.balances?.[t];
                  const isChecked = selectedTypes.includes(t);
                  const newAvail  = cell ? Math.max((cell.available ?? 0) + (isChecked ? finalHours : 0), 0) : null;

                  return (
                    <div
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                        isChecked
                          ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
                          : "border-neutral-200 bg-white dark:bg-neutral-900 hover:border-orange-200"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleType(t)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{t}</p>
                        {cell && (
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span className="text-[10px] font-mono font-semibold text-green-600">Credits: {cell.credits.toFixed(1)}h</span>
                            <span className="text-[10px] font-mono font-semibold text-red-500">Used: {cell.used.toFixed(1)}h</span>
                            <span className="text-[10px] font-mono font-semibold text-blue-600">Available: {cell.available.toFixed(1)}h</span>
                          </div>
                        )}
                      </div>
                      {/* Preview after adjustment */}
                      {isChecked && numAmount > 0 && newAvail !== null && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[9px] text-neutral-400 uppercase tracking-wide">After</p>
                          <p className={`text-xs font-bold font-mono ${direction === "add" ? "text-green-600" : "text-red-500"}`}>
                            {newAvail.toFixed(1)}h
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 3: Direction + Amount ── */}
          {selectedUserId && selectedTypes.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-orange-500" /> Adjustment
              </label>
              <div className="flex gap-2 items-center">
                {/* Add / Subtract toggle */}
                <div className="flex rounded-lg border border-neutral-200 overflow-hidden flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setDirection("add")}
                    className={`px-4 py-2 text-sm font-bold transition-colors focus:outline-none ${
                      direction === "add"
                        ? "bg-green-500 text-white"
                        : "bg-white text-neutral-500 hover:bg-green-50 dark:bg-neutral-900 dark:text-neutral-400"
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("subtract")}
                    className={`px-4 py-2 text-sm font-bold transition-colors focus:outline-none ${
                      direction === "subtract"
                        ? "bg-red-500 text-white"
                        : "bg-white text-neutral-500 hover:bg-red-50 dark:bg-neutral-900 dark:text-neutral-400"
                    }`}
                  >
                    − Subtract
                  </button>
                </div>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-base font-bold flex-1"
                />
                <span className="text-sm text-neutral-400 font-medium flex-shrink-0">hrs</span>
              </div>
              {numAmount > 0 && (
                <p className={`text-xs font-semibold ${direction === "add" ? "text-green-600" : "text-red-500"}`}>
                  {direction === "add" ? "+" : "−"}{numAmount.toFixed(2)} hours applied to {selectedTypes.length} leave type{selectedTypes.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* ── Step 4: Reason ── */}
          {selectedUserId && selectedTypes.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-orange-500" /> Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this adjustment being made? (required — recorded on the leave ledger)"
                className="text-sm resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={applyAdjust}
            disabled={saving || !isValid}
            className={`text-white ${direction === "add" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : direction === "add" ? (
              <Plus className="w-4 h-4 mr-2" />
            ) : (
              <span className="mr-1.5 font-bold text-base leading-none">−</span>
            )}
            {direction === "add" ? "Add" : "Subtract"} Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Leave Credits Card ───────────────────────────────────────────────────────
// ── Leave Credits Accordion ──────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-200   text-blue-700",
  "bg-green-200  text-green-700",
  "bg-orange-200 text-orange-700",
  "bg-purple-200 text-purple-700",
  "bg-pink-200   text-pink-700",
  "bg-teal-200   text-teal-700",
  "bg-amber-200  text-amber-700",
  "bg-red-200    text-red-700",
];
function avatarColor(name = "") {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function avatarInitials(name = "") {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ── Leave Ledger Drilldown ────────────────────────────────────────────────────
// Row drill-down from the credits matrix — GET /leave-balances/transactions
// scoped to one employee + one leave type, per docs/UPDATED_LEAVE_MODULE.md §14g
// ("Settings side, attached to the Balance Matrix — that's where credits change,
// so that's where an admin needs to audit them").
function LeaveLedgerDrilldownModal({ open, onClose, token, API, userId, policyId, employeeName, leaveType }) {
  const [entries, setEntries] = useState([]);
  const [loading,  setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId || !policyId || !token) return;
    setLoading(true);
    fetch(`${API}/api/leave-balances/transactions?userId=${userId}&policyId=${policyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setEntries(Array.isArray(data.data) ? data.data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, userId, policyId, token, API]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <div className="h-[3px] bg-orange-500 -mt-6 mb-4 -mx-6" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-orange-600" />
            </span>
            {leaveType} Ledger
          </DialogTitle>
          <DialogDescription>{employeeName} — every credit, deduction, adjustment, and expiration for this leave type.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-10">No ledger entries for this leave type yet.</p>
        ) : (
          <div className="border rounded-md overflow-hidden max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 sticky top-0">
                  <th className="text-left  px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Date</th>
                  <th className="text-left  px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Type</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Hours</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Balance After</th>
                  <th className="text-left  px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((t) => {
                  const typeCfg = {
                    accrual:    { label: "Accrual",    bg: "bg-green-50",  clr: "text-green-700" },
                    deduction:  { label: "Deduction",  bg: "bg-red-50",    clr: "text-red-700" },
                    adjustment: { label: "Adjustment", bg: "bg-purple-50", clr: "text-purple-700" },
                    expired:    { label: "Expired",    bg: "bg-amber-50",  clr: "text-amber-700" },
                  }[t.type] || { label: t.type || "—", bg: "bg-neutral-50", clr: "text-neutral-500" };
                  // Lifecycle rows (submitted/approved/…) carry no balance movement — hours is null.
                  const hours = t.hours != null ? Number(t.hours) : null;
                  return (
                    <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2 text-xs text-neutral-500 whitespace-nowrap">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.clr}`}>{typeCfg.label}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${hours == null ? "text-neutral-300" : hours < 0 ? "text-red-600" : "text-green-600"}`}>
                        {hours == null ? "—" : `${hours > 0 ? "+" : ""}${hours}h`}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-neutral-500">
                        {t.balanceAfter != null ? `${t.balanceAfter}h` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">{t.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveCreditsAccordionCard({ token, API, matrix, leaveTypes, policies, loadingMatrix, errorMessage, reload }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [search,      setSearch]      = useState("");
  const [adjustOpen,  setAdjustOpen]  = useState(false);
  const [drilldown,   setDrilldown]   = useState({ open: false, userId: null, policyId: null, employeeName: "", leaveType: "" });

  const toggle = (userId) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });

  // Leave types are keyed by name in the matrix, but the ledger endpoint filters by
  // policy id — resolve name -> id once here rather than in every row's click handler.
  const policyIdByType = useMemo(
    () => Object.fromEntries(policies.map((p) => [p.leaveType, p.id])),
    [policies]
  );

  // One column per fiscal year across the whole matrix, newest first, so every
  // employee's table lines up. Empty before setup — there are no lots yet.
  const lotYears = useMemo(() => {
    const byYear = new Map();
    for (const row of matrix) {
      for (const t of leaveTypes) {
        for (const l of row.balances[t]?.creditLots || []) if (!byYear.has(l.fiscalYear)) byYear.set(l.fiscalYear, l.label);
      }
    }
    return [...byYear].sort((a, b) => b[0] - a[0]).map(([fiscalYear, label]) => ({ fiscalYear, label }));
  }, [matrix, leaveTypes]);

  const filtered = search
    ? matrix.filter((r) =>
        r.fullName.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase())
      )
    : matrix;

  return (
    <>
      <AdjustCreditsModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        token={token}
        API={API}
        leaveTypes={leaveTypes}
        matrix={matrix}
        onSuccess={reload}
      />
      <LeaveLedgerDrilldownModal
        open={drilldown.open}
        onClose={() => setDrilldown((d) => ({ ...d, open: false }))}
        token={token}
        API={API}
        userId={drilldown.userId}
        policyId={drilldown.policyId}
        employeeName={drilldown.employeeName}
        leaveType={drilldown.leaveType}
      />
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
            <SectionIcon icon={Award} color="orange" />
            Leave Credits Management
          </CardTitle>
          <Button
            onClick={() => setAdjustOpen(true)}
            disabled={loadingMatrix || leaveTypes.length === 0}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm"
          >
            <Edit3 className="w-4 h-4 mr-1.5" /> Adjust Credits
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loadingMatrix && matrix.length > 0 && (
          <Input
            placeholder="Search employee by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm max-w-sm"
          />
        )}

        {loadingMatrix ? (
          <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : errorMessage ? (
          <div className="flex items-center justify-center gap-2 text-red-500 py-10">
            <AlertCircle className="w-5 h-5" /> {errorMessage}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-neutral-400 py-10">
            {search ? "No employees match your search" : "No leave balance data available"}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((row) => {
              const isOpen       = expandedIds.has(row.userId);
              const totalCredits = leaveTypes.reduce((s, t) => s + (row.balances[t]?.credits || 0), 0);
              const totalAvail   = leaveTypes.reduce((s, t) => s + (row.balances[t]?.available || 0), 0);
              const depletedCount = leaveTypes.filter((t) => {
                const b = row.balances[t];
                return b && b.credits > 0 && b.available === 0;
              }).length;

              return (
                <div key={row.userId} className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden">

                  {/* ── Employee header row ── */}
                  <button
                    type="button"
                    onClick={() => toggle(row.userId)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${avatarColor(row.fullName)}`}>
                      {avatarInitials(row.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-neutral-800 dark:text-neutral-100 truncate">{row.fullName}</p>
                      <p className="text-xs text-neutral-400 truncate">{row.email}</p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {depletedCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                          <AlertCircle className="w-3 h-3" /> {depletedCount} depleted
                        </span>
                      )}
                      <span className="text-sm text-neutral-400 font-medium">
                        {totalCredits === 0 ? "No credits allocated" : `${totalAvail.toLocaleString()} available`}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {/* ── Expanded: leave type breakdown ── */}
                  {isOpen && (
                    <div className="border-t border-neutral-200 dark:border-neutral-700">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-neutral-50 dark:bg-neutral-800/60">
                            <th className="text-left   px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Leave Type</th>
                            {lotYears.length === 0 ? (
                              <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Credits</th>
                            ) : lotYears.map((y) => (
                              <th key={y.fiscalYear} className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{y.label}</th>
                            ))}
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Used</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Expired</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Avail</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-36">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveTypes.map((t) => {
                            const cell    = row.balances[t];
                            const credits = cell?.credits   || 0;
                            const used    = cell?.used      || 0;
                            const expired = cell?.expired   || 0;
                            const avail   = cell?.available || 0;

                            const notAllocated = credits === 0;
                            const depleted     = credits > 0 && avail === 0;
                            const pct          = credits > 0 ? Math.round((avail / credits) * 100) : 0;

                            const barColor  = depleted  ? "bg-red-400"
                                            : pct < 50  ? "bg-orange-400"
                                            :              "bg-green-500";
                            const pctColor  = depleted  ? "text-red-500"
                                            : pct < 50  ? "text-orange-500"
                                            :              "text-neutral-500";
                            const availClass = depleted
                              ? "text-red-500 font-bold"
                              : "text-neutral-700 dark:text-neutral-200 font-bold";

                            const policyId = policyIdByType[t];
                            return (
                              <tr
                                key={t}
                                onClick={() => policyId && setDrilldown({ open: true, userId: row.userId, policyId, employeeName: row.fullName, leaveType: t })}
                                title="View ledger history for this employee and leave type"
                                className={`border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors ${policyId ? "cursor-pointer" : ""}`}
                              >
                                <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-200">{t}</td>
                                {lotYears.length === 0 ? (
                                  <td className="px-4 py-3 text-right font-mono text-sm text-neutral-500">
                                    {notAllocated ? <span className="text-neutral-300">—</span> : credits}
                                  </td>
                                ) : lotYears.map((y) => {
                                  const lot = cell?.creditLots.find((l) => l.fiscalYear === y.fiscalYear);
                                  return (
                                    <td
                                      key={y.fiscalYear}
                                      title={lot ? `Expires ${formatYmd(lot.expiresOn)}` : undefined}
                                      className="px-4 py-3 text-right font-mono text-sm text-neutral-500"
                                    >
                                      {lot ? lot.remainingHours : <span className="text-neutral-300">—</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-right font-mono text-sm text-neutral-500">
                                  {notAllocated ? <span className="text-neutral-300">—</span> : used}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono text-sm ${expired > 0 ? "text-amber-600" : "text-neutral-500"}`}>
                                  {notAllocated || expired === 0 ? <span className="text-neutral-300">—</span> : expired}
                                </td>
                                <td className={`px-4 py-3 text-right font-mono text-sm ${notAllocated ? "" : availClass}`}>
                                  {notAllocated ? <span className="text-neutral-300">—</span> : avail}
                                </td>
                                <td className="px-4 py-3">
                                  {notAllocated ? (
                                    <p className="text-xs text-neutral-300 font-medium text-right">Not allocated</p>
                                  ) : (
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-24 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${barColor}`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-semibold font-mono w-9 text-right tabular-nums ${pctColor}`}>
                                        {pct}%
                                      </span>
                                      {policyId && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDrilldown({ open: true, userId: row.userId, policyId, employeeName: row.fullName, leaveType: t });
                                          }}
                                          title="View history"
                                          aria-label={`View ${t} history for ${row.fullName}`}
                                          className="text-neutral-400 hover:text-orange-600 transition-colors"
                                        >
                                          <Info className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LeaveSettings() {
  const { token, role } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (role && !["admin", "superadmin", "supervisor"].includes(role.toLowerCase())) window.location.href = "/dashboard";
    if (!token) { toast.error("Session expired. Please log in again."); window.location.href = "/login"; }
  }, [role, token]);

  // ── State ────────────────────────────────────────────────────────────────
  const [leaveTypes,       setLeaveTypes]       = useState([]);
  const [policies,         setPolicies]         = useState([]);
  const [matrix,           setMatrix]           = useState([]);
  const [loadingMatrix,    setLoadingMatrix]    = useState(true);
  const [errorMessage,     setErrorMessage]     = useState(null);
  const [draft,            setDraft]            = useState(null);
  const [loadingSettings,  setLoadingSettings]  = useState(true);
  const [savingSettings,   setSavingSettings]   = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);
  const [reportOpen,       setReportOpen]       = useState(false); // BB-098 leave reports

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCredits = matrix.reduce((a, emp) =>
      a + leaveTypes.reduce((b, t) => b + (emp.balances?.[t]?.credits || 0), 0), 0);
    const totalUsed = matrix.reduce((a, emp) =>
      a + leaveTypes.reduce((b, t) => b + (emp.balances?.[t]?.used    || 0), 0), 0);
    return { totalEmployees: matrix.length, totalLeaveTypes: leaveTypes.length, totalCredits, totalUsed };
  }, [matrix, leaveTypes]);

  // ── API: GET /api/company-settings ────────────────────────────────────────
  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const r = await fetch(`${API}/api/company-settings`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok) setDraft(j.data || {});
      else toast.error(j.message || "Failed to load settings");
    } catch { toast.error("Network error loading settings"); }
    setLoadingSettings(false);
  };

  // ── API: GET /api/leave-balances/matrix + GET /api/leave-policies ─────────
  const loadData = async (retry = 0) => {
    setLoadingMatrix(true);
    setErrorMessage(null);
    try {
      // includeArchived=true — matrix/credits views intentionally keep showing archived
      // types' historical data (see docs/UPDATED_LEAVE_MODULE.md §14f); LeaveTypesCard
      // filters the admin list back down to active-only by default on its own.
      const [mRes, pRes] = await Promise.all([
        fetch(`${API}/api/leave-balances/matrix?cb=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`${API}/api/leave-policies?includeArchived=true`,    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const [mData, pData] = await Promise.all([mRes.json(), pRes.json()]);
      if (!mRes.ok || !pRes.ok) {
        const msg = mData.message || pData.message || "Failed to load data";
        setErrorMessage(msg); toast.error(msg);
        if (retry < 2) { await new Promise((r) => setTimeout(r, 1000 * (retry + 1))); return loadData(retry + 1); }
        return;
      }
      const rows = Array.isArray(mData.data) ? mData.data : [];
      const pol  = Array.isArray(pData.data) ? pData.data : [];
      const types = pol.map((p) => p.leaveType);
      setMatrix(rows.map((row) => normalizeLeaveMatrixRow(row, types)));
      setPolicies(pol);
      setLeaveTypes(types);
    } catch { const msg = "Network error loading data"; setErrorMessage(msg); toast.error(msg); }
    setLoadingMatrix(false);
  };

  // ── API: PATCH /api/company-settings ─────────────────────────────────────
  // Leave credit fields/toggles are left out — LeaveCreditsSettingsCard saves its
  // own, so a toggle here can never be sent from stale form state.
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const body = Object.fromEntries(Object.entries(draft || {}).filter(([k]) => !LEAVE_CREDIT_KEYS.includes(k)));
      const r = await fetch(`${API}/api/company-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) toast.success("Settings saved successfully!");
      else toast.error(j.error || j.message || "Failed to save settings");
    } catch { toast.error("Network error saving settings"); }
    setSavingSettings(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadSettings()]);
    toast.success("Data refreshed");
    setRefreshing(false);
  };

  useEffect(() => {
    if (token) { loadSettings(); loadData(); }
  }, [token]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <Toaster position="top-center" />
      <LeaveReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        token={token}
        API={API}
        role={role}
        policies={policies}
        matrix={matrix}
      />

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            Leave Settings
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Manage leave types, leave credits, approval routing, and employee balances</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={refreshData} disabled={refreshing} className="border-orange-200 text-orange-600 hover:bg-orange-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setReportOpen(true)} disabled={loadingMatrix} className="border-orange-200 text-orange-600 hover:bg-orange-50">
            <Download className="w-4 h-4 mr-2" /> Generate Report
          </Button>
          <Button onClick={saveSettings} disabled={savingSettings || loadingSettings} className="bg-orange-500 hover:bg-orange-600 text-white">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Employees", value: stats.totalEmployees,                   icon: Users,    color: "text-blue-600",   bg: "bg-blue-50   border-blue-200"   },
          { label: "Leave Types",     value: stats.totalLeaveTypes,                  icon: Calendar, color: "text-green-600",  bg: "bg-green-50  border-green-200"  },
          { label: "Total Credits",   value: `${stats.totalCredits.toFixed(1)}h`,    icon: Award,    color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
          { label: "Hours Used",      value: `${stats.totalUsed.toFixed(1)}h`,       icon: TrendingUp,color:"text-orange-600", bg: "bg-orange-50 border-orange-200" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border-[1.5px] p-4 ${bg}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${color}`}>{label}</p>
              <Icon className={`w-4 h-4 ${color} opacity-70`} />
            </div>
            <p className={`text-2xl font-extrabold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <LeaveCreditsSettingsCard
        loading={loadingSettings} settings={draft} token={token} API={API}
        onSettingsChange={(patch) => setDraft((o) => ({ ...o, ...patch }))}
        onApplied={(fresh) => {
          if (fresh) setDraft((o) => ({ ...o, ...fresh }));
          else loadSettings();
          loadData();
        }}
      />
      <LeaveApprovalCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
      <LeaveConflictCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
      <LeaveTypesCard API={API} token={token} policies={policies} reload={loadData} />
      <LeaveCreditsAccordionCard
        token={token} API={API} matrix={matrix} leaveTypes={leaveTypes} policies={policies}
        loadingMatrix={loadingMatrix} errorMessage={errorMessage} reload={loadData}
      />
    </div>
  );
}
