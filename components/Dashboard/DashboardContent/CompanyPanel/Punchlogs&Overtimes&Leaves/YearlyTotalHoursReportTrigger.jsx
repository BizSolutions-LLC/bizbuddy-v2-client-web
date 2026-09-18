// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/YearlyTotalHoursReportTrigger.jsx
"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from "@/components/ui/tooltip";
import { downloadYearlyTotalHoursReport } from "@/lib/yearlyHoursReportActions";

const START_YEAR = 2024;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - START_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);

export default function YearlyTotalHoursReportTrigger({ companyId, companyName, canDownload }) {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [downloading, setDownloading] = useState(false);

  if (!canDownload) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadYearlyTotalHoursReport({
        apiUrl: API_URL,
        token,
        companyId,
        year,
        fallbackFilename: `${(companyName || "Company").replace(/\s+/g, "_")}_Yearly_Total_Hours_${year}.xlsx`,
      });
      setOpen(false);
    } catch (e) {
      toast.error(e.message || "Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon">
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Yearly Total Hours Report</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Yearly Total Hours Report</h4>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={handleDownload} disabled={downloading || !companyId}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            {downloading ? "Generating…" : "Download"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
