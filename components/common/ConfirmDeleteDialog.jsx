// components/common/ConfirmDeleteDialog.jsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ConfirmDeleteDialog({
  open,
  setOpen,
  title = "Delete item",
  description = "This action cannot be undone.",
  loading = false,
  onConfirm,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md border-2 border-red-400">
        <div className="h-1 w-full bg-red-500 -mt-4 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {children ?? <p className="text-sm text-muted-foreground">{description}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="text-red-600 hover:bg-red-500/10"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
