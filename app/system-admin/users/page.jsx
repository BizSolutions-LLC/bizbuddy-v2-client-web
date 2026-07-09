// app/system-admin/users/page.jsx

"use client";

import { Users, Activity, Clock, TrendingUp, BarChart3 } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Header - GitHub Style */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
          User Activity
        </h1>
        <p className="text-sm text-neutral-600">
          Monitor user API activity and behavior patterns
        </p>
      </div>

      {/* Coming Soon State - GitHub Style */}
      <div className="border border-neutral-300 rounded-md bg-white">
        <div className="p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
            <Users className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            User Activity Analytics
          </h3>
          <p className="text-sm text-neutral-600 mb-8 max-w-md mx-auto">
            Comprehensive user activity tracking, API usage patterns, and behavioral analytics will be available here soon.
          </p>

          {/* Feature Preview Cards */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center mb-3">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Activity Logs
              </h4>
              <p className="text-xs text-neutral-600">
                Track user actions and API calls in real-time
              </p>
            </div>

            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center mb-3">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Usage Patterns
              </h4>
              <p className="text-xs text-neutral-600">
                Analyze user behavior and identify trends
              </p>
            </div>

            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center mb-3">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Analytics Reports
              </h4>
              <p className="text-xs text-neutral-600">
                Generate detailed reports on user activity
              </p>
            </div>
          </div>

          {/* Planned Features List */}
          <div className="mt-8 pt-8 border-t border-neutral-200">
            <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-4">
              Planned Features
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Active Users Tracking
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                API Usage Statistics
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Session Duration Analysis
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                User Segmentation
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Behavioral Insights
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Activity Timeline
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Grid - What it will look like */}
      <div className="grid grid-cols-4 gap-4 mt-6 opacity-50 pointer-events-none">
        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="h-4 w-24 bg-neutral-200 rounded mb-3"></div>
          <div className="h-8 w-16 bg-neutral-200 rounded"></div>
        </div>
        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="h-4 w-24 bg-neutral-200 rounded mb-3"></div>
          <div className="h-8 w-16 bg-neutral-200 rounded"></div>
        </div>
        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="h-4 w-24 bg-neutral-200 rounded mb-3"></div>
          <div className="h-8 w-16 bg-neutral-200 rounded"></div>
        </div>
        <div className="border border-neutral-300 rounded-md p-4 bg-white">
          <div className="h-4 w-24 bg-neutral-200 rounded mb-3"></div>
          <div className="h-8 w-16 bg-neutral-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}