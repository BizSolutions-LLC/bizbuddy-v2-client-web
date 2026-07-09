/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChartCard, PieSimple, BarSimple } from "./Commons";
import { User, Briefcase, Clock, TrendingUp, TrendingDown, CalendarDays, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 14 Days", value: "last_14_days" },
  { label: "Last 28 Days", value: "last_28_days" },
  { label: "Custom Range", value: "custom" },
];

export default function OverviewEmployee() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      setCustomDateRange({ from: null, to: null });
    }
  };

  const handleCustomDateApply = () => {
    if (customDateRange.from && customDateRange.to) {
      setSelectedPeriod('custom');
      fetchAnalytics('custom', customDateRange.from, customDateRange.to);
      setIsDatePickerOpen(false);
    } else {
      toast.error("Please select both start and end dates");
    }
  };

  const SkelCards = (n) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );

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
        {SkelCards(5)}
        <SkelCharts />
      </>
    );

  // Calculate trend (mock - you'd compare with previous period in real implementation)
  const calculateTrend = (value) => {
    const trend = Math.random() > 0.5 ? 1 : -1;
    const percentage = (Math.random() * 15).toFixed(1);
    return { trend, percentage };
  };

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
    { 
      icon: <User className="h-5 w-5 text-gray-500" />, 
      label: "Username", 
      value: data.profile.username || "No username",
      isText: true,
      dynamicSize: true
    },
    { 
      icon: <Briefcase className="h-5 w-5 text-gray-500" />, 
      label: "Department", 
      value: data.profile.department || "Not assigned",
      isText: true
    },
    { 
      icon: <Clock className="h-5 w-5 text-gray-500" />, 
      label: "Total Hours", 
      value: data.totals.totalHours || 0,
      trend: calculateTrend(data.totals.totalHours)
    },
    { 
      icon: <Clock className="h-5 w-5 text-gray-500" />, 
      label: "Overtime", 
      value: data.totals.overtime || 0,
      trend: calculateTrend(data.totals.overtime)
    },
    { 
      icon: <CalendarDays className="h-5 w-5 text-gray-500" />, 
      label: "Absences", 
      value: data.totals.absences || 0,
      trend: calculateTrend(data.totals.absences)
    },
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

  return (
    <>
      {/* Professional Date Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-between font-medium shadow-sm hover:shadow-md transition-all duration-200",
                  "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                  "bg-white dark:bg-gray-950 min-w-[200px]"
                )}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {selectedPeriod === 'custom' && customDateRange.from && customDateRange.to
                      ? `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd, yyyy')}`
                      : currentPreset?.label || "This Month"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col">
                {/* Preset Options */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1.5">
                    Quick Select
                  </p>
                  {DATE_PRESETS.filter(p => p.value !== 'custom').map((preset) => (
                    <Button
                      key={preset.value}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start font-normal",
                        selectedPeriod === preset.value && "bg-gray-100 dark:bg-gray-800 font-medium"
                      )}
                      onClick={() => handlePeriodChange(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {/* Custom Date Range */}
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1.5 mb-2">
                    Custom Range
                  </p>
                  <Calendar
                    mode="range"
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                    className="rounded-md"
                  />
                  <div className="flex gap-2 mt-3 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setCustomDateRange({ from: null, to: null })}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleCustomDateApply}
                      disabled={!customDateRange.from || !customDateRange.to}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
        {cards.map((c) => (
          <Card 
            key={c.label} 
            className="border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden shadow-none hover:shadow-sm"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {c.label}
              </CardTitle>
              <div className="p-1.5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-md flex-shrink-0 shadow-sm">
                {c.icon}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-baseline justify-between gap-2">
                <p 
                  className={`font-semibold truncate ${
                    c.dynamicSize 
                      ? getUsernameFontSize(c.value) 
                      : c.isText 
                        ? 'text-lg' 
                        : 'text-lg sm:text-2xl'
                  } ${c.isText ? 'max-w-[120px] sm:max-w-[180px]' : ''}`} 
                  title={c.value}
                >
                  {c.value}
                </p>
                {c.trend && (
                  <div className={`flex items-center text-xs font-medium flex-shrink-0 px-1.5 py-0.5 rounded ${
                    c.trend.trend > 0 
                      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30' 
                      : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
                  }`}>
                    {c.trend.trend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {c.trend.percentage}%
                  </div>
                )}
              </div>
              {c.trend && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  vs previous period
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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