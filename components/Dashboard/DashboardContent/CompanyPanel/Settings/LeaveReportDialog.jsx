"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Settings/LeaveReportDialog.jsx
// BB-106 — Leave Settings → Generate Report. The server builds the Leave Report workbook
// (GET /api/reports/leave/template, .xlsx, one sheet per leave type); this dialog only
// collects filters and downloads the file. Replaces the BB-098 CSV/PDF reports.

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import MultiSelect from "@/components/common/MultiSelect";
import { downloadLeaveTemplateReport } from "@/lib/leaveReportActions";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS   = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_OPTIONS = QUARTERS.map((q) => ({ value: q, label: q }));
const MONTH_OPTIONS   = MONTHS.map((m) => ({ value: m, label: m }));

// "all" sentinel selection, same model as the Leave Types assignment picker.
function toggleSelection(prev, val) {
  if (val === "all") return ["all"];
  let list = prev.filter((x) => x !== "all");
  list = list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  return list.length ? list : ["all"];
}

const currentYear = () => new Date().getFullYear();

export default function LeaveReportDialog({ open, onOpenChange, token, API, role, policies, matrix }) {
  const isSupervisor = (role || "").toLowerCase() === "supervisor";

  const [year,            setYear]            = useState(() => String(currentYear()));
  const [rangeMode,       setRangeMode]       = useState("year"); // year | quarters | months
  const [quarters,        setQuarters]        = useState(["all"]);
  const [months,          setMonths]          = useState(["all"]);
  const [policyIds,       setPolicyIds]       = useState(["all"]);
  const [userIds,         setUserIds]         = useState(["all"]);
  const [departmentId,    setDepartmentId]    = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [departments,     setDepartments]     = useState([]);
  const [generating,      setGenerating]      = useState(false);

  // Supervisors are scoped to their own department server-side, so they get no picker.
  useEffect(() => {
    if (!open || isSupervisor || departments.length) return;
    fetch(`${API}/api/departments`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDepartments(Array.isArray(j?.data) ? j.data : []))
      .catch(() => {});
  }, [open, isSupervisor, departments.length, API, token]);

  const yearOptions     = useMemo(() => Array.from({ length: 5 }, (_, i) => String(currentYear() - i)), []);
  const policyOptions   = useMemo(() => policies.map((p) => ({ value: p.id, label: p.isArchived ? `${p.leaveType} (archived)` : p.leaveType })), [policies]);
  const employeeOptions = useMemo(() => matrix.map((r) => ({ value: r.userId, label: r.fullName || r.email })), [matrix]);

  // "All" quarters/months = whole year, so nothing is sent. Picks are sent in calendar order.
  const pickedQuarters = rangeMode === "quarters" && !quarters.includes("all") ? QUARTERS.filter((q) => quarters.includes(q)) : [];
  const pickedMonths   = rangeMode === "months" && !months.includes("all") ? MONTHS.filter((m) => months.includes(m)) : [];
  const isPartialYear  = pickedQuarters.length > 0 || pickedMonths.length > 0;

  const generate = async () => {
    setGenerating(true);
    try {
      const filename = await downloadLeaveTemplateReport({
        apiUrl: API,
        token,
        year,
        quarters:     pickedQuarters,
        months:       pickedMonths,
        policyIds:    policyIds.includes("all") ? undefined : policyIds,
        departmentId: !isSupervisor && departmentId !== "all" ? departmentId : undefined,
        userIds:      userIds.includes("all") ? undefined : userIds,
        includeInactive,
        fallbackFilename: `Leave_Report_${year}.xlsx`,
      });
      toast.success(filename);
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
          <DialogDescription>Downloads an Excel workbook with one sheet per leave type and one row per employee.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Period */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Range</Label>
              <Select value={rangeMode} onValueChange={setRangeMode}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Whole year</SelectItem>
                  <SelectItem value="quarters">Quarters</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {rangeMode === "quarters" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Quarters</Label>
              <MultiSelect
                options={QUARTER_OPTIONS}
                selected={quarters}
                onChange={(v) => setQuarters((prev) => toggleSelection(prev, v))}
                allLabel="All quarters"
                width={0}
                className="w-full"
              />
            </div>
          )}
          {rangeMode === "months" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Months</Label>
              <MultiSelect
                options={MONTH_OPTIONS}
                selected={months}
                onChange={(v) => setMonths((prev) => toggleSelection(prev, v))}
                allLabel="All months"
                width={0}
                className="w-full"
              />
            </div>
          )}
          {isPartialYear && (
            <p className="text-[11px] text-neutral-500 -mt-2">
              Only pay dates in the selected {rangeMode} are shown. Balance {year} is as of the end of the last selected cutoff.
            </p>
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
            <p className="text-[11px] text-neutral-500">Each leave type becomes its own sheet.</p>
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
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(v === true)} />
            Include inactive employees
          </label>

          <p className="text-[11px] text-neutral-400">
            Columns: previous-year balance, {year} credits, one column per pay date (grouped by month; a leave day
            counts under the cutoff that contains it), total used, balance, and next year&apos;s beginning balance.
          </p>
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
