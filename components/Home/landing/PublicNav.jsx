// components/Home/landing/PublicNav.jsx
// BB-145 — header for signed-out visitors on public pages. The dashboard keeps its own header.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, UserCircle, X } from "lucide-react";
import { NAV_LINKS } from "./content";

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the phone menu after navigating
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white font-landing text-brand-ink">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-7 px-4 sm:px-6">
        <Link href="/" aria-label="BizBuddy home" className="flex flex-none items-center">
          <img src="/landing/bizbuddy-logo.png" alt="BizBuddy" width={83} height={30} className="block h-[30px] w-auto" />
        </Link>

        <nav aria-label="Main" className="hidden gap-6 text-[15px] min-[900px]:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="text-brand-ink transition-colors hover:text-brand-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="flex-1" />

        <Link
          href="/sign-in"
          className="hidden items-center gap-2 text-[15px] text-brand-ink transition-colors hover:text-brand-link min-[900px]:inline-flex"
        >
          <UserCircle className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />
          Sign in
        </Link>

        <Link
          href="/#download"
          className="inline-flex h-10 flex-none items-center whitespace-nowrap rounded-brand bg-brand px-3 text-[13px] font-bold text-black transition-colors hover:bg-brand-hover sm:px-[18px] sm:text-sm"
        >
          Download free
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex size-11 items-center justify-center rounded-brand border border-neutral-200 bg-white min-[900px]:hidden"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          id="public-mobile-nav"
          aria-label="Mobile"
          className="flex flex-col border-t border-neutral-200 bg-white px-6 pb-4 pt-2 text-[15px] min-[900px]:hidden"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-neutral-100 py-3 text-brand-ink hover:text-brand-link"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/sign-in" className="py-3 text-brand-ink hover:text-brand-link">
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}
