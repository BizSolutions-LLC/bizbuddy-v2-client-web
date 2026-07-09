// components/common/DeleteBtn.jsx
"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeleteBtn({ tooltip = "Delete", ...props }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={tooltip}
      className="h-8 w-8 text-red-700 hover:bg-red-500/10
                 dark:text-red-400 dark:hover:bg-red-500/20"
      {...props}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
