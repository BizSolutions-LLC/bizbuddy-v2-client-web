"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import {
  getCurrentVersion,
  getLastSeenVersion,
  saveVersion,
  shouldForceLogout,
  clearUserData,
} from "@/lib/versionCheck";

/**
 * VersionCheck Component
 * Checks app version on mount and forces logout if major version changed
 */
export default function VersionCheck() {
  const router = useRouter();
  const { token, logout } = useAuthStore();

  useEffect(() => {
    const currentVersion = getCurrentVersion();
    const lastSeenVersion = getLastSeenVersion();

    if (token && shouldForceLogout(currentVersion, lastSeenVersion)) {
      logout();
      
      clearUserData();
      
      saveVersion(currentVersion);
      
      router.push('/sign-in');
      
    } else {
      saveVersion(currentVersion);
    }
  }, [token, logout, router]);

  return null;
}