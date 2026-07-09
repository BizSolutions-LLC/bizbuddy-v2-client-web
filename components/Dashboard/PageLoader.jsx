/* components/Dashboard/PageLoader.jsx */
"use client";

import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center
                    bg-white/70 dark:bg-neutral-900/70 backdrop-blur-sm"
    >
      <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
    </div>
  );
}
