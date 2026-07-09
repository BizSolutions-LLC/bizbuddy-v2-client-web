// components/ui/confirmation-modal.jsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";

export function ConfirmationModal({ isOpen, onClose, onConfirm, title, description }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            No
          </Button>
          <Button onClick={onConfirm} className="bg-gradient-to-r from-orange-500 to-orange-600 font-semibold text-sm rounded-xl">
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
