"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveSettings.jsx
// Extracted out of CompanyConfigurations.jsx — Leave Type/Credits/Accrual/Approval
// had grown into their own domain (5 cards) inside an already-2900-line file.

import { useEffect, useState, useMemo } from "react";
import {
  AlertCircle, Archive, ArchiveRestore, Award, Calendar, Check, ChevronDown, CreditCard, Edit3, Info, Loader2,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { normalizeLeaveMatrixRow } from "@/lib/leaveBalanceUtils";
import MultiSelect from "@/components/common/MultiSelect";

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

// ── Leave Accrual Card ───────────────────────────────────────────────────────

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

function LeaveAccrualCard({ loading, draft, setDraft }) {
  const enabled  = draft?.accrualEnabled      ?? false;
  const month    = draft?.leaveYearStartMonth ?? 1;
  const catchUp  = draft?.newEmployeeCatchUp  ?? false;

  return (
    <Card className="border-[1.5px] shadow-md overflow-hidden">
      <CardStripe />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-[15px] font-extrabold">
          <SectionIcon icon={Calendar} color="green" />
          Leave Accrual
        </CardTitle>
        <p className="text-xs text-neutral-500 mt-0.5">
          Automatically accumulate leave credits for employees over time based on a yearly cycle.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div>
                <p className="text-sm font-semibold">Enable Leave Accrual</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  When on, employees earn leave credits automatically each accrual period.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraft((o) => ({ ...o, accrualEnabled: !enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                  enabled ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>

            {/* Fields — only shown when enabled */}
            {enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pl-1">
                {/* Year start month */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" />
                    Accrual Year Start Month
                  </Label>
                  <Select
                    value={String(month)}
                    onValueChange={(v) => setDraft((o) => ({ ...o, leaveYearStartMonth: Number(v) }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-400">The month each accrual year resets (e.g. January = Jan 1).</p>
                </div>

                {/* Catch-up toggle */}
                <div className="flex items-start justify-between p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 h-fit">
                  <div>
                    <p className="text-sm font-semibold">Credit New Employees for Elapsed Months</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      When on, new employees are credited for all months already passed in the current leave year instead of starting from zero.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraft((o) => ({ ...o, newEmployeeCatchUp: !catchUp }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full ml-4 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 ${
                      catchUp ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-600"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      catchUp ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>
            )}

            {/* Info callout */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 items-start">
              <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-green-900 mb-1.5">How Leave Accrual Works</p>
                <ul className="text-[11px] text-green-700 space-y-0.5">
                  <li>• Credits are earned incrementally each period rather than granted all at once</li>
                  <li>• The accrual year resets on the first day of the selected start month</li>
                  <li>• Catch-up accrual ensures mid-year hires are not penalized for joining late</li>
                  <li>• Balances are now capped at policy maximums — carry-over executes automatically at year-end</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setSelectedTypes([...leaveTypes]);
      setDirection("add");
      setAmount("");
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
  const isValid    = selectedUserId && numAmount > 0 && selectedTypes.length > 0;

  // API: POST /api/leave-balances/adjust
  const applyAdjust = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/leave-balances/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: selectedUserId, leaveTypes: selectedTypes, hours: finalHours }),
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
          <DialogDescription>{employeeName} — every credit, deduction, and adjustment for this leave type.</DialogDescription>
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
                  }[t.type] || { label: t.type || "—", bg: "bg-neutral-50", clr: "text-neutral-500" };
                  const hours = Number(t.hours ?? 0);
                  return (
                    <tr key={t.id} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2 text-xs text-neutral-500 whitespace-nowrap">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.clr}`}>{typeCfg.label}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${hours < 0 ? "text-red-600" : "text-green-600"}`}>
                        {hours > 0 ? "+" : ""}{hours}h
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
                        {totalCredits === 0 ? "No credits allocated" : `${totalCredits.toLocaleString()} total credits`}
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
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Credits</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Used</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Avail</th>
                            <th className="text-right  px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-36">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveTypes.map((t) => {
                            const cell    = row.balances[t];
                            const credits = cell?.credits   || 0;
                            const used    = cell?.used      || 0;
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
                                <td className="px-4 py-3 text-right font-mono text-sm text-neutral-500">
                                  {notAllocated ? <span className="text-neutral-300">—</span> : credits}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-neutral-500">
                                  {notAllocated ? <span className="text-neutral-300">—</span> : used}
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

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600" />
            </div>
            Leave Settings
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Manage leave types, accrual, approval routing, and employee credits</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={refreshData} disabled={refreshing} className="border-orange-200 text-orange-600 hover:bg-orange-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
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
      <LeaveAccrualCard loading={loadingSettings} draft={draft} setDraft={setDraft} />
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
