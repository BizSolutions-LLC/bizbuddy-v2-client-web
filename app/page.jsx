// app/page.jsx
// BB-145 — landing page redesign. Light only: every section sets its own colors.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import HeroRail from "@/components/Home/landing/HeroRail";
import { HighlightsBand, OvertimeSection, PricingSection } from "@/components/Home/landing/Sections";
import DownloadSection from "@/components/Home/landing/DownloadSection";
import FAQSection from "@/components/Home/landing/FAQSection";
import ContactSection from "@/components/Home/landing/ContactSection";
import Footer from "@/components/Partial/Footer";

export default function Home() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  return (
    <div className="w-full bg-white font-landing text-base leading-[1.55] text-brand-ink">
      <HeroRail />
      <HighlightsBand />
      <OvertimeSection />
      <PricingSection />
      <DownloadSection />
      <FAQSection />
      <ContactSection />
      <Footer flush />
    </div>
  );
}
