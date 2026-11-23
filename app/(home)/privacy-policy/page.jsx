// app/(home)/privacy-policy/page.jsx
// BB-145 — privacy policy in the new public-site style.
import PrivacyPolicy from "@/components/Home/PrivacyPolicy";
import Footer from "@/components/Partial/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="w-full bg-white">
      <PrivacyPolicy />
      <Footer flush />
    </div>
  );
}
