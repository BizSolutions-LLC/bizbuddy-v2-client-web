// components/Partial/Footer.jsx
// BB-145 — public-site footer (landing, /faq, /contact, /pricing, /terms, /privacy-policy, auth pages).
// `flush` drops the top margin when the footer sits right under a full-width section (landing page).
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CONTACT, FOOTER_COMPANY, FOOTER_PRODUCT, SOCIALS } from "@/components/Home/landing/content";

const linkClass = "text-neutral-400 transition-colors hover:text-white";

export default function Footer({ flush = false }) {
  return (
    <footer className={cn("w-full bg-brand-footer font-landing text-sm text-neutral-400", !flush && "mt-16")}>
      <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-16 sm:px-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-9">
          <div className="flex flex-col gap-3.5">
            <img src="/landing/bizbuddy-logo.png" alt="BizBuddy" width={94} height={34} className="h-[34px] w-auto self-start" />
            <span>BizBuddy makes time management seamless and hassle-free.</span>
          </div>

          <nav aria-label="Product" className="flex flex-col gap-2.5">
            <strong className="text-[13px] text-white">Product</strong>
            {FOOTER_PRODUCT.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>

          <nav aria-label="Company" className="flex flex-col gap-2.5">
            <strong className="text-[13px] text-white">Company</strong>
            {FOOTER_COMPANY.map((l) => (
              <Link key={l.label} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-2.5">
            <strong className="text-[13px] text-white">Talk to us</strong>
            <a href={`mailto:${CONTACT.email}`} className={linkClass}>
              {CONTACT.email}
            </a>
            <a href={CONTACT.phoneHref} className={linkClass}>
              {CONTACT.phone}
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-neutral-800 pt-[22px] text-[13px]">
          <span>© {new Date().getFullYear()} BizSolutions LLC · Powered by BizSolutions LLC</span>
          <span className="flex flex-wrap gap-[18px]">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {s.label}
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
