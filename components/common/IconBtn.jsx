// components/common/IconBtn.jsx
"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent } from "@/components/ui/tooltip";

export default function IconBtn({ icon: Icon, tooltip, spinning = false, className = "", ...rest }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className={` ${className}`} {...rest}>
            <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
