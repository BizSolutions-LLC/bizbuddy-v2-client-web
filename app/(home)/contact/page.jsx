// app/(home)/contact/page.jsx
// BB-145 — contact page in the new public-site style.
import ContactSection from "@/components/Home/landing/ContactSection";
import Footer from "@/components/Partial/Footer";

export default function ContactPage() {
  return (
    <div className="w-full bg-white font-landing text-brand-ink">
      <ContactSection />
      <Footer flush />
    </div>
  );
}
