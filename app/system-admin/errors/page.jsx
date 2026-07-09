// app/system-admin/errors/page.jsx

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, XCircle, RefreshCw, Server } from "lucide-react";

export default function ErrorsPage() {
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/errors?timeRange=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        // console.log("🔴 Error data received:", result.data);
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching error data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusCodeColor = (code) => {
    if (code >= 500) return "text-red-600";
    if (code >= 400) return "text-yellow-600";
    return "text-neutral-600";
  };

  const getStatusCodeBadge = (code) => {
    if (code >= 500) return "bg-red-50 text-red-700 border-red-300";
    if (code >= 400) return "bg-yellow-50 text-yellow-700 border-yellow-300";
    return "bg-neutral-50 text-neutral-700 border-neutral-300";
  };

  const getStatusCodeLabel = (code) => {
    if (code >= 500) return "Server Error";
    if (code >= 400) return "Client Error";
    return "Unknown";
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

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Header - GitHub Style */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
              Error Tracking
            </h1>
            <p className="text-sm text-neutral-600">
              Monitor and analyze system errors and failures
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

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Errors by Endpoint */}
        {data?.errorsByEndpoint && data.errorsByEndpoint.length > 0 && (
          <div className="border border-neutral-300 rounded-md bg-white">
            <div className="p-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h2 className="text-sm font-semibold text-neutral-900">Errors by Endpoint</h2>
              </div>
              <p className="text-xs text-neutral-600 mt-1">Endpoints with the most errors</p>
            </div>
            <div className="divide-y divide-neutral-200 max-h-[600px] overflow-y-auto">
              {data.errorsByEndpoint.map((item, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium font-mono bg-red-100 text-red-700">
                        {item.method}
                      </span>
                      <span className="text-sm font-mono text-neutral-900 truncate">
                        {item.endpoint}
                      </span>
                    </div>
                    <span className="text-lg font-semibold text-red-600 tabular-nums ml-4">
                      {item.error_count || item.errorCount}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600">
                    Status Code: <span className={`font-medium ${getStatusCodeColor(item.status_code || item.statusCode)}`}>
                      {item.status_code || item.statusCode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors by Status Code */}
        {data?.errorsByStatusCode && data.errorsByStatusCode.length > 0 && (
          <div className="border border-neutral-300 rounded-md bg-white">
            <div className="p-4 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-yellow-600" />
                <h2 className="text-sm font-semibold text-neutral-900">Errors by Status Code</h2>
              </div>
              <p className="text-xs text-neutral-600 mt-1">Distribution of HTTP error codes</p>
            </div>
            <div className="divide-y divide-neutral-200">
              {data.errorsByStatusCode.map((item, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-xl font-semibold tabular-nums mb-1 ${getStatusCodeColor(item.statusCode)}`}>
                        {item.statusCode}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {getStatusCodeLabel(item.statusCode)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-neutral-900 tabular-nums">
                        {item.count}
                      </div>
                      <div className="text-xs text-neutral-600">errors</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Errors by Type */}
      {data?.errorsByType && data.errorsByType.length > 0 && (
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-neutral-600" />
              <h2 className="text-sm font-semibold text-neutral-900">Errors by Type</h2>
            </div>
            <p className="text-xs text-neutral-600 mt-1">Error classification and categories</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {data.errorsByType.map((item, index) => (
                <div
                  key={index}
                  className="border border-neutral-200 rounded-md p-4 hover:border-neutral-400 transition-colors"
                >
                  <div className="text-sm font-medium text-neutral-900 mb-2 truncate" title={item.errorType || "Unknown"}>
                    {item.errorType || "Unknown"}
                  </div>
                  <div className="text-2xl font-semibold text-red-600 tabular-nums">
                    {item.count}
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">occurrences</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {(!data?.errorsByEndpoint?.length && !data?.errorsByStatusCode?.length && !data?.errorsByType?.length) && !loading && (
        <div className="border border-neutral-300 rounded-md bg-white p-16 text-center">
          <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-neutral-900 mb-1">No errors found</h3>
          <p className="text-sm text-neutral-600">
            No errors detected in the selected time range. System is running smoothly!
          </p>
        </div>
      )}
    </div>
  );
}