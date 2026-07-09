// app/system-admin/security/page.jsx

"use client";

import { Lock, Shield, AlertTriangle, Eye, Ban, Activity } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Header - GitHub Style */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">
          Security Monitoring
        </h1>
        <p className="text-sm text-neutral-600">
          Track security incidents, suspicious activity, and unauthorized access attempts
        </p>
      </div>

      {/* Coming Soon State - GitHub Style */}
      <div className="border border-neutral-300 rounded-md bg-white">
        <div className="p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
            <Lock className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Security Monitoring & Threat Detection
          </h3>
          <p className="text-sm text-neutral-600 mb-8 max-w-md mx-auto">
            Advanced security monitoring, threat detection, and incident response tools will be available here soon to keep your system secure.
          </p>

          {/* Feature Preview Cards */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Threat Detection
              </h4>
              <p className="text-xs text-neutral-600">
                Real-time monitoring of suspicious activities and attacks
              </p>
            </div>

            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-orange-100 flex items-center justify-center mb-3">
                <Ban className="w-4 h-4 text-orange-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Access Control
              </h4>
              <p className="text-xs text-neutral-600">
                Monitor and block unauthorized access attempts
              </p>
            </div>

            <div className="border border-neutral-200 rounded-md p-4 text-left">
              <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center mb-3">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 mb-1">
                Audit Logs
              </h4>
              <p className="text-xs text-neutral-600">
                Complete audit trail of security events and actions
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
                Failed Login Attempts
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Brute Force Detection
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                IP Blocking & Whitelisting
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Rate Limit Violations
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Suspicious Activity Alerts
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Geolocation Tracking
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                API Abuse Detection
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                Security Incident Timeline
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Grid - What it will look like */}
      <div className="grid grid-cols-3 gap-4 mt-6 opacity-50 pointer-events-none">
        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="h-4 w-32 bg-neutral-200 rounded"></div>
          </div>
          <div className="p-4 space-y-3">
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="h-4 w-32 bg-neutral-200 rounded"></div>
          </div>
          <div className="p-4 space-y-3">
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
          </div>
        </div>

        <div className="border border-neutral-300 rounded-md bg-white">
          <div className="p-4 border-b border-neutral-200">
            <div className="h-4 w-32 bg-neutral-200 rounded"></div>
          </div>
          <div className="p-4 space-y-3">
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
            <div className="h-12 bg-neutral-100 rounded"></div>
          </div>
        </div>
      </div>

      {/* Security Alert Banner Preview */}
      <div className="mt-6 opacity-50 pointer-events-none">
        <div className="border border-red-300 bg-red-50 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-red-200 rounded mb-2"></div>
              <div className="h-3 w-full bg-red-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}