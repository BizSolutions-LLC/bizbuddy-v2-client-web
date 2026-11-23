// app/(home)/faq/page.jsx
// BB-145 — full FAQ list in the new public-site style.
import FAQSection from "@/components/Home/landing/FAQSection";
import Footer from "@/components/Partial/Footer";

export default function FaqPage() {
  return (
    <div className="w-full bg-white font-landing text-brand-ink">
      <FAQSection full />
      <Footer flush />
    </div>
  );
}
