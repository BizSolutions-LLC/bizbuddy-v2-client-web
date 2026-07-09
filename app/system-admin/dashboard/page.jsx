// app/system-admin/dashboard/page.jsx

"use client";

import { useEffect, useState } from "react";
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Users, 
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Server,
  Zap,
  Database,
  GitCommit,
  TrendingUp,
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function SystemAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchAllData();
    
    const interval = setInterval(() => {
      fetchAllData(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const token = localStorage.getItem("system-admin-token");
      
      const [overviewRes, trendsRes, performanceRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/overview?timeRange=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/trends?timeRange=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/performance?timeRange=${timeRange}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [overviewData, trendsData, performanceData] = await Promise.all([
        overviewRes.json(),
        trendsRes.json(),
        performanceRes.json(),
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (trendsData.success) setTrends(trendsData.data);
      if (performanceData.success) setPerformance(performanceData.data);
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (errorRate) => {
    const rate = parseFloat(errorRate);
    if (rate < 1) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (rate < 5) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <XCircle className="w-4 h-4 text-red-600" />;
  };

  const getStatusText = (errorRate) => {
    const rate = parseFloat(errorRate);
    if (rate < 1) return "All systems operational";
    if (rate < 5) return "Degraded performance";
    return "System issues detected";
  };

  if (loading && !overview) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </div>
    );
  }

  const trendChartData = trends?.map(t => ({
    time: new Date(t.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    requests: t.request_count,
    errors: t.error_count,
    avgResponseTime: t.avg_response_time,
  })) || [];

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Header - GitHub Style */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
              System Dashboard
            </h1>
            <div className="flex items-center gap-3 text-sm text-neutral-600">
              <div className="flex items-center gap-1.5">
                {getStatusIcon(overview?.errorRate || 0)}
                <span>{getStatusText(overview?.errorRate || 0)}</span>
              </div>
              <span className="text-neutral-400">•</span>
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAllData()}
              disabled={loading}
              className="p-2 rounded-md border border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-neutral-700 ${loading ? "animate-spin" : ""}`} />
            </button>
            
            <div className="flex items-center rounded-md border border-neutral-300 bg-white">
              {["1h", "6h", "24h", "7d", "30d"].map((range, idx, arr) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  disabled={loading}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    idx !== 0 ? "border-l border-neutral-300" : ""
                  } ${
                    timeRange === range
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - GitHub Compact Style */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="border border-neutral-300 rounded-md p-4 bg-white hover:border-neutral-400 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Requests</span>
            <Activity className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {overview?.totalRequests?.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              12.5%
            </span>
          </div>
          <div className="text-xs text-neutral-600">
            {overview?.successfulRequests?.toLocaleString()} successful
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md p-4 bg-white hover:border-neutral-400 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Error Rate</span>
            <AlertTriangle className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {overview?.errorRate}%
            </span>
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" />
              2.3%
            </span>
          </div>
          <div className="text-xs text-neutral-600">
            {overview?.failedRequests?.toLocaleString()} errors
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md p-4 bg-white hover:border-neutral-400 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Response Time</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {overview?.avgResponseTime}
            </span>
            <span className="text-sm text-neutral-600">ms</span>
          </div>
          <div className="text-xs text-neutral-600">
            {overview?.slowRequests} slow requests
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md p-4 bg-white hover:border-neutral-400 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Active Users</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {overview?.uniqueUsers || "0"}
            </span>
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              8.1%
            </span>
          </div>
          <div className="text-xs text-neutral-600">
            {overview?.uniqueCompanies} companies
          </div>
        </div>
      </div>

      {/* Charts Section - GitHub Minimal Style */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Request Volume */}
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Request Volume</h2>
              <Zap className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData}>
                <XAxis 
                  dataKey="time" 
                  stroke="#d1d5db" 
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#d1d5db" 
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="#0969da" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#0969da' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Times */}
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">Response Times</h2>
              <Database className="w-4 h-4 text-neutral-400" />
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendChartData}>
                <XAxis 
                  dataKey="time" 
                  stroke="#d1d5db" 
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#d1d5db" 
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    padding: '8px 12px'
                  }}
                  cursor={{ fill: '#f6f8fa' }}
                />
                <Bar 
                  dataKey="avgResponseTime" 
                  fill="#1f883d" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Endpoints - GitHub List Style */}
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Top Endpoints</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            {performance?.endpoints && performance.endpoints.length > 0 ? (
              performance.endpoints.slice(0, 6).map((endpoint, index) => (
                <div 
                  key={index} 
                  className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono bg-blue-100 text-blue-700">
                          {endpoint.method}
                        </span>
                        <span className="text-sm text-neutral-900 font-mono truncate group-hover:text-blue-600 transition-colors">
                          {endpoint.endpoint}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-neutral-600">
                        <span className="flex items-center gap-1">
                          <GitCommit className="w-3 h-3" />
                          {endpoint.requestCount} requests
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {endpoint.avgResponseTime}ms avg
                        </span>
                        <span className={`flex items-center gap-1 ${
                          parseFloat(endpoint.errorRate) > 5 ? "text-red-600" :
                          parseFloat(endpoint.errorRate) > 1 ? "text-yellow-600" :
                          "text-green-600"
                        }`}>
                          <Circle className="w-2 h-2 fill-current" />
                          {endpoint.errorRate}% errors
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-neutral-500">
                No endpoint data available
              </div>
            )}
          </div>
          <div className="p-3 border-t border-neutral-200">
            <Link href="/system-admin/performance">
              <button className="w-full py-2 text-xs font-medium text-neutral-700 hover:text-blue-600 hover:bg-neutral-50 rounded-md transition-colors">
                View all endpoints →
              </button>
            </Link>
          </div>
        </div>

        {/* Activity Feed - GitHub Style */}
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">System Activity</h2>
          </div>
          <div className="divide-y divide-neutral-200">
            <Link href="/system-admin/errors">
              <div className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 mb-1">
                      Error Log
                    </div>
                    <div className="text-xs text-neutral-600">
                      {overview?.failedRequests || 0} errors detected in the last {timeRange}
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </Link>

            <Link href="/system-admin/performance">
              <div className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 mb-1">
                      Performance Metrics
                    </div>
                    <div className="text-xs text-neutral-600">
                      Average response time: {overview?.avgResponseTime}ms
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </Link>

            <Link href="/system-admin/security">
              <div className="p-4 hover:bg-neutral-50 transition-colors cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <div className="w-8 h-8 rounded-md bg-orange-100 flex items-center justify-center">
                      <Server className="w-4 h-4 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 group-hover:text-blue-600 mb-1">
                      Security Monitoring
                    </div>
                    <div className="text-xs text-neutral-600">
                      Monitor unauthorized access attempts
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </Link>

            <div className="p-4 hover:bg-neutral-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900 mb-1">
                    System Status
                  </div>
                  <div className="text-xs text-neutral-600">
                    {overview?.uniqueUsers || 0} active users · {overview?.uniqueCompanies || 0} companies online
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}