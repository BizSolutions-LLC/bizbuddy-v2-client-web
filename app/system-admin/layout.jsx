// app/system-admin/layout.jsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SystemAdminNav from "@/components/system-admin/SystemAdminNav";

export default function SystemAdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === "/system-admin/login") {
      setLoading(false);
      return;
    }

    const verifyAuth = async () => {
      try {
        const token = localStorage.getItem("system-admin-token");
        
        if (!token) {
          router.push("/system-admin/login");
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        const data = await response.json();

        if (data.success) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("system-admin-token");
          router.push("/system-admin/login");
        }
      } catch (error) {
        console.error("Auth verification error:", error);
        localStorage.removeItem("system-admin-token");
        router.push("/system-admin/login");
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-orange-600 mb-4"></div>
          <p className="text-neutral-600 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (pathname === "/system-admin/login") {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <SystemAdminNav />
      <main className="p-6">{children}</main>
    </div>
  );
}