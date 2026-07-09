// app/system-admin/performance/page.jsx

"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock, AlertCircle, RefreshCw, Zap, Activity, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function PerformancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("system-admin-token");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/performance?timeRange=${timeRange}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceColor = (time) => {
    if (time < 100) return "text-green-600";
    if (time < 500) return "text-yellow-600";
    return "text-red-600";
  };

  const getPerformanceBadge = (time) => {
    if (time < 100) return "bg-green-50 text-green-700 border-green-300";
    if (time < 500) return "bg-yellow-50 text-yellow-700 border-yellow-300";
    return "bg-red-50 text-red-700 border-red-300";
  };

  const getErrorBadge = (errorRate) => {
    const rate = parseFloat(errorRate);
    if (rate < 1) return "bg-green-50 text-green-700";
    if (rate < 5) return "bg-yellow-50 text-yellow-700";
    return "bg-red-50 text-red-700";
  };

  if (loading && !data) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      </div>
    );
  }

  // Prepare percentile comparison data for chart
  let percentileChartData = [];
  if (data?.endpoints && Array.isArray(data.endpoints)) {
    percentileChartData = data.endpoints.slice(0, 10).map(endpoint => ({
      name: endpoint.endpoint.length > 25 ? endpoint.endpoint.substring(0, 25) + '...' : endpoint.endpoint,
      p50: endpoint.p50ResponseTime || 0,
      p95: endpoint.p95ResponseTime || 0,
      p99: endpoint.p99ResponseTime || 0,
    }));
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Header - GitHub Style */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
              Performance Metrics
            </h1>
            <p className="text-sm text-neutral-600">
              Endpoint response times, percentiles, and optimization insights
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-md border border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-neutral-700 ${loading ? "animate-spin" : ""}`} />
            </button>
            
            <div className="flex items-center rounded-md border border-neutral-300 bg-white">
              {["1h", "6h", "24h", "7d", "30d"].map((range, idx) => (
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

      {/* Performance Summary - GitHub Style */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Fast Endpoints</span>
            <Zap className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {Array.isArray(data?.endpoints) ? data.endpoints.filter(e => e.avgResponseTime < 100).length : 0}
            </span>
          </div>
          <div className="text-xs text-neutral-600 mt-1">
            Response time &lt; 100ms
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Moderate</span>
            <Activity className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {Array.isArray(data?.endpoints) ? data.endpoints.filter(e => e.avgResponseTime >= 100 && e.avgResponseTime < 500).length : 0}
            </span>
          </div>
          <div className="text-xs text-neutral-600 mt-1">
            Response time 100-500ms
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wide">Needs Optimization</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-neutral-900 tabular-nums">
              {Array.isArray(data?.endpoints) ? data.endpoints.filter(e => e.avgResponseTime >= 500).length : 0}
            </span>
          </div>
          <div className="text-xs text-neutral-600 mt-1">
            Response time &gt; 500ms
          </div>
        </div>
      </div>

      {/* Percentile Chart - GitHub Style */}
      {percentileChartData.length > 0 && (
        <div className="border border-neutral-300 rounded-md bg-white mb-6">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">Response Time Percentiles</h2>
            <p className="text-xs text-neutral-600 mt-1">Top 10 endpoints by request volume</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={percentileChartData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#d1d5db" 
                  style={{ fontSize: '10px' }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#d1d5db" 
                  style={{ fontSize: '11px' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'ms', angle: 0, position: 'top', offset: 10, style: { fontSize: '11px' } }}
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
                <Legend 
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
                <Bar dataKey="p50" fill="#1f883d" name="P50 (Median)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p95" fill="#d97706" name="P95" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p99" fill="#dc2626" name="P99" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="px-4 pb-4 flex items-center gap-6 text-xs text-neutral-600">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-green-600 rounded-sm"></div>
              <span>P50: 50% of requests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-yellow-600 rounded-sm"></div>
              <span>P95: 95% of requests</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-600 rounded-sm"></div>
              <span>P99: 99% of requests</span>
            </div>
          </div>
        </div>
      )}

      {/* Slowest Endpoints - GitHub List Style */}
      {data?.slowestEndpoints && data.slowestEndpoints.length > 0 && (
        <div className="border border-neutral-300 rounded-md bg-white mb-6">
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Slowest Endpoints</h2>
            </div>
            <p className="text-xs text-neutral-600 mt-1">Endpoints requiring immediate optimization</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {data.slowestEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono bg-red-100 text-red-700">
                        {endpoint.method}
                      </span>
                      <span className="text-sm text-neutral-900 font-mono truncate">
                        {endpoint.endpoint}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600">
                      {endpoint.request_count.toLocaleString()} requests
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-semibold text-red-600 tabular-nums">
                      {endpoint.avg_response_time}ms
                    </div>
                    <div className="text-xs text-neutral-500">
                      max {endpoint.max_response_time}ms
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Endpoints Table - GitHub Style */}
      {data?.endpoints && data.endpoints.length > 0 && (
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">All Endpoints</h2>
            <p className="text-xs text-neutral-600 mt-1">Complete performance breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Endpoint
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Requests
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Avg
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    P50
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    P95
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    P99
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Max
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Errors
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                    Error Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.endpoints.map((endpoint, index) => (
                  <tr
                    key={index}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono bg-blue-100 text-blue-700">
                          {endpoint.method}
                        </span>
                        <span className="text-sm font-mono text-neutral-900 truncate max-w-md">
                          {endpoint.endpoint}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-neutral-900 tabular-nums">
                      {endpoint.requestCount.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`text-sm font-semibold tabular-nums ${getPerformanceColor(endpoint.avgResponseTime)}`}>
                        {endpoint.avgResponseTime}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-neutral-600 tabular-nums">
                      {endpoint.p50ResponseTime}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-neutral-600 tabular-nums">
                      {endpoint.p95ResponseTime}
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-neutral-600 tabular-nums">
                      {endpoint.p99ResponseTime}
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border tabular-nums ${getPerformanceBadge(endpoint.maxResponseTime)}`}>
                        {endpoint.maxResponseTime}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`text-sm font-semibold tabular-nums ${endpoint.errorCount > 0 ? "text-red-600" : "text-green-600"}`}>
                        {endpoint.errorCount}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${getErrorBadge(endpoint.errorRate)}`}>
                        {endpoint.errorRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data State - GitHub Style */}
      {(!data?.endpoints || data.endpoints.length === 0) && !loading && (
        <div className="border border-neutral-300 rounded-md bg-white p-16 text-center">
          <Activity className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-neutral-900 mb-1">No performance data</h3>
          <p className="text-sm text-neutral-600">
            No endpoint performance data available for the selected time range.
          </p>
        </div>
      )}
    </div>
  );
}