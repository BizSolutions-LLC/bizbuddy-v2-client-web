// components/Home/landing/FAQSection.jsx
// BB-145 — FAQ accordion. Landing shows the first LANDING_FAQ_COUNT with "All FAQs"; /faq shows all.
"use client";

import Link from "next/link";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Minus, Plus } from "lucide-react";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { CONTACT, FAQS, LANDING_FAQ_COUNT } from "./content";
import { eyebrow, sectionHeading } from "./Sections";

export default function FAQSection({ full = false }) {
  const items = full ? FAQS : FAQS.slice(0, LANDING_FAQ_COUNT);

  return (
    <section id="faq" aria-labelledby="faq-h" className="scroll-mt-16 bg-brand-band">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-x-16 gap-y-8 px-4 py-16 sm:px-6 sm:py-[88px]">
        <div className="min-w-0 max-w-[400px] flex-[1_1_300px]">
          <div className={eyebrow}>FAQ</div>
          <h2 id="faq-h" className={cn(sectionHeading, "mb-3.5")}>
            Questions, answered.
          </h2>
          <p className="mb-5 text-[17px] text-neutral-700">
            Can’t find what you need? Our team replies by email at{" "}
            <a href={`mailto:${CONTACT.email}`} className="text-brand-link hover:text-brand-link-hover">
              {CONTACT.email}
            </a>{" "}
            and by phone.
          </p>
          {!full && (
            <Link href="/faq" className="border-b-2 border-brand pb-0.5 text-[15px] font-bold text-brand-ink">
              All FAQs
            </Link>
          )}
        </div>

        <Accordion
          type="single"
          collapsible
          defaultValue="faq-0"
          className="min-w-0 flex-[999_1_560px] border-t-2 border-brand-ink"
        >
          {items.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`} className="border-b border-neutral-300">
              <AccordionPrimitive.Header>
                <AccordionPrimitive.Trigger className="group flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="flex size-8 flex-none items-center justify-center rounded-brand border border-neutral-300 bg-white group-data-[state=open]:border-brand group-data-[state=open]:bg-brand group-data-[state=open]:text-black"
                  >
                    <Plus className="size-4 group-data-[state=open]:hidden" />
                    <Minus className="hidden size-4 group-data-[state=open]:block" />
                  </span>
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="flex max-w-[64ch] flex-col gap-3 pb-5 text-base leading-[1.7] text-neutral-700">
                  {f.a.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </AccordionPrimitive.Content>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
