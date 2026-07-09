// components/ui/input.jsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "w-full h-9 px-3 py-2 text-base bg-transparent placeholder:text-muted-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "rounded-lg border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-0 focus:border-orange-500 dark:focus:border-orange-500 focus:border-2",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
