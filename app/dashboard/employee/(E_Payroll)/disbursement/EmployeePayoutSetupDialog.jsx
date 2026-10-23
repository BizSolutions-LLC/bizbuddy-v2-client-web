"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchEmployeePayoutAccount } from "@/lib/disbursementApi";
import { AutomaticTransferNotice } from "./disbursementUi";
import { BankFields, bankIsComplete, EMPTY_BANK } from "./payoutAccountFields";

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export default function EmployeePayoutSetupDialog({
  open,
  onOpenChange,
  recipient,
  apiUrl,
  token,
}) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [automaticNoticeOpen, setAutomaticNoticeOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [bank, setBank] = useState({ ...EMPTY_BANK, holderType: "individual" });

  useEffect(() => {
    if (!open || !recipient?.employeeId || !token) return undefined;
    const names = splitName(recipient.employeeName);
    setFirstName(names.firstName);
    setLastName(names.lastName);
    setEmail(recipient.email || "");
    setBank({ ...EMPTY_BANK, holderType: "individual" });
    let cancelled = false;
    setLoading(true);
    fetchEmployeePayoutAccount(apiUrl, token, recipient.employeeId)
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch((error) => {
        if (!cancelled) {
          setAccount(null);
          toast.error(error.message || "Failed to load this payout account");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, recipient?.employeeId, recipient?.employeeName, recipient?.email, apiUrl, token]);

  const provider = account?.provider;
  const bankLinked = Boolean(account?.bankLinked);
  const providerLabel = provider === "stripe" ? "Stripe" : provider === "moov" ? "Moov" : null;

  const handleSave = () => {
    if (!bankLinked && !bankIsComplete(bank)) {
      toast.error("Enter the account holder, routing number, and account number.");
      return;
    }
    setAutomaticNoticeOpen(true);
  };

  return (
    <>
    <AutomaticTransferNotice open={automaticNoticeOpen} onOpenChange={setAutomaticNoticeOpen} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set up payout account</DialogTitle>
          <DialogDescription>
            {recipient?.employeeName || "This employee"} receives pay on the company’s funding provider.
            {providerLabel ? ` This account uses ${providerLabel}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payout account…
          </div>
        ) : account?.configured === false ? (
          <p className="text-sm text-muted-foreground">Payout accounts are not available yet.</p>
        ) : !provider ? (
          <p className="text-sm text-muted-foreground">Link a company funding account before setting up employee payouts.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="employee-payout-first">First name</Label>
                <Input id="employee-payout-first" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employee-payout-last">Last name</Label>
                <Input id="employee-payout-last" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="employee-payout-email">Email</Label>
                <Input id="employee-payout-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </div>
            {bankLinked ? (
              <p className="text-sm text-muted-foreground">A bank account is already linked. Saving again does not replace it.</p>
            ) : (
              <>
                <BankFields bank={bank} onChange={setBank} holderTypeLocked />
                <p className="text-xs text-muted-foreground">Bank numbers are sent once and are not kept in this form after a successful save.</p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !provider || !firstName.trim() || !lastName.trim() || !email.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Save payout account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
