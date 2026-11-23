// app/(home)/terms/page.jsx
// BB-145 — Terms of Service in the new legal-document style.
import Terms from "@/components/Home/Terms";
import Footer from "@/components/Partial/Footer";

export default function TermsPage() {
  return (
    <div className="w-full bg-white">
      <Terms />
      <Footer flush />
    </div>
  );
}
