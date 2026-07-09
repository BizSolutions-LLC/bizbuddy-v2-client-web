/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { Users, Briefcase, BarChart3, Activity, Clock, CalendarCheck2, TrendingUp, TrendingDown, Percent, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ChartCard, PieSimple, BarSimple, LineSimple, GroupedBarSimple, AreaSimple } from "./Commons";
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

export default function OverviewAdmin() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Date range state
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });

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
    } else {
      toast.error("Please select both start and end dates");
    }
  };

  const SkeletonCards = (n) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );

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
        {SkeletonCards(9)}
        {SkeletonCharts(4)}
      </>
    );
  }

  // Mock trend calculation - replace with actual previous period comparison
  const calculateTrend = (value) => {
    const trend = Math.random() > 0.5 ? 1 : -1;
    const percentage = (Math.random() * 15).toFixed(1);
    return { trend, percentage };
  };

  const cards = [
    {
      icon: <Briefcase className="h-5 w-5 text-gray-500" />,
      label: "Departments",
      value: data.summary.departments,
      trend: calculateTrend(data.summary.departments),
    },
    {
      icon: <Users className="h-5 w-5 text-gray-500" />,
      label: "Total Employees",
      value: data.summary.totalEmployees,
      trend: calculateTrend(data.summary.totalEmployees),
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-gray-500" />,
      label: "Active Plan",
      value: data.summary.activePlan,
      isText: true,
    },
    {
      icon: <Activity className="h-5 w-5 text-gray-500" />,
      label: "Active Staff",
      value: data.summary.activeStaff,
      trend: calculateTrend(data.summary.activeStaff),
    },
    {
      icon: <Percent className="h-5 w-5 text-gray-500" />,
      label: "Late Rate",
      value: `${data.summary.lateRate}%`,
      trend: { trend: -1, percentage: data.summary.lateRate.toFixed(1) },
      trendInverted: true,
    },
    {
      icon: <Percent className="h-5 w-5 text-gray-500" />,
      label: "Early Leave Rate",
      value: `${data.summary.earlyLeaveRate}%`,
      trend: { trend: -1, percentage: data.summary.earlyLeaveRate.toFixed(1) },
      trendInverted: true,
    },
    {
      icon: <CalendarCheck2 className="h-5 w-5 text-gray-500" />,
      label: "Reliability",
      value: `${data.summary.reliabilityRate}%`,
      trend: { trend: 1, percentage: data.summary.reliabilityRate.toFixed(1) },
    },
    {
      icon: <Clock className="h-5 w-5 text-gray-500" />,
      label: "Coverage Rate",
      value: `${data.summary.coverageRate}%`,
      trend: { trend: 1, percentage: data.summary.coverageRate.toFixed(1) },
    },
    {
      icon: <Clock className="h-5 w-5 text-gray-500" />,
      label: "Leave Approval",
      value: `${data.summary.leaveApprovalRate}%`,
      trend: { trend: 1, percentage: data.summary.leaveApprovalRate.toFixed(1) },
    },
  ];

  const currentPreset = DATE_PRESETS.find(p => p.value === selectedPeriod);

  return (
    <div className="animate-in fade-in duration-300">
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
                  <CalendarCheck2 className="h-4 w-4 text-gray-500" />
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

        {/* Quick Stats Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/30">
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
            {data.summary.totalHoursWorked.toFixed(0)} hrs tracked
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
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
                  className={`${c.isText ? 'text-lg' : 'text-lg sm:text-2xl'} font-semibold truncate ${c.isText ? 'max-w-[100px] sm:max-w-[140px]' : ''}`} 
                  title={String(c.value)}
                >
                  {c.value}
                </p>
                {c.trend && (
                  <div className={`flex items-center text-xs font-medium flex-shrink-0 px-1.5 py-0.5 rounded ${
                    c.trendInverted 
                      ? (c.trend.trend > 0 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30')
                      : (c.trend.trend > 0 ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30')
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
                          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
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