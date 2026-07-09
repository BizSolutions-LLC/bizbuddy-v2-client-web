// components/LoadingScreen.jsx

"use client";

import { Loader2 } from "lucide-react";

export default function LoadingScreen({ sizeClass = "h-12 w-12" }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Loader2 className={`${sizeClass} animate-spin`} />
    </div>
  );
}
