// app/system-admin/layout.jsx

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import SystemAdminNav from "@/components/system-admin/SystemAdminNav";
import { SystemAdminProvider } from "@/components/system-admin/SystemAdminContext";
import {
  systemAdminFetch,
  getSystemAdminToken,
  SYSTEM_ADMIN_LOGIN,
  RECOVERY_LEFT_KEY,
} from "@/lib/systemAdminFetch";

export default function SystemAdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryLeft, setRecoveryLeft] = useState(null);

  const isLoginPage = pathname === SYSTEM_ADMIN_LOGIN;

  // BB-110: /auth/verify → { id, username, name, isOwner, twoFactorEnabled, ... }
  const refreshAdmin = useCallback(async () => {
    const data = await systemAdminFetch("/api/system-admin/auth/verify");
    setAdmin(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    if (!getSystemAdminToken()) {
      router.push(SYSTEM_ADMIN_LOGIN);
      return;
    }

    // A 401 is redirected to sign-in by systemAdminFetch
    refreshAdmin()
      .catch((error) => console.error("Auth verification error:", error))
      .finally(() => setLoading(false));
  }, [isLoginPage, refreshAdmin, router]);

  // Low recovery codes warning, set by the sign-in page
  useEffect(() => {
    try {
      const left = sessionStorage.getItem(RECOVERY_LEFT_KEY);
      setRecoveryLeft(left === null ? null : Number(left));
    } catch {}
  }, [pathname]);

  const dismissRecoveryBanner = () => {
    try {
      sessionStorage.removeItem(RECOVERY_LEFT_KEY);
    } catch {}
    setRecoveryLeft(null);
  };

  // The root layout pads <main> for the public navbar (pt-16), which is hidden here
  if (loading) {
    return (
      <div className="-mt-16 min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-orange-600 mb-4"></div>
          <p className="text-neutral-600 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <div className="-mt-16">{children}</div>;
  }

  if (!admin) {
    return null;
  }

  return (
    <SystemAdminProvider value={{ admin, refreshAdmin }}>
      <div className="-mt-16 min-h-screen bg-neutral-50">
        <SystemAdminNav />
        {recoveryLeft !== null && (
          <div className="border-b border-yellow-200 bg-yellow-50">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">
                You have {recoveryLeft} recovery code{recoveryLeft === 1 ? "" : "s"} left. Generate new ones in{" "}
                <Link href="/system-admin/account" className="font-medium underline">
                  Account settings
                </Link>
                .
              </span>
              <button onClick={dismissRecoveryBanner} aria-label="Dismiss" className="hover:text-yellow-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </SystemAdminProvider>
  );
}
