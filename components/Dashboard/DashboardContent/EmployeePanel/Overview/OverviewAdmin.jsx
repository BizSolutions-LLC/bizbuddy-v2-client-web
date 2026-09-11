/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ChartCard, PieSimple, BarSimple, LineSimple, GroupedBarSimple, AreaSimple } from "./Commons";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 14 Days", value: "last_14_days" },
  { label: "Last 28 Days", value: "last_28_days" },
  { label: "Custom Range", value: "custom" },
];

// Client-side approximation of each preset's actual date span, purely for display in the
// date-range picker (start/end boxes + calendar highlight).
const getPresetRange = (period, customRange) => {
  const now = new Date();
  switch (period) {
    case "last_7_days":
      return { from: subDays(now, 6), to: now };
    case "last_14_days":
      return { from: subDays(now, 13), to: now };
    case "last_28_days":
      return { from: subDays(now, 27), to: now };
    case "last_month": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "custom":
      return customRange?.from && customRange?.to ? customRange : { from: null, to: null };
    case "this_month":
    default:
      return { from: startOfMonth(now), to: now };
  }
};

export default function OverviewAdmin() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Date range state — committed (drives the fetch) vs. pending (edited inside the open popover,
  // only committed on "Apply").
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pendingPeriod, setPendingPeriod] = useState("this_month");
  const [pendingCustomRange, setPendingCustomRange] = useState({ from: null, to: null });

  const fetchAnalytics = async (period, customStart, customEnd) => {
    setLoading(true);
    try {
      let url = `${API}/api/analytics/admin-dashboard?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${format(customStart, 'yyyy-MM-dd')}&endDate=${format(customEnd, 'yyyy-MM-dd')}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();

      if (!res.ok || !j.data) throw new Error(j.message || "Analytics fetch error");
      setData(j.data);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!token) return;
    fetchAnalytics(selectedPeriod, customDateRange.from, customDateRange.to);
  }, [API, token, selectedPeriod]);

  const handleDatePickerOpenChange = (open) => {
    if (open) {
      setPendingPeriod(selectedPeriod);
      setPendingCustomRange(customDateRange);
    }
    setIsDatePickerOpen(open);
  };

  const handleCalendarSelect = (range) => {
    if (pendingPeriod !== 'custom') setPendingPeriod('custom');
    setPendingCustomRange(range);
  };

  const handleApplyDateRange = () => {
    if (pendingPeriod === 'custom') {
      if (!pendingCustomRange.from || !pendingCustomRange.to) {
        toast.error("Please select both start and end dates");
        return;
      }
      setCustomDateRange(pendingCustomRange);
      setSelectedPeriod('custom');
      fetchAnalytics('custom', pendingCustomRange.from, pendingCustomRange.to);
    } else {
      setCustomDateRange({ from: null, to: null });
      setSelectedPeriod(pendingPeriod);
    }
    setIsDatePickerOpen(false);
  };

  const SkeletonMetrics = () => <Skeleton className="h-40 w-full rounded-xl mb-4" />;

  const SkeletonCharts = (rows) => (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );

  if (loading || !data) {
    return (
      <>
        <div className="mb-6">
          <Skeleton className="h-10 w-64 rounded-lg" />
        </div>
        <SkeletonMetrics />
        {SkeletonCharts(4)}
      </>
    );
  }

  const cards = [
    { label: "Departments", value: data.summary.departments, description: "Departments configured for your company." },
    { label: "Total Employees", value: data.summary.totalEmployees, description: "Employees currently in your company account." },
    { label: "Active Plan", value: data.summary.activePlan, isText: true, description: "Your company's current subscription plan." },
    { label: "Active Staff", value: data.summary.activeStaff, description: "Employees with at least one clock-in during the selected period." },
    { label: "Late Rate", value: `${data.summary.lateRate}%`, description: "Share of punches recorded after the scheduled start time." },
    { label: "Early Leave Rate", value: `${data.summary.earlyLeaveRate}%`, description: "Share of punches recorded before the scheduled end time." },
    { label: "Reliability", value: `${data.summary.reliabilityRate}%`, description: "Share of scheduled shifts completed without a late-in or early-out." },
    { label: "Coverage Rate", value: `${data.summary.coverageRate}%`, description: "Share of scheduled shifts that were actually staffed." },
    { label: "Leave Approval", value: `${data.summary.leaveApprovalRate}%`, description: "Share of submitted leave requests that were approved." },
  ];

  const currentPreset = DATE_PRESETS.find(p => p.value === selectedPeriod);
  const committedRange = getPresetRange(selectedPeriod, customDateRange);
  const pendingRange = getPresetRange(pendingPeriod, pendingCustomRange);

  return (
    <div className="animate-in fade-in duration-300">
      {/* Professional Date Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Popover open={isDatePickerOpen} onOpenChange={handleDatePickerOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-between font-medium shadow-sm hover:shadow-md transition-all duration-200",
                  "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                  "bg-white dark:bg-gray-950 min-w-[220px]"
                )}
              >
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">{currentPreset?.label || "This Month"}</span>
                  {committedRange.from && committedRange.to && (
                    <span className="hidden sm:inline text-sm text-gray-400 dark:text-gray-500">
                      {format(committedRange.from, 'MMM d')} – {format(committedRange.to, 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(700px,calc(100vw-2rem))] p-0" align="start">
              <div className="flex flex-col sm:flex-row">
                {/* Preset list */}
                <div className="flex sm:flex-col overflow-x-auto sm:overflow-visible sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-800 py-2">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setPendingPeriod(preset.value)}
                      className={cn(
                        "text-left px-4 py-2 text-sm whitespace-nowrap transition-colors rounded-md sm:rounded-none",
                        pendingPeriod === preset.value
                          ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Start/End display + calendar */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-end gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
                      <div className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm truncate">
                        {pendingRange.from ? format(pendingRange.from, 'MMM d, yyyy') : 'Select date'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
                      <div className="border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm truncate">
                        {pendingRange.to ? format(pendingRange.to, 'MMM d, yyyy') : 'Select date'}
                      </div>
                    </div>
                    {pendingPeriod === 'custom' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingCustomRange({ from: null, to: null })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={pendingPeriod === 'custom' ? pendingCustomRange : pendingRange}
                      onSelect={handleCalendarSelect}
                      disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                      className="rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <Button variant="ghost" size="sm" onClick={() => setIsDatePickerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyDateRange}
                  disabled={pendingPeriod === 'custom' && (!pendingCustomRange.from || !pendingCustomRange.to)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Date Range Display */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {data.dateRange?.label || "This Month"}
            </span>
          </div>
        </div>

        {/* Hours Tracked */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden lg:block cursor-default">
                <span className="text-xs text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 dark:border-gray-600 pb-0.5">
                  Hours Tracked
                </span>
                <p className="mt-1.5 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  {data.summary.totalHoursWorked.toFixed(0)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs">
              Total hours logged across your company during the selected period.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* KPI Cards */}
      <TooltipProvider delayDuration={200}>
        <Card className="border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl mb-4">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {cards.map((c) => (
                <Tooltip key={c.label}>
                  <TooltipTrigger asChild>
                    <div className="min-w-0 cursor-default">
                      <span className="text-xs text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 dark:border-gray-600 pb-0.5">
                        {c.label}
                      </span>
                      <p
                        className={`mt-1.5 font-bold text-gray-900 dark:text-gray-100 truncate ${c.isText ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}
                        title={String(c.value)}
                      >
                        {c.value}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">{c.description}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Charts */}
      <div className="grid gap-3">
        {/* Row 1: Active Staff & Hours Comparison */}
        <div className="grid lg:grid-cols-2 gap-3">
          <ChartCard title="Active Staff Over Time" isEmpty={!data.charts.activeStaff?.length}>
            {data.charts.activeStaff?.length > 0 ? (
              <BarSimple data={data.charts.activeStaff} x="label" y="count" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No activity data
              </div>
            )}
          </ChartCard>
          
          <ChartCard title="Scheduled vs Actual Hours" isEmpty={!data.charts.hoursComparison?.length}>
            {data.charts.hoursComparison?.length > 0 ? (
              <GroupedBarSimple 
                data={data.charts.hoursComparison} 
                x="date" 
                y1="scheduled" 
                y2="actual" 
                label1="Scheduled" 
                label2="Actual" 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No hours data
              </div>
            )}
          </ChartCard>
        </div>

        {/* Row 2: Attendance Metrics */}
        <div className="grid lg:grid-cols-2 gap-3">
          <ChartCard title="Attendance Rates">
            <LineSimple
              data={[
                { label: "Late-In", rate: data.charts.attendanceMetrics.lateRate },
                { label: "Early-Out", rate: data.charts.attendanceMetrics.earlyRate },
              ]}
              x="label"
              y="rate"
            />
          </ChartCard>
          
          <ChartCard title="Reliability Score">
            <AreaSimple 
              data={[{ label: "Current Period", rate: data.charts.attendanceMetrics.reliabilityRate }]} 
              x="label" 
              y="rate" 
            />
          </ChartCard>
        </div>

        {/* Row 3: Leave Analytics */}
        <div className="grid lg:grid-cols-2 gap-3">
          <ChartCard title="Leave by Type" isEmpty={!data.charts.leaveByType?.length}>
            {data.charts.leaveByType?.length > 0 ? (
              <BarSimple data={data.charts.leaveByType} x="type" y="days" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No leave data
              </div>
            )}
          </ChartCard>
          
          <ChartCard title="Leave Request Status" isEmpty={!data.charts.leaveDistribution?.length}>
            {data.charts.leaveDistribution?.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <PieSimple data={data.charts.leaveDistribution} />
                <div className="flex items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm" />
                    <span className="text-gray-600 dark:text-gray-400">Approved</span>
                    <span className="font-medium">{data.charts.leaveDistribution[0]?.value || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-gray-600 dark:text-gray-400">Other</span>
                    <span className="font-medium">{data.charts.leaveDistribution[1]?.value || 0}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No leave requests
              </div>
            )}
          </ChartCard>
        </div>

        {/* Row 4: Overtime Analytics */}
        <div className="grid lg:grid-cols-2 gap-3">
          <ChartCard title="Overtime by Department" isEmpty={!data.charts.overtimeByDepartment?.length}>
            {data.charts.overtimeByDepartment?.length > 0 ? (
              <BarSimple data={data.charts.overtimeByDepartment} x="dept" y="hours" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No overtime recorded
              </div>
            )}
          </ChartCard>
          
          <ChartCard title="Overtime Trend & Cost" isEmpty={!data.charts.overtimeTrend?.length}>
            {data.charts.overtimeTrend?.length > 0 ? (
              <AreaSimple data={data.charts.overtimeTrend} x="period" y="cost" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No overtime cost data
              </div>
            )}
          </ChartCard>
        </div>

        {/* Row 5: Department Breakdown Table */}
        {data.charts.departmentBreakdown?.length > 0 && (
          <Card className="border border-gray-200 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Department Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 dark:border-gray-800">
                    <tr className="text-left">
                      <th className="pb-3 font-medium text-gray-600 dark:text-gray-400">Department</th>
                      <th className="pb-3 font-medium text-gray-600 dark:text-gray-400 text-right">Employees</th>
                      <th className="pb-3 font-medium text-gray-600 dark:text-gray-400 text-right">Active</th>
                      <th className="pb-3 font-medium text-gray-600 dark:text-gray-400 text-right">Total Hours</th>
                      <th className="pb-3 font-medium text-gray-600 dark:text-gray-400 text-right">Avg Hours/Emp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.charts.departmentBreakdown.map((dept, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-900 last:border-0">
                        <td className="py-3 font-medium">{dept.department}</td>
                        <td className="py-3 text-right text-gray-600 dark:text-gray-400">{dept.employees}</td>
                        <td className="py-3 text-right text-gray-600 dark:text-gray-400">{dept.activeEmployees}</td>
                        <td className="py-3 text-right text-gray-600 dark:text-gray-400">{dept.totalHours}</td>
                        <td className="py-3 text-right">
                          <span className="px-2 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded text-xs font-medium">
                            {dept.avgHoursPerEmployee}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}