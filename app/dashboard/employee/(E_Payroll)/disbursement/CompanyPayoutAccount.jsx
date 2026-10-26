"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCompanyPayoutAccount,
  saveCompanyPayoutAccount,
  updateCompanyTaxService,
  verifyCompanyBank,
} from "@/lib/disbursementApi";
import { DisbursementFrame, useDisbursementSession } from "./disbursementUi";
import { BankFields, bankIsComplete, bankPayload, EMPTY_BANK, MOOV_BUSINESS_TYPES } from "./payoutAccountFields";

function FundingProviderIcon({ provider }) {
  if (provider === "stripe") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
        <path
          fill="#635BFF"
          d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0 fill-current">
      <path d="M14.2386 2H0.384826C0.173172 2 0 2.17332 0 2.38515V13.3716C0 13.6316 0.163552 13.8049 0.394447 13.8049H4.57943C4.79109 13.8049 4.96426 13.6316 4.96426 13.4197V4.75383C4.96426 4.6768 5.0316 4.6094 5.10857 4.6094H5.97443C6.05139 4.6094 6.11874 4.6768 6.11874 4.75383V13.4197C6.11874 13.6316 6.29191 13.8049 6.50356 13.8049H9.47634C9.688 13.8049 9.86117 13.6316 9.86117 13.4197V4.75383C9.86117 4.6768 9.92851 4.6094 10.0055 4.6094H10.881C10.9579 4.6094 11.0253 4.6768 11.0253 4.75383V13.4197C11.0253 13.6316 11.1984 13.8049 11.4101 13.8049H15.6143C15.826 13.8049 15.9991 13.6316 15.9991 13.4197V3.93538C16.028 2.77993 15.3257 2 14.2386 2Z" />
    </svg>
  );
}

function FundingProviderLabel({ provider }) {
  return (
    <span className="flex items-center gap-2 text-foreground">
      <FundingProviderIcon provider={provider} />
      {provider === "stripe" ? "Stripe" : "Moov"}
    </span>
  );
}

export default function CompanyPayoutAccount() {
  const router = useRouter();
  const session = useDisbursementSession();
  const { token, apiUrl, canView, canCreate, profile } = session;
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("llc");
  const [bank, setBank] = useState({ ...EMPTY_BANK, holderType: "business" });
  const [verificationCode, setVerificationCode] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [chosenProvider, setChosenProvider] = useState("moov");

  const loadAccount = useCallback(async () => {
    if (!token || !canView) return;
    setLoading(true);
    try {
      const data = await fetchCompanyPayoutAccount(apiUrl, token);
      setAccount(data);
      setTaxEnabled(Boolean(data?.taxService));
      if (data?.provider) setChosenProvider(data.provider);
    } catch (error) {
      toast.error(error.message || "Failed to load the company payout account");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, token, canView]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    const company = profile?.company;
    if (!legalName && company?.name) setLegalName(company.name);
    if (!email && (company?.email || profile?.user?.email)) setEmail(company?.email || profile.user.email);
  }, [profile, legalName, email]);

  const providerLocked = Boolean(account?.provider && account?.status);
  const provider = providerLocked ? account.provider : chosenProvider;
  const isMoov = provider === "moov";
  const bankLinked = Boolean(account?.bankLinked);
  const needsVerification = isMoov && bankLinked && account?.status && account.status !== "verified";

  const clearBank = () => setBank({ ...EMPTY_BANK, holderType: "business" });

  const handleSave = async () => {
    if (!canCreate) return;
    if (!bankLinked && !bankIsComplete(bank)) {
      toast.error("Enter the account holder, routing number, and account number.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCompanyPayoutAccount(apiUrl, token, {
        provider,
        email: email.trim(),
        legalName: legalName.trim(),
        businessType: isMoov ? businessType : undefined,
        bank: bankLinked ? undefined : bankPayload(bank),
      });
      clearBank();
      setAccount(saved);
      setTaxEnabled(Boolean(saved?.taxService));
      toast.success(saved?.status === "verified" ? "Company payout account verified." : "Company payout account saved.");
    } catch (error) {
      toast.error(error.message || "Failed to save the company payout account");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      toast.error("Enter the bank verification code.");
      return;
    }
    setSaving(true);
    try {
      const saved = await verifyCompanyBank(apiUrl, token, verificationCode.trim());
      setVerificationCode("");
      setAccount(saved);
      toast.success("Bank verification submitted.");
    } catch (error) {
      toast.error(error.message || "Failed to verify the company bank");
    } finally {
      setSaving(false);
    }
  };

  const handleTax = async (checked) => {
    const next = Boolean(checked);
    setTaxEnabled(next);
    setSaving(true);
    try {
      const saved = await updateCompanyTaxService(apiUrl, token, next);
      setAccount(saved);
      setTaxEnabled(Boolean(saved?.taxService));
    } catch (error) {
      setTaxEnabled(!next);
      toast.error(error.message || "Failed to update tax service");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toaster />
      <DisbursementFrame
        title="Company payout account"
        description="The company bank account funds payroll. Employees do not use this account to receive pay."
        actions={
          <Button variant="ghost" className="px-0 text-orange-700 hover:text-orange-800" onClick={() => router.push("/dashboard/employee/disbursement")}>
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading payout account…
          </div>
        ) : account?.configured === false ? (
          <p className="text-sm text-muted-foreground">Money movement is not enabled yet. A payment provider has not been configured.</p>
        ) : !canCreate ? (
          <p className="text-sm text-muted-foreground">Only an administrator can set up the company payout account.</p>
        ) : (
          <div className="space-y-4">
            <div className="max-w-xs space-y-1">
              <Label>Funding provider</Label>
              <Select value={provider} onValueChange={setChosenProvider} disabled={providerLocked}>
                <SelectTrigger>
                  <SelectValue>{provider ? <FundingProviderLabel provider={provider} /> : null}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moov">
                    <FundingProviderLabel provider="moov" />
                  </SelectItem>
                  <SelectItem value="stripe">
                    <FundingProviderLabel provider="stripe" />
                  </SelectItem>
                </SelectContent>
              </Select>
              {providerLocked ? (
                <p className="text-xs text-muted-foreground">This company is already linked with {provider === "moov" ? "Moov" : "Stripe"}.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {account?.status ? (
                <Badge
                  variant="outline"
                  className={
                    account.status === "verified"
                      ? "border-green-300 bg-green-100 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-green-800"
                      : "border-amber-500 bg-amber-100 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-amber-950 shadow-sm"
                  }
                >
                  {account.status}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Not set up</span>
              )}
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="legal-name">Legal name</Label>
                    <Input id="legal-name" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="company-email">Email</Label>
                    <Input id="company-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                  {isMoov && (
                    <div className="space-y-1">
                      <Label>Business type</Label>
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOOV_BUSINESS_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isMoov && (
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      Moov’s terms are accepted when this account is saved. This page does not collect a terms token.
                    </p>
                  )}
                </div>
                {bankLinked ? (
                  <p className="text-sm text-muted-foreground">A bank account is already linked. Saving again does not replace it.</p>
                ) : (
                  <>
                    <BankFields bank={bank} onChange={setBank} />
                    <p className="text-xs text-muted-foreground">Bank numbers are sent once to set up the account and are not kept in this form after a successful save.</p>
                  </>
                )}
                <Button onClick={handleSave} disabled={saving || !legalName.trim() || !email.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save payout account
                </Button>
              </CardContent>
            </Card>
            {needsVerification && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bank verification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Moov confirms the company bank with a code from two small deposits. That code is on the company bank statement. BizBuddy does not create it.
                  </p>
                  <div className="max-w-xs space-y-1">
                    <Label htmlFor="verification-code">Bank statement code</Label>
                    <Input
                      id="verification-code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      autoComplete="off"
                      placeholder="Only if Moov sent deposits"
                    />
                  </div>
                  <Button onClick={handleVerify} disabled={saving || !verificationCode.trim()} variant="outline">Submit code</Button>
                </CardContent>
              </Card>
            )}
            {isMoov && account?.status && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tax service</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Checkbox id="tax-service" checked={taxEnabled} onCheckedChange={handleTax} disabled={saving} />
                  <Label htmlFor="tax-service">Enable tax service for this company</Label>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DisbursementFrame>
    </>
  );
}
