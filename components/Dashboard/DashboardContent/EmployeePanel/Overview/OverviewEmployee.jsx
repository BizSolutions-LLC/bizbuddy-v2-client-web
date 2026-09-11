/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartCard, PieSimple, BarSimple } from "./Commons";
import { User, Briefcase, Clock, CalendarDays, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
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
// date-range picker (start/end boxes + calendar highlight) — the server is still the source
// of truth for which rows actually land in "this month" etc.
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

export default function OverviewEmployee() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Date range state — committed (drives the fetch) vs. pending (edited inside the open popover,
  // only committed on "Apply", matching the reference's Cancel/Apply-gated picker).
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pendingPeriod, setPendingPeriod] = useState("this_month");
  const [pendingCustomRange, setPendingCustomRange] = useState({ from: null, to: null });

  const fetchAnalytics = async (period, customStart, customEnd) => {
    setLoading(true);
    try {
      let url = `${API}/api/analytics/employee?period=${period}`;
      
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

  // Clicking a date while a preset is selected starts an ad hoc custom range from that click,
  // rather than leaving the calendar as a read-only preview of the preset's span.
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

  const SkelMetrics = () => <Skeleton className="h-40 w-full rounded-xl mb-4" />;

  const SkelAverages = () => <Skeleton className="h-32 w-full rounded-xl mb-4" />;

  const SkelCharts = () => (
    <div className="grid lg:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );

  if (loading || !data)
    return (
      <>
        <div className="mb-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
        </div>
        <SkelMetrics />
        <SkelAverages />
        <SkelCharts />
      </>
    );

  // Dynamic username sizing based on length
  const getUsernameFontSize = (username) => {
    if (!username) return "text-lg sm:text-2xl";
    const length = username.length;
    if (length <= 10) return "text-lg sm:text-2xl";
    if (length <= 15) return "text-xl";
    if (length <= 20) return "text-lg";
    return "text-base";
  };

  const cards = [
    { label: "Username", value: data.profile.username || "No username", isText: true, dynamicSize: true },
    { label: "Department", value: data.profile.department || "Not assigned", isText: true },
    { label: "Usual Clock-In", value: data.patterns?.usualClockIn || "—", isText: true },
    { label: "Usual Clock-Out", value: data.patterns?.usualClockOut || "—", isText: true },
    { label: "Total Hours", value: data.totals.totalHours || 0 },
    { label: "Overtime", value: data.totals.overtime || 0 },
    {
      label: "Overtime Days",
      value: data.totals.overtimeDays ?? 0,
      description: "Number of days in the selected period where you worked more than your scheduled hours.",
    },
    { label: "Absences", value: data.totals.absences || 0 },
  ];

  // Check if user is new (no activity)
  const isNewUser = !data.charts.dailyHours || data.charts.dailyHours.length === 0;
  const completedSessions = Math.max(0, data.charts.dailyHours?.length || 0 - (data.totals.activeSessions || 0));
  const totalSessions = (data.totals.activeSessions || 0) + completedSessions;
  
  // Prepare chart data with fallbacks
  const dailyHoursData = data.charts.dailyHours && data.charts.dailyHours.length > 0 
    ? data.charts.dailyHours 
    : [];

  const sessionStatusData = totalSessions > 0 
    ? [
        { name: "Active", value: data.totals.activeSessions || 0 },
        { name: "Completed", value: completedSessions },
      ]
    : [];

  const totalAbsenceAndLate = (data.totals.absences || 0) + (data.totals.lateIns || 0);
  const absenceLateData = totalAbsenceAndLate > 0
    ? [
        { name: "Absences", value: data.totals.absences || 0 },
        { name: "Late-Ins", value: data.totals.lateIns || 0 },
      ]
    : [];

  const currentPreset = DATE_PRESETS.find(p => p.value === selectedPeriod);
  const committedRange = getPresetRange(selectedPeriod, customDateRange);
  const pendingRange = getPresetRange(pendingPeriod, pendingCustomRange);

  // averages.* are projected rates (daily average × 7 / × 30), not literal calendar-week/month
  // totals — flagged with a tooltip below rather than presented as an actual period total.
  const avg = data.averages || {};
  const fmtAvgHours = (v) => (typeof v === "number" ? `${v.toFixed(1)}h` : "—");
  const averageTiles = [
    { label: "Hours / Day", value: fmtAvgHours(avg.hoursPerDay) },
    { label: "Hours / Week", value: fmtAvgHours(avg.hoursPerWeek), projected: true },
    { label: "Hours / Month", value: fmtAvgHours(avg.hoursPerMonth), projected: true },
    { label: "Overtime / Day", value: fmtAvgHours(avg.overtimePerDay) },
    { label: "Overtime / Week", value: fmtAvgHours(avg.overtimePerWeek), projected: true },
    { label: "Overtime / Month", value: fmtAvgHours(avg.overtimePerMonth), projected: true },
  ];

  return (
    <>
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
                  <CalendarDays className="h-4 w-4 text-gray-500" />
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

        {isNewUser && (
          <span className="text-xs px-2.5 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
            New User
          </span>
        )}
      </div>

      {/* Metric Cards */}
      <TooltipProvider delayDuration={200}>
        <Card className="border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl mb-4">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-6">
              {cards.map((c) => {
                const label = (
                  <span className="text-xs text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 dark:border-gray-600 pb-0.5">
                    {c.label}
                  </span>
                );
                const value = (
                  <p
                    className={`mt-1.5 font-bold text-gray-900 dark:text-gray-100 truncate ${
                      c.dynamicSize ? getUsernameFontSize(c.value) : c.isText ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
                    }`}
                    title={c.value}
                  >
                    {c.value}
                  </p>
                );

                if (c.description) {
                  return (
                    <Tooltip key={c.label}>
                      <TooltipTrigger asChild>
                        <div className="min-w-0 cursor-default">
                          {label}
                          {value}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px] text-xs">{c.description}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div key={c.label} className="min-w-0">
                    {label}
                    {value}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* New User Welcome Message */}
      {isNewUser && (
        <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
              <User className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Welcome to Biz Buddy!
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Start tracking your time to see your analytics here. Once you log your first session, 
                you'll see detailed charts showing your daily hours, session status, and attendance patterns.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Averages */}
      <TooltipProvider delayDuration={200}>
        <Card className="border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl mb-4">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Averages
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {averageTiles.map((t) => (
                <div key={t.label} className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 dark:border-gray-600 pb-0.5">
                      {t.label}
                    </span>
                    {t.projected && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-gray-400 cursor-default" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs">
                          Projected rate (daily average × 7 or × 30) — not a literal total for the calendar week/month.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-gray-100">{t.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-3">
        <ChartCard title="Daily Hours" isEmpty={dailyHoursData.length === 0}>
          {dailyHoursData.length > 0 ? (
            <BarSimple data={dailyHoursData} x="date" y="hours" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                <Clock className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                No hours logged yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Start tracking time to see your daily hours
              </p>
            </div>
          )}
        </ChartCard>
        
        <ChartCard title="Session Status" isEmpty={sessionStatusData.length === 0}>
          {sessionStatusData.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <PieSimple data={sessionStatusData} />
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Active</span>
                  <span className="font-medium">{data.totals.activeSessions || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Completed</span>
                  <span className="font-medium">{completedSessions}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                <Briefcase className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                No sessions yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Create your first session to see status breakdown
              </p>
            </div>
          )}
        </ChartCard>
        
        <ChartCard title="Absence vs Late" isEmpty={absenceLateData.length === 0}>
          {absenceLateData.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <PieSimple data={absenceLateData} />
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Absences</span>
                  <span className="font-medium">{data.totals.absences || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />
                  <span className="text-gray-600 dark:text-gray-400">Late-Ins</span>
                  <span className="font-medium">{data.totals.lateIns || 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
                <CalendarDays className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Perfect attendance! 🎉
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                No absences or late check-ins recorded
              </p>
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}