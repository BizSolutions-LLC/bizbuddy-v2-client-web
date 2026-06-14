"use client";

import { usePathname } from "next/navigation";
import BizChat from "./BizChat";

const AUTH_PATHS = ["/sign-in", "/sign-up", "/reset-password", "/payment"];

export default function BizChatLoader({ clientId }) {
  const pathname = usePathname();
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;
  return <BizChat clientId={clientId} />;
}
