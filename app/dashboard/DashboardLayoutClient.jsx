/* app/dashboard/DashboardLayoutClient.jsx */
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MenuIcon } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import Sidebar from "@/components/Dashboard/sidebar";
import PageLoader from "@/components/Dashboard/PageLoader";
import DashboardSkeleton from "./DashboardSkeleton";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import FeedbackWidget from "@/components/common/FeedbackWidget";

export default function DashboardLayoutClient({ children }) {
  const { token, login, sidebarOpen, setSidebarOpen } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  const isSidebarOpen = sidebarOpen;

  useEffect(() => {
    const pinned = localStorage.getItem("sidebarPinned") === "true";
    setIsSidebarPinned(pinned);
    if (pinned) setSidebarOpen(true);
  }, [setSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("sidebarPinned", isSidebarPinned);
  }, [isSidebarPinned]);

  const togglePin = () => {
    setIsSidebarPinned((p) => {
      const next = !p;
      if (next) setSidebarOpen(true);
      return next;
    });
  };

  useEffect(() => {
    if (!token) {
      const stored = localStorage.getItem("auth-storage");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.state?.token) {
            login(parsed.state.token);
            return;
          }
        } catch (_) {}
      }
      router.push("/sign-in");
      setIsLoadingAuth(false);
    } else {
      setIsLoadingAuth(false);
    }
  }, [token, login, router]);

  useEffect(() => {
    if (!isLoadingAuth) {
      const t = setTimeout(() => setIsReady(true), 50);
      return () => clearTimeout(t);
    }
  }, [isLoadingAuth]);

  useEffect(() => {
    if (!isRouteChanging) return;
    const t = setTimeout(() => setIsRouteChanging(false), 200);
    return () => clearTimeout(t);
  }, [pathname, isRouteChanging]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768 && !isSidebarPinned) setSidebarOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isSidebarPinned, setSidebarOpen]);

  if (isLoadingAuth || !isReady) return <DashboardSkeleton />;
  if (!token) return null;

  const closeSidebar = () => {
    if (!isSidebarPinned) setSidebarOpen(false);
  };

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {isRouteChanging && <PageLoader />}

      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
        <AnimatePresence>
          {!isSidebarOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex fixed top-3 left-6 z-50 p-3
                         bg-gradient-to-r from-orange-500 to-orange-600 text-white
                         rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <MenuIcon className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <Sidebar
          isSidebarOpen={isSidebarOpen}
          closeSidebar={closeSidebar}
          onNavigateStart={() => setIsRouteChanging(true)}
          isSidebarPinned={isSidebarPinned}
          togglePin={togglePin}
        />

        <FeedbackWidget isSidebarOpen={isSidebarOpen} />

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`transition-all duration-300 ease-in-out min-h-screen
                     ${isSidebarOpen ? "md:ml-80 md:pl-6" : "md:ml-0 md:pl-20"}`}
        >
          <div className="p-2 sm:p-4 md:p-6 lg:p-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm rounded-xl sm:rounded-2xl
                         shadow-sm border border-neutral-200/50 dark:border-neutral-700/50
                         min-h-[calc(100vh-8rem)] md:min-h-[calc(100vh-6rem)] min-w-0"
            >
              <ErrorBoundary>{children}</ErrorBoundary>
            </motion.div>
          </div>
        </motion.main>
      </div>
    </Suspense>
  );
}
