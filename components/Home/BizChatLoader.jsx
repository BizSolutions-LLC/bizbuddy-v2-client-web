"use client";

import { usePathname } from "next/navigation";
import BizChat from "./BizChat";

const AUTH_PATHS = ["/sign-in", "/sign-up", "/reset-password", "/payment"];
// BB-110: no third-party scripts on the system-admin dashboard (its session token is in localStorage)
const EXCLUDED_PATHS = [...AUTH_PATHS, "/system-admin"];

export default function BizChatLoader({ clientId }) {
  const pathname = usePathname();
  if (EXCLUDED_PATHS.some((p) => pathname.startsWith(p))) return null;
  return <BizChat clientId={clientId} />;
}
