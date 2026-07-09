// components/common/FormDialog.jsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export default function FormDialog({
  open,
  setOpen,
  icon: Icon,
  title,
  subtitle,
  loading = false,
  onSubmit,
  children,
  primaryLabel = "Save",
  loadingLabel = "Saving…",
  primaryDisabled = false,
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-2 max-w-lg">
        <div className="h-1 w-full bg-orange-500 -mt-4 mb-4" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && (
              <span className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                <Icon className="h-5 w-5" />
              </span>
            )}
            {title}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-2">{children}</ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={loading || primaryDisabled} 
            className="bg-orange-500 text-white hover:bg-orange-600"
          >
            {loading ? loadingLabel : primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}