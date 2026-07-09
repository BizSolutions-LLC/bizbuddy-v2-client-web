/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import useAuthStore from "@/store/useAuthStore";
import { toast } from "sonner";
import { 
  Building, Users, BarChart3, Activity, DollarSign, Server, 
  TrendingUp, TrendingDown, CalendarDays, ChevronDown, Zap, Globe 
} from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, PieSimple, BarSimple, LineSimple, AreaSimple } from "./Commons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 30 Days", value: "last_30_days" },
  { label: "Last 7 Days", value: "last_7_days" },
  { label: "Last 14 Days", value: "last_14_days" },
  { label: "Custom Range", value: "custom" },
];

export default function OverviewSuperadmin() {
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

  // Mock trend calculation - replace with actual previous period comparison
  const calculateTrend = (value) => {
    const trend = Math.random() > 0.5 ? 1 : -1;
    const percentage = (Math.random() * 15).toFixed(1);
    return { trend, percentage };
  };

  const SkelCards = (n) => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-lg" />
      ))}
    </div>
  );

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
        {SkelCards(8)}
        {SkelCharts(6)}
      </>
    );
  }

  const cards = [
    { 
      icon: <Building className="h-5 w-5 text-gray-500" />, 
      label: "Total Companies", 
      value: data.summary.totalCompanies,
      subtitle: `+${data.summary.newCompaniesCount} this period`,
      trend: calculateTrend(data.summary.totalCompanies)
    },
    { 
      icon: <Users className="h-5 w-5 text-gray-500" />, 
      label: "Total Employees", 
      value: data.summary.totalEmployees,
      subtitle: `+${data.summary.newEmployeesCount} this period`,
      trend: calculateTrend(data.summary.totalEmployees)
    },
    { 
      icon: <Activity className="h-5 w-5 text-gray-500" />, 
      label: "Active Users", 
      value: data.summary.activeUsersCount,
      subtitle: `${data.summary.engagementRate}% engagement`,
      trend: calculateTrend(data.summary.activeUsersCount)
    },
    { 
      icon: <DollarSign className="h-5 w-5 text-gray-500" />, 
      label: "Monthly Recurring Revenue", 
      value: `$${data.summary.mrr.toLocaleString()}`,
      subtitle: `${data.summary.totalActiveSubscriptions} active subscriptions`,
      trend: calculateTrend(data.summary.mrr),
      highlight: true
    },
    { 
      icon: <Zap className="h-5 w-5 text-gray-500" />, 
      label: "Hours Tracked", 
      value: data.summary.totalHoursTracked.toLocaleString(),
      subtitle: `${data.summary.avgHoursPerUser} avg/user`,
      trend: calculateTrend(data.summary.totalHoursTracked)
    },
    { 
      icon: <BarChart3 className="h-5 w-5 text-gray-500" />, 
      label: "Subscription Plans", 
      value: data.summary.totalPlans,
      isText: true
    },
    { 
      icon: <Server className="h-5 w-5 text-gray-500" />, 
      label: "Server Uptime", 
      value: `${data.summary.serverUptime}%`,
      subtitle: `${data.summary.avgResponseTime}ms avg response`,
      trend: { trend: 1, percentage: data.summary.serverUptime }
    },
    { 
      icon: <Globe className="h-5 w-5 text-gray-500" />, 
      label: "Leave Requests", 
      value: data.summary.leaveRequestsCount,
      trend: calculateTrend(data.summary.leaveRequestsCount)
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

        {/* Platform Health Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/30">
          <Server className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Platform Healthy
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
        {cards.map((c) => (
          <Card 
            key={c.label} 
            className={cn(
              "border transition-all duration-200 overflow-hidden shadow-none hover:shadow-sm",
              c.highlight 
                ? "border-orange-200 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/20 dark:to-gray-950" 
                : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            )}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {c.label}
              </CardTitle>
              <div className={cn(
                "p-1.5 rounded-md flex-shrink-0 shadow-sm",
                c.highlight 
                  ? "bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/40 dark:to-orange-800/40" 
                  : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900"
              )}>
                {c.icon}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg sm:text-2xl font-semibold truncate" title={String(c.value)}>
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
              {c.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {c.subtitle}
                </p>
              )}
              {c.trend && !c.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  vs previous period
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
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