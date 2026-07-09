// components/ui/textarea.jsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full min-h-[60px] px-3 py-2 text-base bg-transparent placeholder:text-muted-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "rounded-lg border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-0 focus:border-orange-500 dark:focus:border-orange-500 focus:border-2",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
