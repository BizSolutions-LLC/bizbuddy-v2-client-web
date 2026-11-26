// components/ui/confirm-company-save.jsx
// BB-151: "Are you sure?" step before any company-wide settings save.
//
//   const { confirmSave, confirmDialog } = useConfirmCompanySave();
//   <Button onClick={() => confirmSave(save)}>Save</Button>
//   {confirmDialog}
"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const COMPANY_SAVE_MESSAGE = "This changes the setting for the whole company. Save changes?";

export function useConfirmCompanySave() {
  const [open, setOpen] = useState(false);
  const pending = useRef(null);

  // Opens the dialog; `fn` runs only if the user clicks Save.
  const confirmSave = useCallback((fn) => {
    pending.current = fn;
    setOpen(true);
  }, []);

  const onOpenChange = (next) => {
    setOpen(next);
    if (!next) pending.current = null;
  };

  const onSave = () => {
    const fn = pending.current;
    pending.current = null;
    setOpen(false);
    if (fn) fn();
  };

  const confirmDialog = (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes?</AlertDialogTitle>
          <AlertDialogDescription>{COMPANY_SAVE_MESSAGE}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSave} className="bg-orange-500 hover:bg-orange-600 text-white">Save</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmSave, confirmDialog };
}
