// components/system-admin/SystemAdminNav.jsx

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  Users,
  Lock,
  FileText,
  LogOut,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import ScreenshotButton from "./ScreenshotButton";

const navItems = [
  { href: "/system-admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/system-admin/performance", label: "Performance", icon: TrendingUp },
  { href: "/system-admin/errors", label: "Errors", icon: AlertTriangle },
  { href: "/system-admin/users", label: "Users", icon: Users },
  { href: "/system-admin/security", label: "Security", icon: Lock },
];

export default function SystemAdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/system-admin/auth/logout`, { 
        method: "POST" 
      });
      localStorage.removeItem("system-admin-token");
      router.push("/system-admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("system-admin-token");
      router.push("/system-admin/login");
    }
  };

  return (
    <nav className="bg-white border-b border-neutral-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div
            className="flex items-center space-x-3"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                System Admin
                <Activity className="w-4 h-4 text-orange-500 animate-pulse" />
              </h1>
              <p className="text-xs text-neutral-500">BizBuddy Analytics</p>
            </div>
          </motion.div>

          {/* Nav Links */}
          <div className="flex items-center space-x-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <motion.div
                  key={item.href}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-orange-50 text-orange-600 border border-orange-200"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium hidden lg:block">
                      {item.label}
                    </span>
                  </Link>
                </motion.div>
              );
            })}

            {/* Screenshot Button */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: navItems.length * 0.05 }}
            >
              <ScreenshotButton />
            </motion.div>

            {/* Logout */}
            <motion.button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-neutral-600 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-all duration-200 ml-2"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: (navItems.length + 1) * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium hidden lg:block">
                Logout
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </nav>
  );
}