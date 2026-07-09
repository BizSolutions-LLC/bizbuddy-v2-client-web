// components/Partial/Navbar/UserMenu.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Settings, LogOut, Shield, ChevronDown } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function UserMenu() {
  const { token, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef(null);

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            console.error("Error fetching profile:", data.error);
            logout();
          } else if (data.data) {
            setProfile(data.data);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch user profile:", err);
          logout();
        })
        .finally(() => setIsLoading(false));
    }
  }, [token, logout]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!profile && !isLoading) return null;

  const user = profile?.user;
  const userProfile = profile?.profile;
  const company = profile?.company;

  const firstInitial = userProfile?.firstName ? userProfile.firstName.charAt(0) : "";
  const lastInitial = userProfile?.lastName ? userProfile.lastName.charAt(0) : "";
  const initials = (firstInitial + lastInitial).toUpperCase() || "?";
  const fullName =
    userProfile?.firstName && userProfile?.lastName
      ? `${userProfile.firstName} ${userProfile.lastName}`
      : user?.username || "User";

  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case "superadmin":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "admin":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "manager":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-black";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (isLoading) {
    return (
      <div className="relative pl-2">
        <div className="w-10 h-10 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative pl-2" ref={menuRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-1 rounded-full transition-all duration-200 ${
          isOpen
            ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
            : "hover:ring-2 hover:ring-orange-300 hover:ring-offset-2 hover:ring-offset-white dark:hover:ring-offset-neutral-900"
        }`}
      >
        <Avatar className="w-10 h-10 border-2 border-white dark:border-neutral-700 shadow-md">
          <AvatarImage src={userProfile?.avatarUrl} alt={fullName} />
          <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="hidden sm:block">
          <ChevronDown className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-72 origin-top-right bg-white dark:bg-neutral-900 
                       border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl z-50
                       backdrop-blur-sm bg-white/95 dark:bg-neutral-900/95"
          >
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-white dark:border-neutral-700">
                  <AvatarImage src={userProfile?.avatarUrl} alt={fullName} />
                  <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">{fullName}</p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{user?.email}</p>
                  {user?.username && <p className="text-xs text-neutral-500 dark:text-neutral-500 truncate">@{user.username}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                {company?.name && (
                  <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <Shield className="w-3 h-3" />
                    <span className="truncate max-w-32">{company.name}</span>
                  </div>
                )}
                <Badge className={`capitalize text-xs ${getRoleColor(user?.role)}`}>{user?.role || "User"}</Badge>
              </div>
            </div>
            <div className="py-2">
              <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                <motion.div
                  whileHover={{ backgroundColor: "rgba(249, 115, 22, 0.1)" }}
                  className="flex items-center gap-3 px-6 py-3 text-sm text-neutral-700 dark:text-neutral-200 
                           hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Dashboard</span>
                </motion.div>
              </Link>

              <Link href="/dashboard/user/settings" onClick={() => setIsOpen(false)}>
                <motion.div
                  whileHover={{ backgroundColor: "rgba(249, 115, 22, 0.1)" }}
                  className="flex items-center gap-3 px-6 py-3 text-sm text-neutral-700 dark:text-neutral-200 
                           hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </motion.div>
              </Link>

              <div className="border-t border-neutral-200 dark:border-neutral-700 my-2" />

              <motion.button
                whileHover={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 px-6 py-3 text-sm text-red-600 dark:text-red-400 
                         hover:text-red-700 dark:hover:text-red-300 transition-colors w-full text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
