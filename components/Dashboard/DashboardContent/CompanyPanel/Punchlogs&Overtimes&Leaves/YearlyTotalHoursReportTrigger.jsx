// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx
"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle, Columns3, FileSpreadsheet, Info, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from "@/components/ui/tooltip";
import { downloadYearlyTotalHoursReport } from "@/lib/yearlyHoursReportActions";

const START_YEAR = 2024;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const GROUPINGS = [
  { value: "month",   label: "Monthly",   periods: MONTHS   },
  { value: "quarter", label: "Quarterly", periods: QUARTERS },
  { value: "year",    label: "Yearly",    periods: []       },
];

const EXTRA_COLUMNS = [
  { value: "driver",  label: "Driver Total Hrs"   },
  { value: "regular", label: "Regular Total Hrs"  },
  { value: "ot",      label: "OT Hrs",            hideForYearly: true },
  { value: "average", label: "Avg Hrs per Cutoff" },
];

const periodsFor = (groupBy) => GROUPINGS.find((g) => g.value === groupBy).periods;

const TogglePill = ({ on, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center justify-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-all ${
      on
        ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-300"
        : "bg-transparent border-muted-foreground/30 text-muted-foreground hover:border-orange-300 hover:text-orange-600"
    }`}
  >
    {on && <CheckCircle className="w-2.5 h-2.5" />}
    {children}
  </button>
);

export default function YearlyTotalHoursReportTrigger({ companyId, companyName, canDownload }) {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [groupBy, setGroupBy] = useState("month");
  const [selectedPeriods, setSelectedPeriods] = useState(MONTHS);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setYear(CURRENT_YEAR);
      setGroupBy("month");
      setSelectedPeriods(MONTHS);
      setSelectedColumns([]);
    }
  }, [open]);

  if (!canDownload) return null;

  const allPeriods = periodsFor(groupBy);
  const isQuarterly = groupBy === "quarter";
  const isYearly = groupBy === "year";
  const extraColumns = EXTRA_COLUMNS.filter((c) => !(isYearly && c.hideForYearly));
  const allPeriodsSelected = allPeriods.every((p) => selectedPeriods.includes(p));

  const handleGroupBy = (value) => {
    if (value === groupBy) return;
    setGroupBy(value);
    setSelectedPeriods(periodsFor(value));
    // OT isn't offered for Yearly — drop it so it's never sent
    if (value === "year") {
      setSelectedColumns((prev) => prev.filter((v) => !EXTRA_COLUMNS.find((c) => c.value === v)?.hideForYearly));
    }
  };

  const toggleIn = (setter) => (val) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  const togglePeriod = toggleIn(setSelectedPeriods);
  const toggleColumn = toggleIn(setSelectedColumns);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadYearlyTotalHoursReport({
        apiUrl: API_URL,
        token,
        companyId,
        year,
        groupBy,
        // Omitted when all are selected (server default) or for Yearly (server ignores it).
        // Otherwise kept in calendar order regardless of click order.
        periods: isYearly || allPeriodsSelected ? [] : allPeriods.filter((p) => selectedPeriods.includes(p)),
        columns: extraColumns.map((c) => c.value).filter((v) => selectedColumns.includes(v)),
        fallbackFilename: `${(companyName || "Company").replace(/\s+/g, "_")}_Yearly_Total_Hours_${year}${isQuarterly ? "_Quarterly" : ""}${isYearly ? "_Yearly" : ""}.xlsx`,
      });
      setOpen(false);
    } catch (e) {
      toast.error(e.message || "Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Yearly Total Hours Report</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={(v) => !downloading && setOpen(v)}>
        <DialogContent className="sm:max-w-lg border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              Yearly Total Hours Report
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="px-1 pb-2 space-y-5">

              {/* Year */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Year
                </p>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grouping */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Group By
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {GROUPINGS.map((g) => (
                    <Button
                      key={g.value}
                      type="button"
                      size="sm"
                      variant={groupBy === g.value ? "default" : "outline"}
                      onClick={() => handleGroupBy(g.value)}
                      className={groupBy === g.value ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                    >
                      {g.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Months / Quarters (hidden for Yearly) */}
              {!isYearly && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> {isQuarterly ? "Quarters" : "Months"} to Include
                    </p>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedPeriods(allPeriods)}
                        className="text-orange-600 hover:text-orange-700 hover:underline"
                      >
                        All
                      </button>
                      <span className="text-muted-foreground">·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedPeriods([])}
                        className="text-orange-600 hover:text-orange-700 hover:underline"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="border rounded-lg px-3 py-2.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {allPeriods.map((p) => (
                        <TogglePill key={p} on={selectedPeriods.includes(p)} onClick={() => togglePeriod(p)}>
                          {p}
                        </TogglePill>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedPeriods.length} of {allPeriods.length} {isQuarterly ? "quarters" : "months"} selected
                  </p>
                </div>
              )}

              {/* Extra columns */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Columns3 className="w-3.5 h-3.5" /> Extra Columns
                </p>
                <div className="border rounded-lg px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {extraColumns.map((c) => (
                      <TogglePill key={c.value} on={selectedColumns.includes(c.value)} onClick={() => toggleColumn(c.value)}>
                        {c.label}
                      </TogglePill>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total Hrs is always included{isYearly ? " for the year" : ` for each ${isQuarterly ? "quarter" : "month"}`}.
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Each cutoff counts in the month its end date falls in (e.g. Jun 24 – Jul 7 counts as July; Dec 24 – Jan 6 counts toward the next year).
                Only processed and exported cutoffs are included.
              </span>
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={downloading}>Cancel</Button>
              <Button
                onClick={handleDownload}
                disabled={downloading || !companyId || (!isYearly && selectedPeriods.length === 0)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {downloading
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Generating…</>
                  : <><FileSpreadsheet className="h-4 w-4 mr-1.5" />Download</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
