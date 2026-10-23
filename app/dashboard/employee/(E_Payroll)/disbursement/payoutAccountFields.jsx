"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const MOOV_BUSINESS_TYPES = [
  { value: "soleProprietorship", label: "Sole proprietorship" },
  { value: "llc", label: "LLC" },
  { value: "partnership", label: "Partnership" },
  { value: "privateCorporation", label: "Private corporation" },
  { value: "publicCorporation", label: "Public corporation" },
  { value: "unincorporatedAssociation", label: "Unincorporated association" },
  { value: "trust", label: "Trust" },
  { value: "incorporatedNonProfit", label: "Incorporated nonprofit" },
  { value: "unincorporatedNonProfit", label: "Unincorporated nonprofit" },
  { value: "governmentEntity", label: "Government entity" },
];

export const EMPTY_BANK = {
  holderName: "",
  holderType: "business",
  bankAccountType: "checking",
  routingNumber: "",
  accountNumber: "",
};

export function bankPayload(bank) {
  return {
    holderName: bank.holderName.trim(),
    holderType: bank.holderType,
    bankAccountType: bank.bankAccountType,
    routingNumber: bank.routingNumber.trim(),
    accountNumber: bank.accountNumber.trim(),
  };
}

export function bankIsComplete(bank) {
  return Boolean(
    bank.holderName.trim() &&
      bank.routingNumber.trim() &&
      bank.accountNumber.trim() &&
      bank.holderType &&
      bank.bankAccountType
  );
}

export function BankFields({ bank, onChange, holderTypeLocked }) {
  const set = (key, value) => onChange({ ...bank, [key]: value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="holder-name">Account holder name</Label>
        <Input id="holder-name" value={bank.holderName} onChange={(event) => set("holderName", event.target.value)} autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label>Holder type</Label>
        <Select value={bank.holderType} onValueChange={(value) => set("holderType", value)} disabled={holderTypeLocked}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Account type</Label>
        <Select value={bank.bankAccountType} onValueChange={(value) => set("bankAccountType", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="routing-number">Routing number</Label>
        <Input id="routing-number" value={bank.routingNumber} onChange={(event) => set("routingNumber", event.target.value)} inputMode="numeric" autoComplete="off" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="account-number">Account number</Label>
        <Input id="account-number" value={bank.accountNumber} onChange={(event) => set("accountNumber", event.target.value)} inputMode="numeric" autoComplete="off" />
      </div>
    </div>
  );
}
