"use client";

import { useCallback, useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchMyPayoutAccount, saveMyPayoutAccount } from "@/lib/disbursementApi";
import { DisbursementFrame, StatusBadge, useDisbursementSession } from "./disbursementUi";
import { BankFields, bankIsComplete, bankPayload, EMPTY_BANK } from "./payoutAccountFields";

export default function MyPayoutAccount() {
  const session = useDisbursementSession({ allowEmployee: true });
  const { token, apiUrl, ready, role } = session;
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [bank, setBank] = useState({ ...EMPTY_BANK, holderType: "individual" });

  const loadAccount = useCallback(async () => {
    if (!token || !ready) return;
    if (role !== "employee") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMyPayoutAccount(apiUrl, token);
      setAccount(data);
    } catch (error) {
      toast.error(error.message || "Failed to load your payout account");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, ready, role]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    const user = session.profile?.user;
    const profile = user?.profile || session.profile?.profile;
    if (!firstName && profile?.firstName) setFirstName(profile.firstName);
    if (!lastName && profile?.lastName) setLastName(profile.lastName);
    if (!email && user?.email) setEmail(user.email);
  }, [session.profile, firstName, lastName, email]);

  const bankLinked = Boolean(account?.bankLinked);
  const provider = account?.provider;

  const handleSave = async () => {
    if (!bankLinked && !bankIsComplete(bank)) {
      toast.error("Enter the account holder, routing number, and account number.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMyPayoutAccount(apiUrl, token, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        bank: bankLinked ? undefined : bankPayload({ ...bank, holderType: "individual" }),
      });
      setBank({ ...EMPTY_BANK, holderType: "individual" });
      setAccount(saved);
      toast.success(saved?.status === "verified" ? "Payout account verified." : "Payout account saved.");
    } catch (error) {
      toast.error(error.message || "Failed to save your payout account");
    } finally {
      setSaving(false);
    }
  };

  let body = null;
  if (!ready || loading) {
    body = (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading payout account…
      </div>
    );
  } else if (role && role !== "employee") {
    body = <p className="text-sm text-muted-foreground">Company funding is set up from Disbursement. This page is for employees receiving pay.</p>;
  } else if (account?.configured === false) {
    body = <p className="text-sm text-muted-foreground">Payout accounts are not available yet.</p>;
  } else if (!provider) {
    body = <p className="text-sm text-muted-foreground">Your company has not linked a funding account yet.</p>;
  } else {
    body = (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            Your payout account
            {account?.status ? (
              <StatusBadge
                status={account.status === "verified" ? "PAID" : "READY_FOR_REVIEW"}
                labels={{ PAID: "Verified", READY_FOR_REVIEW: account.status }}
              />
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pay is sent with {provider === "moov" ? "Moov" : "Stripe"}. This account only receives payroll.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="my-first-name">First name</Label>
              <Input id="my-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="my-last-name">Last name</Label>
              <Input id="my-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="my-email">Email</Label>
              <Input id="my-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
          <Button
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim() || !email.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save payout account
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title="Payout account"
        description="Connect the bank account that should receive your pay."
      >
        {body}
      </DisbursementFrame>
    </>
  );
}
