// components/system-admin/bbuddy/AddCompanySheet.jsx
//
// BB-107: "Add company" drawer on the Companies tab. Creates the company and
// its owner, optionally its B. Buddy and a support staff member, through
// POST /provision-company. Name / emails / EIN are checked for clashes as each
// field is left (/provision-company/check); the server checks again on submit.

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { TIMEZONES, DEFAULT_TIMEZONE } from "@/lib/timezones";
import { bbuddyFetch } from "./api";

const API = "/api/system-admin";

// Select can't use "" as a value
const NONE = "none";

const EMPTY_FORM = {
  companyName: "",
  timeZone: DEFAULT_TIMEZONE,
  ein: "",
  dba: "",
  businessEmail: "",
  phoneNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  currency: "",
  ownerFirstName: "",
  ownerLastName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerPhone: "",
  subscriptionPlanId: NONE,
  setupBBuddy: true,
  supportAgentId: NONE,
  sendWelcomeEmail: true,
};

// Checked for clashes with existing companies / accounts
const CHECK_FIELDS = ["companyName", "businessEmail", "ein", "ownerEmail"];
// Under "More details"; opened when one of them has an error
const MORE_FIELDS = ["ein", "dba", "businessEmail", "phoneNumber", "addressLine1", "addressLine2", "city", "state", "postalCode", "country", "currency"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// `company` is the current shape; `companies` (0 or 1 entries) is the old one
const companyOf = (agent) => agent?.company || agent?.companies?.[0] || null;

// 12 characters from the browser's secure RNG, no look-alike characters
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password;
  do {
    const bytes = crypto.getRandomValues(new Uint32Array(12));
    password = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  } while (!/\d/.test(password) || !/[a-z]/.test(password) || !/[A-Z]/.test(password));
  return password;
}

function planLabel(plan) {
  const range = plan.rangeOfUsers ? (/user/i.test(plan.rangeOfUsers) ? plan.rangeOfUsers : `${plan.rangeOfUsers} users`) : null;
  const price = plan.price != null ? `$${Number(plan.price).toLocaleString()}` : null;
  return [plan.name, range, price].filter(Boolean).join(" · ");
}

function validate(form) {
  const errors = {};
  if (!form.companyName.trim()) errors.companyName = "Enter the company name.";
  if (!form.ownerFirstName.trim()) errors.ownerFirstName = "Enter the owner's first name.";
  if (!form.ownerLastName.trim()) errors.ownerLastName = "Enter the owner's last name.";
  if (!form.ownerEmail.trim()) errors.ownerEmail = "Enter the owner's email.";
  else if (!EMAIL_RE.test(form.ownerEmail.trim())) errors.ownerEmail = "Enter a valid email.";
  if (form.businessEmail.trim() && !EMAIL_RE.test(form.businessEmail.trim())) errors.businessEmail = "Enter a valid email.";
  if (form.ownerPassword.length < 8) errors.ownerPassword = "At least 8 characters.";
  return errors;
}

function Field({ id, label, required, error, children, note }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {!required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {note}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-4 border-t pt-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function AddCompanySheet({ open, onOpenChange, agents = [], onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [ownerOther, setOwnerOther] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const checkId = useRef(0);

  // Plans load once, the first time the drawer opens
  useEffect(() => {
    if (!open || plans) return;
    systemAdminFetch(`${API}/subscription-plans`)
      .then((json) => setPlans(json.data || []))
      .catch((err) => setPlansError(err.message));
  }, [open, plans]);

  const reset = () => {
    checkId.current += 1;
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError("");
    setOwnerOther([]);
    setShowMore(false);
    setShowPassword(false);
    setResult(null);
  };

  // Nothing is kept once the drawer closes (the form holds a password)
  const handleOpenChange = (next) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const setField = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
    setFormError("");
  };

  // On leaving a checked field: ask the server about all four current values
  const runCheck = async () => {
    const body = Object.fromEntries(CHECK_FIELDS.map((k) => [k, form[k].trim()]).filter(([, v]) => v));
    const id = ++checkId.current;
    if (Object.keys(body).length === 0) {
      setOwnerOther([]);
      return;
    }
    try {
      const json = await systemAdminFetch(`${API}/provision-company/check`, { method: "POST", body });
      if (id !== checkId.current) return;
      const found = json.data?.errors || {};
      setErrors((p) => ({ ...p, companyName: found.companyName, businessEmail: found.businessEmail, ein: found.ein }));
      setOwnerOther(json.data?.ownerOtherCompanies || []);
    } catch {
      // Only a convenience; submit checks again
    }
  };

  const activeAgents = agents.filter((a) => !a.archivedAt && a.active);
  const pickedAgent = form.setupBBuddy ? activeAgents.find((a) => a.id === form.supportAgentId) : null;
  const pickedFrom = companyOf(pickedAgent);

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }

    const optional = (v) => v.trim() || undefined;
    const body = {
      companyName: form.companyName.trim(),
      timeZone: form.timeZone,
      ...Object.fromEntries(MORE_FIELDS.map((k) => [k, optional(form[k])])),
      ownerFirstName: form.ownerFirstName.trim(),
      ownerLastName: form.ownerLastName.trim(),
      ownerEmail: form.ownerEmail.trim(),
      ownerPassword: form.ownerPassword,
      ownerPhone: optional(form.ownerPhone),
      subscriptionPlanId: form.subscriptionPlanId === NONE ? null : form.subscriptionPlanId,
      setupBBuddy: form.setupBBuddy,
      supportAgentId: form.setupBBuddy && form.supportAgentId !== NONE ? form.supportAgentId : null,
      sendWelcomeEmail: form.sendWelcomeEmail,
    };

    setSubmitting(true);
    setFormError("");
    try {
      const json = await systemAdminFetch(`${API}/provision-company`, { method: "POST", body });
      setResult(json.data);
      onCreated?.();
    } catch (err) {
      const fieldErrors = err.status === 409 ? err.data?.errors : null;
      if (fieldErrors && Object.keys(fieldErrors).length) {
        setErrors((p) => ({ ...p, ...fieldErrors }));
        if (MORE_FIELDS.some((k) => fieldErrors[k])) setShowMore(true);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const input = (key, props = {}) => (
    <Input
      id={`add-${key}`}
      value={form[key]}
      onChange={(e) => setField(key, e.target.value)}
      onBlur={CHECK_FIELDS.includes(key) ? runCheck : undefined}
      aria-invalid={!!errors[key]}
      {...props}
    />
  );

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {result ? (
          <Success
            result={result}
            password={form.ownerPassword}
            onBBuddyCreated={() => {
              setResult((r) => ({ ...r, bbuddy: { ...r.bbuddy, created: true } }));
              onCreated?.();
            }}
            onAddAnother={reset}
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="space-y-5 p-6">
              <SheetHeader className="space-y-1.5 pr-6">
                <SheetTitle>Add company</SheetTitle>
                <SheetDescription>
                  This creates the company and its owner only. Departments, shifts, policies and employees are set up in
                  the Company panel by signing in as B. Buddy.
                </SheetDescription>
              </SheetHeader>

              {formError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <Section title="Company">
                <Field id="add-companyName" label="Name" required error={errors.companyName}>
                  {input("companyName")}
                </Field>
                <Field id="add-timeZone" label="Time zone" required>
                  <Select value={form.timeZone} onValueChange={(v) => setField("timeZone", v)}>
                    <SelectTrigger id="add-timeZone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  aria-expanded={showMore}
                  onClick={() => setShowMore((v) => !v)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
                  More details
                </button>
                {showMore && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="add-ein" label="EIN" error={errors.ein}>
                      {input("ein")}
                    </Field>
                    <Field id="add-dba" label="DBA">
                      {input("dba")}
                    </Field>
                    <Field id="add-businessEmail" label="Business email" error={errors.businessEmail}>
                      {input("businessEmail", { type: "email" })}
                    </Field>
                    <Field id="add-phoneNumber" label="Phone">
                      {input("phoneNumber", { type: "tel" })}
                    </Field>
                    <div className="sm:col-span-2">
                      <Field id="add-addressLine1" label="Address line 1">
                        {input("addressLine1")}
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field id="add-addressLine2" label="Address line 2">
                        {input("addressLine2")}
                      </Field>
                    </div>
                    <Field id="add-city" label="City">
                      {input("city")}
                    </Field>
                    <Field id="add-state" label="State">
                      {input("state")}
                    </Field>
                    <Field id="add-postalCode" label="Postal code">
                      {input("postalCode")}
                    </Field>
                    <Field id="add-country" label="Country">
                      {input("country")}
                    </Field>
                    <Field id="add-currency" label="Currency">
                      {input("currency")}
                    </Field>
                  </div>
                )}
              </Section>

              <Section title="Owner">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="add-ownerFirstName" label="First name" required error={errors.ownerFirstName}>
                    {input("ownerFirstName")}
                  </Field>
                  <Field id="add-ownerLastName" label="Last name" required error={errors.ownerLastName}>
                    {input("ownerLastName")}
                  </Field>
                </div>
                <Field
                  id="add-ownerEmail"
                  label="Email"
                  required
                  error={errors.ownerEmail}
                  note={
                    ownerOther.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        This email already has accounts in:{" "}
                        {ownerOther.map((c) => `${c.companyName} (${c.role}, ${c.status})`).join(", ")}. A separate
                        account will be created for this company.
                      </p>
                    )
                  }
                >
                  {input("ownerEmail", { type: "email" })}
                </Field>
                <Field id="add-ownerPassword" label="Password" required error={errors.ownerPassword}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {input("ownerPassword", {
                        type: showPassword ? "text" : "password",
                        autoComplete: "new-password",
                        className: "pr-10 font-mono",
                      })}
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setField("ownerPassword", generatePassword());
                        setShowPassword(true);
                      }}
                    >
                      Generate
                    </Button>
                  </div>
                  {!errors.ownerPassword && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
                </Field>
                <Field id="add-ownerPhone" label="Phone">
                  {input("ownerPhone", { type: "tel" })}
                </Field>
              </Section>

              <Section title="Plan">
                <Field id="add-plan" label="Subscription plan" error={plansError}>
                  <Select value={form.subscriptionPlanId} onValueChange={(v) => setField("subscriptionPlanId", v)}>
                    <SelectTrigger id="add-plan" disabled={!plans}>
                      <SelectValue placeholder={plans ? "No plan" : "Loading plans…"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No plan</SelectItem>
                      {(plans || []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {planLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </Section>

              <Section title="B. Buddy">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-setupBBuddy"
                    checked={form.setupBBuddy}
                    onCheckedChange={(v) => setField("setupBBuddy", v === true)}
                  />
                  <Label htmlFor="add-setupBBuddy" className="font-normal">
                    Set up B. Buddy for this company
                  </Label>
                </div>
                <Field
                  id="add-supportAgent"
                  label="Assign support staff"
                  note={
                    pickedFrom && (
                      <p className="text-xs text-amber-700">
                        {pickedAgent.code} will move from {pickedFrom.name} to this company.
                      </p>
                    )
                  }
                >
                  <Select
                    value={form.setupBBuddy ? form.supportAgentId : NONE}
                    onValueChange={(v) => setField("supportAgentId", v)}
                    disabled={!form.setupBBuddy}
                  >
                    <SelectTrigger id="add-supportAgent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No one yet</SelectItem>
                      {activeAgents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} · {a.name}
                          <span className="ml-2 text-xs text-muted-foreground">{companyOf(a)?.name || "No company"}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </Section>

              <Section title="Welcome email">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="add-sendWelcomeEmail"
                    className="mt-0.5"
                    checked={form.sendWelcomeEmail}
                    onCheckedChange={(v) => setField("sendWelcomeEmail", v === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="add-sendWelcomeEmail" className="font-normal">
                      Send welcome email to the owner
                    </Label>
                    <p className="text-xs text-muted-foreground">Includes their sign-in email and password.</p>
                  </div>
                </div>
              </Section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create company"}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

const WELCOME = {
  sent: "Sent",
  failed: "Failed. Send the sign-in details yourself.",
  skipped: "Not sent",
};

function Success({ result, password, onBBuddyCreated, onAddAnother, onDone }) {
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [copied, setCopied] = useState(false);
  const { company, owner, bbuddy, supportAgent, welcomeEmail } = result;

  const setUpNow = async () => {
    setSettingUp(true);
    setSetupError("");
    try {
      await bbuddyFetch(`/accounts/${company.id}`, { method: "POST" });
      onBBuddyCreated();
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setSettingUp(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const rows = [
    {
      label: "Owner",
      value: (
        <>
          {owner.email}
          {owner.username && <span className="text-muted-foreground"> (username {owner.username})</span>}
        </>
      ),
    },
    {
      label: "B. Buddy",
      value: bbuddy?.created ? (
        <span className="flex items-center gap-1.5">
          <Check className="h-4 w-4 text-green-600" /> Set up
        </span>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Not set up</span>
            <Button size="sm" variant="outline" onClick={setUpNow} disabled={settingUp}>
              {settingUp ? "Setting up…" : "Set up now"}
            </Button>
          </div>
          {setupError && <p className="text-xs text-red-600">{setupError}</p>}
        </div>
      ),
    },
    {
      label: "Support staff",
      value: supportAgent ? (
        <>
          {supportAgent.code} {supportAgent.name}
          {supportAgent.movedFrom?.name && (
            <span className="text-muted-foreground">, moved from {supportAgent.movedFrom.name}</span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
    {
      label: "Welcome email",
      value: (
        <div className="space-y-1">
          <span className={welcomeEmail === "failed" ? "text-red-600" : welcomeEmail === "sent" ? "" : "text-muted-foreground"}>
            {WELCOME[welcomeEmail] || welcomeEmail}
          </span>
          {welcomeEmail !== "sent" && password && (
            <div>
              <Button size="sm" variant="outline" onClick={copyPassword}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy password"}
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-6">
        <SheetHeader className="space-y-1.5 pr-6">
          <SheetTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            {company.name} created
          </SheetTitle>
          <SheetDescription>Set up departments, shifts and employees by signing in as B. Buddy.</SheetDescription>
        </SheetHeader>

        <dl className="divide-y rounded-md border">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="break-words text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-4">
        <Button variant="outline" onClick={onAddAnother}>
          Add another
        </Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
