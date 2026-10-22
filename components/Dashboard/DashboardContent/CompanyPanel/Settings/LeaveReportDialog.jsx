"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveReportDialog.jsx
// BB-098 — Leave Settings → Generate Report. Fetches GET /api/reports/leave (JSON) and
// hands it to lib/exports/leaveReports.js to write CSV or PDF, the same split as the
// Employees Punch Logs report.

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import MultiSelect from "@/components/common/MultiSelect";

// Kept here, not imported from lib/exports/leaveReports, so jsPDF only loads on Generate.
const REPORT_TYPES = {
  summary:    { label: "Balance Summary",        hint: "Each employee's credited, used, adjusted, expired and available hours as of a date, with what's left per fiscal year." },
  activity:   { label: "Activity by Period",     hint: "Opening, credited, used, unpaid, adjusted, expired and closing hours per month, quarter or year." },
  expiration: { label: "Fiscal-Year Expiration", hint: "Every fiscal-year credit lot: what's left, when it expires, and whether the reminder went out." },
};

// "all" sentinel selection, same model as the Leave Types assignment picker.
function toggleSelection(prev, val) {
  if (val === "all") return ["all"];
  let list = prev.filter((x) => x !== "all");
  list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  return list.length ? list : ["all"];
}

const todayYmd = () => new Date().toLocaleDateString("en-CA");
const yearStartYmd = () => `${new Date().getFullYear()}-01-01`;

export default function LeaveReportDialog({ open, onOpenChange, token, API, role, policies, matrix }) {
  const isSupervisor = (role || "").toLowerCase() === "supervisor";

  const [type,           setType]           = useState("summary");
  const [from,           setFrom]           = useState(yearStartYmd);
  const [to,             setTo]             = useState(todayYmd);
  const [groupBy,        setGroupBy]        = useState("quarter");
  const [basis,          setBasis]          = useState("fiscal");
  const [withinDays,     setWithinDays]     = useState("");
  const [policyIds,      setPolicyIds]      = useState(["all"]);
  const [userIds,        setUserIds]        = useState(["all"]);
  const [departmentId,   setDepartmentId]   = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeGranted, setIncludeGranted] = useState(false);
  const [format,         setFormat]         = useState("csv");
  const [departments,    setDepartments]    = useState([]);
  const [generating,     setGenerating]     = useState(false);

  // Supervisors are scoped to their own department server-side (403 otherwise), so they
  // get no department picker at all.
  useEffect(() => {
    if (!open || isSupervisor || departments.length) return;
    fetch(`${API}/api/departments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDepartments(Array.isArray(j?.data) ? j.data : []))
      .catch(() => {});
  }, [open, isSupervisor, departments.length, API, token]);

  const policyOptions   = useMemo(() => policies.map((p) => ({ value: p.id, label: p.isArchived ? `${p.leaveType} (archived)` : p.leaveType })), [policies]);
  const employeeOptions = useMemo(() => matrix.map((r) => ({ value: r.userId, label: r.fullName || r.email })), [matrix]);

  const needsRange = type === "activity";

  const generate = async () => {
    if (needsRange && (!from || !to || from > to)) { toast.error("Choose a valid date range."); return; }
    setGenerating(true);
    try {
      const params = new URLSearchParams({ type });
      if (to) params.set("to", to);
      if (needsRange) { params.set("from", from); params.set("groupBy", groupBy); params.set("basis", basis); }
      if (type === "expiration" && withinDays.trim() !== "") params.set("expiringWithinDays", withinDays.trim());
      if (!policyIds.includes("all")) params.set("policyIds", policyIds.join(","));
      if (!userIds.includes("all")) params.set("userIds", userIds.join(","));
      if (!isSupervisor && departmentId !== "all") params.set("departmentId", departmentId);
      if (includeInactive) params.set("includeInactive", "true");

      const r = await fetch(`${API}/api/reports/leave?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to generate the leave report");
      const report = j.data;

      if (!report?.rows?.length) {
        toast.info(type === "expiration" && !report?.settings?.leaveCreditsInitializedAt
          ? "Leave credit setup hasn't been applied yet — there are no fiscal-year credits to report."
          : "No data for the selected filters.");
        return;
      }

      const { exportLeaveReport } = await import("@/lib/exports/leaveReports");
      const result = await exportLeaveReport({ report, format, includeGranted });
      if (result.success) toast.success(result.filename);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Report generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !generating && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg overflow-hidden">
        <div className="h-[3px] bg-orange-500 -mt-6 mb-4 -mx-6" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Download className="w-4 h-4 text-orange-600" />
            </span>
            Generate Leave Report
          </DialogTitle>
          <DialogDescription>Choose a report, its period and filters, then download it as CSV or PDF.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Report type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Report</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_TYPES).map(([value, t]) => <SelectItem key={value} value={value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-neutral-500">{REPORT_TYPES[type].hint}</p>
          </div>

          {/* Period */}
          {needsRange ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">From</Label>
                  <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">To</Label>
                  <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Group By</Label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="quarter">Quarterly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Year Basis</Label>
                  <Select value={basis} onValueChange={setBasis} disabled={groupBy === "month"}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiscal">Fiscal year</SelectItem>
                      <SelectItem value="calendar">Calendar year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 -mt-2">Activity reports can cover up to 5 years.</p>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{type === "summary" ? "Balances As Of" : "State As Of"}</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-sm" />
              </div>
              {type === "expiration" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Expiring Within (days)</Label>
                  <Input
                    type="number" min={0} max={365}
                    value={withinDays}
                    placeholder="Reminder setting"
                    onChange={(e) => setWithinDays(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Leave Types</Label>
            <MultiSelect
              options={policyOptions}
              selected={policyIds}
              onChange={(v) => setPolicyIds((prev) => toggleSelection(prev, v))}
              allLabel="All leave types"
              width={0}
              className="w-full"
            />
          </div>
          {!isSupervisor && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Employees</Label>
            <MultiSelect
              options={employeeOptions}
              selected={userIds}
              onChange={(v) => setUserIds((prev) => toggleSelection(prev, v))}
              allLabel="All employees"
              width={0}
              className="w-full"
              searchable
              sortable
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(v === true)} />
              Include inactive employees
            </label>
            {type !== "expiration" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={includeGranted} onCheckedChange={(v) => setIncludeGranted(v === true)} />
                Add a Granted column (automatic grants only)
              </label>
            )}
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancel</Button>
          <Button onClick={generate} disabled={generating} className="bg-orange-500 hover:bg-orange-600 text-white">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
