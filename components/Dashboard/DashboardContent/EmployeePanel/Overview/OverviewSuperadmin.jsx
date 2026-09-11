/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import useAuthStore from "@/store/useAuthStore";
import { toast } from "sonner";
import { Server, CalendarDays, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, PieSimple, BarSimple, LineSimple, AreaSimple } from "./Commons";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 14 Days", value: "last_14_days" },
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
    case "last_30_days":
      return { from: subDays(now, 29), to: now };
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

export default function OverviewSuperadmin() {
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
      let url = `${API}/api/analytics/super-dashboard?period=${period}`;
      
      if (period === 'custom' && customStart && customEnd) {
        url += `&startDate=${format(customStart, 'yyyy-MM-dd')}&endDate=${format(customEnd, 'yyyy-MM-dd')}`;
      }

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      
      if (!r.ok) throw new Error(j.message || "Analytics fetch failed");
      setData(j.data);
    } catch (e) {
      toast.error(e.message);
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

  const SkelMetrics = () => <Skeleton className="h-40 w-full rounded-xl mb-4" />;

  const SkelCharts = (n) => (
    <div className="grid lg:grid-cols-3 gap-3">
      {Array.from({ length: n }).map((_, i) => (
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
        <SkelMetrics />
        {SkelCharts(6)}
      </>
    );
  }

  const cards = [
    {
      label: "Total Companies",
      value: data.summary.totalCompanies,
      subtitle: `+${data.summary.newCompaniesCount} this period`,
    },
    {
      label: "Total Employees",
      value: data.summary.totalEmployees,
      subtitle: `+${data.summary.newEmployeesCount} this period`,
    },
    {
      label: "Active Users",
      value: data.summary.activeUsersCount,
      subtitle: `${data.summary.engagementRate}% engagement`,
    },
    {
      label: "Monthly Recurring Revenue",
      value: `$${data.summary.mrr.toLocaleString()}`,
      subtitle: `${data.summary.totalActiveSubscriptions} active subscriptions`,
      highlight: true,
    },
    {
      label: "Hours Tracked",
      value: data.summary.totalHoursTracked.toLocaleString(),
      subtitle: `${data.summary.avgHoursPerUser} avg/user`,
    },
    { label: "Subscription Plans", value: data.summary.totalPlans, isText: true },
    {
      label: "Server Uptime",
      value: `${data.summary.serverUptime}%`,
      subtitle: `${data.summary.avgResponseTime}ms avg response`,
    },
    { label: "Leave Requests", value: data.summary.leaveRequestsCount },
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

        {/* Platform Health Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/30">
          <Server className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Platform Healthy
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl mb-4">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {cards.map((c) => (
              <div key={c.label} className="min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 dark:border-gray-600 pb-0.5">
                  {c.label}
                </span>
                <p
                  className={`mt-1.5 font-bold truncate ${c.isText ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} ${
                    c.highlight ? 'text-orange-600 dark:text-orange-500' : 'text-gray-900 dark:text-gray-100'
                  }`}
                  title={String(c.value)}
                >
                  {c.value}
                </p>
                {c.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{c.subtitle}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts - Row 1: Business Metrics */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <ChartCard title="Subscription Mix" isEmpty={!data.charts.subscriptionMix?.length}>
          {data.charts.subscriptionMix?.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <PieSimple data={data.charts.subscriptionMix} />
              <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-sm">
                {data.charts.subscriptionMix.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div 
                      className="h-2.5 w-2.5 rounded-full shadow-sm" 
                      style={{ backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5] }}
                    />
                    <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No subscription data
            </div>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Plan" isEmpty={!data.charts.revenueByPlan?.length}>
          {data.charts.revenueByPlan?.length > 0 ? (
            <BarSimple data={data.charts.revenueByPlan} x="plan" y="revenue" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No revenue data
            </div>
          )}
        </ChartCard>

        <ChartCard title="New Companies" isEmpty={!data.charts.newCompanies?.length}>
          {data.charts.newCompanies?.length > 0 ? (
            <AreaSimple data={data.charts.newCompanies} x="label" y="count" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No new companies this period
            </div>
          )}
        </ChartCard>
      </div>

      {/* Charts - Row 2: Growth & Activity */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <ChartCard title="New Employees" isEmpty={!data.charts.newEmployees?.length}>
          {data.charts.newEmployees?.length > 0 ? (
            <AreaSimple data={data.charts.newEmployees} x="label" y="count" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No new employees this period
            </div>
          )}
        </ChartCard>

        <ChartCard title="Sessions by Country" isEmpty={!data.charts.sessionsByCountry?.length}>
          {data.charts.sessionsByCountry?.length > 0 ? (
            <BarSimple data={data.charts.sessionsByCountry} x="country" y="count" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No session data
            </div>
          )}
        </ChartCard>

        <ChartCard title="Top Companies by Hours" isEmpty={!data.charts.topCompaniesByHours?.length}>
          {data.charts.topCompaniesByHours?.length > 0 ? (
            <BarSimple data={data.charts.topCompaniesByHours.slice(0, 5)} x="company" y="hours" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No activity data
            </div>
          )}
        </ChartCard>
      </div>

      {/* Table: Top Active Companies */}
      <Card className="border border-gray-200 dark:border-gray-800 shadow-none overflow-hidden mb-3">
        <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-orange-400" />
        <CardHeader className="py-3 px-4 bg-gray-50/50 dark:bg-gray-900/20">
          <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Most Active Companies ({data.dateRange?.label})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3 px-4 text-left font-medium text-gray-700 dark:text-gray-300">Company</th>
                  <th className="py-3 px-4 text-right font-medium text-gray-700 dark:text-gray-300">Active Users</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.topActiveCompanies?.slice(0, 10).map((c, i) => (
                  <tr
                    key={i}
                    className={`border-b last:border-0 border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors ${
                      i % 2 === 1 ? "bg-gray-50/30 dark:bg-gray-900/10" : ""
                    }`}
                  >
                    <td className="py-3 px-4 font-medium">{c.company}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <div className="flex-1 max-w-[120px] bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-orange-500 h-1.5 rounded-full transition-all"
                            style={{ 
                              width: `${(c.activeUsers / Math.max(...data.tables.topActiveCompanies.map((tc) => tc.activeUsers))) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold min-w-[40px] text-right">{c.activeUsers}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Table: Recent Companies */}
      {data.tables.recentCompanies?.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-800 shadow-none overflow-hidden">
          <CardHeader className="py-3 px-4 bg-gray-50/50 dark:bg-gray-900/20">
            <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recently Joined Companies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-3 px-4 text-left font-medium text-gray-700 dark:text-gray-300">Company</th>
                    <th className="py-3 px-4 text-right font-medium text-gray-700 dark:text-gray-300">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tables.recentCompanies.map((c, i) => (
                    <tr
                      key={i}
                      className={`border-b last:border-0 border-gray-200 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors ${
                        i % 2 === 1 ? "bg-gray-50/30 dark:bg-gray-900/10" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 rounded text-xs font-medium">
                          {c.daysAgo === 0 ? 'Today' : `${c.daysAgo} day${c.daysAgo > 1 ? 's' : ''} ago`}
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
  );
}