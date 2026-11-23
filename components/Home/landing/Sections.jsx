// components/Home/landing/Sections.jsx
// BB-145 — static landing sections: highlights band, overtime, pricing (no prices).
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HIGHLIGHTS, PLANS } from "./content";

export const sectionHeading =
  "font-display text-[clamp(30px,3.2vw,40px)] font-bold leading-[1.1] tracking-[-0.02em]";
export const eyebrow = "mb-3 text-sm font-bold";
const ghostButton =
  "inline-flex h-12 items-center justify-center rounded-brand border-2 border-brand-ink px-[22px] text-[15px] font-bold text-brand-ink transition-colors hover:bg-brand-ink hover:text-white";
const solidButton =
  "inline-flex h-12 items-center justify-center rounded-brand bg-brand px-[22px] text-[15px] font-bold text-black transition-colors hover:bg-brand-hover";

// Caption under product screenshots: what it shows, then a quiet italic note that the data is made up
export function ScreenCaption({ children }) {
  return (
    <p className="mt-2.5 text-xs text-neutral-600">
      {children}
      <span aria-hidden="true" className="mx-1.5 text-neutral-300">
        |
      </span>
      <em className="text-neutral-500">Demo data</em>
    </p>
  );
}

export function HighlightsBand() {
  return (
    <section aria-label="What BizBuddy does" className="bg-black text-white">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-7 px-4 py-11 sm:px-6">
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="border-l-[3px] border-brand pl-[18px]">
            <div className="font-display text-[22px] font-bold leading-[1.2]">{h.title}</div>
            <div className="mt-1.5 text-sm text-neutral-400">{h.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OvertimeSection() {
  return (
    <section aria-labelledby="ot-h" className="bg-brand-band">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-16 gap-y-10 px-4 py-16 sm:px-6 sm:py-20">
        <div className="min-w-0 flex-[1_1_560px]">
          <div className="overflow-hidden rounded-brand bg-brand-stage px-4 pt-4 sm:px-6 sm:pt-6">
            <img
              src="/landing/punchlogs-dark.png"
              alt="Punch logs in dark mode, with the daily overtime setting and overtime per session"
              width={846}
              height={862}
              loading="lazy"
              className="block h-auto w-full rounded-t-md shadow-2xl"
            />
          </div>
          <ScreenCaption>Punch logs in dark mode</ScreenCaption>
        </div>
        <div className="min-w-0 max-w-[500px] flex-[1_1_360px]">
          <div className={eyebrow}>Overtime</div>
          <h2 id="ot-h" className={cn(sectionHeading, "mb-4")}>
            Your overtime rules, applied to every punch.
          </h2>
          <p className="mb-6 text-[17px] leading-[1.7] text-neutral-700">
            Set overtime by the day, the week or the cutoff. Punch logs show each session’s hours and the overtime it
            earned, with anything still waiting for review clearly marked.
          </p>
          <Link href="#pricing" className={ghostButton}>
            See plans
          </Link>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan, featured }) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-brand p-7",
        featured ? "border-2 border-brand" : "border border-neutral-200"
      )}
    >
      {plan.badge && (
        <span className="absolute -top-[13px] left-[26px] rounded-brand bg-brand px-2.5 py-0.5 text-xs font-bold text-black">
          {plan.badge}
        </span>
      )}
      <div className="text-sm font-bold">{plan.name}</div>
      <div className="font-display text-[28px] font-bold leading-[1.15]">{plan.headline}</div>
      <p className="text-neutral-700">{plan.blurb}</p>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 flex-none text-brand-link" strokeWidth={3} aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <Link href="#contact" className={cn("mt-auto", featured ? solidButton : ghostButton)}>
        Get a quote
      </Link>
    </div>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pr-h" className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-[88px]">
        <div className="mb-8 max-w-[640px]">
          <div className={eyebrow}>Pricing</div>
          <h2 id="pr-h" className={cn(sectionHeading, "mb-3")}>
            Plans that grow with your team.
          </h2>
          <p className="text-[17px] text-neutral-700">
            Download BizBuddy free, then pick the plan that fits how your team works. Pricing depends on your team size,
            so we’ll quote it for you.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {PLANS.map((p) => (
            <PlanCard key={p.name} plan={p} featured={!!p.badge} />
          ))}
          <div className="flex flex-col gap-4 rounded-brand bg-brand-band p-7">
            <div className="text-sm font-bold">Larger teams</div>
            <div className="font-display text-[28px] font-bold leading-[1.15]">Talk to us about your setup.</div>
            <p className="text-neutral-700">
              Several departments, fixed-hours staff or custom overtime rules? We’ll help you set it up.
            </p>
            <Link href="#contact" className={cn("mt-auto", ghostButton)}>
              Contact us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
