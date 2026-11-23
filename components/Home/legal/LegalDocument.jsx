// components/Home/legal/LegalDocument.jsx
// BB-145 — shared layout for legal pages (Privacy Policy, Terms): grey title band with "Last updated",
// "On this page" sidebar (sticky on desktop), large numbered sections. Carlo chose this over a
// formal document style (2026-11-23).
import { CONTACT } from "@/components/Home/landing/content";

export const legalLink = "text-brand-link underline hover:text-brand-link-hover";

export function LegalList({ items }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-neutral-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function CompanyAddress() {
  return (
    <address className="flex flex-col gap-1 not-italic">
      <span className="font-semibold text-brand-ink">BizSolutions LLC</span>
      <span>1900 Camden Avenue, Suite 101</span>
      <span>San Jose, CA 95124, USA</span>
      <span className="mt-2">
        Email:{" "}
        <a href={`mailto:${CONTACT.email}`} className={legalLink}>
          {CONTACT.email}
        </a>
      </span>
      <span>
        Phone:{" "}
        <a href={CONTACT.phoneHref} className={legalLink}>
          {CONTACT.phone}
        </a>
      </span>
    </address>
  );
}

export default function LegalDocument({ title, lastUpdated, sections }) {
  return (
    <section aria-labelledby="legal-h" className="bg-white font-landing text-brand-ink">
      <div className="bg-brand-band">
        <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-3 text-sm font-bold">Legal</div>
          <h1
            id="legal-h"
            className="font-display text-[clamp(34px,4.2vw,48px)] font-bold leading-[1.08] tracking-[-0.02em]"
          >
            {title}
          </h1>
          <p className="mt-3 text-[15px] text-neutral-600">Last updated {lastUpdated}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:flex-row lg:gap-16">
        <nav aria-label="On this page" className="lg:w-64 lg:flex-none">
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 text-sm font-bold">On this page</div>
            <ol className="flex flex-col gap-2 border-l-2 border-neutral-200 pl-4 text-[15px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-neutral-600 transition-colors hover:text-brand-link">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="flex min-w-0 max-w-[72ch] flex-col gap-12 text-base leading-[1.7] text-neutral-700">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2
                id={`${s.id}-h`}
                className="mb-4 font-display text-[26px] font-bold leading-tight tracking-[-0.01em] text-brand-ink"
              >
                <span className="mr-2 text-neutral-400">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="flex flex-col gap-5">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
