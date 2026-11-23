// components/Home/landing/ContactSection.jsx
// BB-145 — contact details + message form. Sends to the server's public contact endpoint
// (docs/server-request-BB-145-contact-form.md). Spam protection: hidden honeypot field + time-to-submit,
// both checked on the server along with rate limits. If sending fails, the visitor gets an
// "email us directly" link that pre-fills their email app.
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTACT } from "./content";
import { eyebrow, sectionHeading } from "./Sections";

const EMPTY = { name: "", email: "", phone: "", company: "", teamSize: "", message: "" };
const LIMITS = { name: 100, email: 254, phone: 30, company: 150, teamSize: 20, message: 5000 };

// Same rule as the server: digits, spaces, + ( ) - . and an optional extension (x12, ext. 12); 7–15 digits
const PHONE_EXT = /\s*(?:x|ext\.?)\s*\d{1,6}$/i;
function isValidPhone(value) {
  const main = value.replace(PHONE_EXT, "");
  if (!/^[0-9+().\s-]+$/.test(main)) return false;
  const digits = main.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

const field =
  "h-12 w-full rounded-brand border bg-white px-3 text-base text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const label = "flex flex-col gap-1.5 text-sm font-semibold";

function mailtoHref(form) {
  const subject = `Website inquiry${form.company ? `: ${form.company}` : ""}`;
  const body = [
    `Name: ${form.name}`,
    `Work email: ${form.email}`,
    `Phone: ${form.phone || "-"}`,
    `Company: ${form.company || "-"}`,
    `Team size: ${form.teamSize || "-"}`,
    "",
    form.message,
  ].join("\n");
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.phone.trim() && !isValidPhone(form.phone.trim())) errors.phone = "Enter a valid phone number.";
  if (form.message.trim().length < 10) errors.message = "Tell us a little more (at least 10 characters).";
  return errors;
}

function ContactCard({ href, icon: Icon, title, value }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3.5 rounded-brand border border-neutral-200 p-4 text-brand-ink transition-colors hover:border-brand"
    >
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-brand bg-brand text-black">
        <Icon className="size-[18px]" />
      </span>
      <span>
        <span className="block text-[13px] text-neutral-600">{title}</span>
        <strong>{value}</strong>
      </span>
    </a>
  );
}

function Field({ id, title, error, optional, children }) {
  return (
    <div className={label}>
      <label htmlFor={id}>
        {title}
        {optional && <span className="ml-1 font-normal text-neutral-500">(optional)</span>}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} className="text-[13px] font-normal text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

export default function ContactSection() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent | failed
  const [failMessage, setFailMessage] = useState("");
  const startedAt = useRef(Date.now());
  const honeypot = useRef(null);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const inputProps = (key) => ({
    id: `contact-${key}`,
    value: form[key],
    onChange: set(key),
    maxLength: LIMITS[key],
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `contact-${key}-error` : undefined,
    className: cn(field, errors[key] ? "border-red-600" : "border-neutral-300"),
  });

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus("sending");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          company: form.company.trim(),
          teamSize: form.teamSize.trim(),
          message: form.message.trim(),
          website: honeypot.current?.value || "",
          startedAt: startedAt.current,
          // Measured in the browser so a wrong device clock can't make a real message look "too fast"
          elapsedMs: Date.now() - startedAt.current,
        }),
      });

      if (res.ok) {
        setStatus("sent");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data.fields) {
        setErrors(data.fields);
        setStatus("idle");
        return;
      }
      setFailMessage(
        res.status === 429
          ? "You’ve sent several messages in a short time. Please try again later, or email us directly."
          : "We couldn’t send your message right now."
      );
      setStatus("failed");
    } catch {
      setFailMessage("We couldn’t send your message right now.");
      setStatus("failed");
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setStatus("idle");
    startedAt.current = Date.now();
  };

  return (
    <section id="contact" aria-labelledby="ct-h" className="scroll-mt-16 bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-x-16 gap-y-10 px-4 py-16 sm:px-6 sm:py-[88px]">
        <div className="min-w-0 max-w-[440px] flex-[1_1_320px]">
          <div className={eyebrow}>Contact us</div>
          <h2 id="ct-h" className={cn(sectionHeading, "mb-3.5")}>
            Get in touch.
          </h2>
          <p className="mb-7 text-[17px] text-neutral-700">
            Questions about plans, setup or your account? Send a message or reach us directly.
          </p>
          <div className="flex flex-col gap-3">
            <ContactCard href={`mailto:${CONTACT.email}`} icon={Mail} title="Email" value={CONTACT.email} />
            <ContactCard href={CONTACT.phoneHref} icon={Phone} title="Phone" value={CONTACT.phone} />
          </div>
        </div>

        <div className="min-w-0 flex-[999_1_520px] rounded-brand bg-brand-band p-5 sm:p-7">
          {status === "sent" ? (
            <div role="status" className="flex flex-col items-start gap-3 py-6">
              <CheckCircle2 className="size-8 text-green-700" aria-hidden="true" />
              <h3 className="font-display text-2xl font-bold">Thanks, your message is on its way.</h3>
              <p className="text-neutral-700">
                We’ll reply to <strong className="text-brand-ink">{form.email.trim()}</strong> as soon as we can.
              </p>
              <button
                type="button"
                onClick={reset}
                className="mt-2 border-b-2 border-brand pb-0.5 text-[15px] font-semibold text-brand-ink"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate aria-label="Send a message" className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2">
              {/* Layout: Name (full) · Work email | Phone · Company | Team size · Message (full) */}
              <div className="min-[600px]:col-span-2">
                <Field id="contact-name" title="Name" error={errors.name}>
                  <input autoComplete="name" {...inputProps("name")} />
                </Field>
              </div>
              <Field id="contact-email" title="Work email" error={errors.email}>
                <input type="email" autoComplete="email" {...inputProps("email")} />
              </Field>
              <Field id="contact-phone" title="Phone" optional error={errors.phone}>
                <input type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. (555) 123-4567" {...inputProps("phone")} />
              </Field>
              <Field id="contact-company" title="Company" optional error={errors.company}>
                <input autoComplete="organization" {...inputProps("company")} />
              </Field>
              <Field id="contact-teamSize" title="Team size" optional error={errors.teamSize}>
                <input inputMode="numeric" placeholder="e.g. 25" {...inputProps("teamSize")} />
              </Field>
              <div className="min-[600px]:col-span-2">
                <Field id="contact-message" title="Message" error={errors.message}>
                  <textarea rows={5} {...inputProps("message")} className={cn(inputProps("message").className, "h-auto resize-y py-3")} />
                </Field>
              </div>

              {/* Honeypot: hidden from people and screen readers; bots that fill it are dropped by the server */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="contact-website">Website</label>
                <input ref={honeypot} id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>

              {status === "failed" && (
                <div role="alert" className="rounded-brand border border-red-200 bg-white p-4 text-sm text-brand-ink min-[600px]:col-span-2">
                  {failMessage}{" "}
                  <a href={mailtoHref(form)} className="font-semibold text-brand-link underline hover:text-brand-link-hover">
                    Email us directly
                  </a>{" "}
                  and your message will be filled in for you.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 min-[600px]:col-span-2">
                <span className="text-[13px] text-neutral-600">
                  We reply by email. See our{" "}
                  <Link href="/privacy-policy" className="text-brand-link underline hover:text-brand-link-hover">
                    Privacy Policy
                  </Link>
                  .
                </span>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex h-12 items-center gap-2 rounded-brand bg-brand px-6 text-[15px] font-bold text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
                >
                  {status === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {status === "sending" ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
