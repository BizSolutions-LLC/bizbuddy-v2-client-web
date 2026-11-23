// components/Home/PrivacyPolicy.jsx
// BB-145 — privacy policy. Layout: components/Home/legal/LegalDocument.jsx. Draft: Carlo reviews the wording.
// Kept general on purpose (Carlo, 2026-11-23): name the categories of information, the purposes and
// who it's shared with, but not how features work. Don't name payment or other providers, don't
// mention face capture, and don't describe security measures or detection methods.
import Link from "next/link";
import LegalDocument, { CompanyAddress, LegalList, legalLink } from "@/components/Home/legal/LegalDocument";

const LAST_UPDATED = "November 23, 2026";

const CATEGORIES = [
  ["Account and profile", "Your name, contact details, login details, and employment details your employer records."],
  ["Work records", "Time and attendance, schedules, leave, overtime and payroll information."],
  ["Location", "Location information when you use location-based features your employer turns on."],
  ["Device and usage", "Information such as device identifiers, IP address, browser type and sign-in activity."],
  ["Communications", "Messages you send us."],
];

const SECTIONS = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          BizBuddy (mybizbuddy.co) is a time keeping, leave and payroll service provided by BizSolutions LLC (“we”,
          “our”, “us”).
        </p>
        <p>
          If you use BizBuddy through your employer, your employer decides how BizBuddy is set up and how your work
          records are used, and we handle that information on their behalf.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: (
      <LegalList
        items={CATEGORIES.map(([cat, ex]) => (
          <>
            <strong className="text-brand-ink">{cat}:</strong> {ex}
          </>
        ))}
      />
    ),
  },
  {
    id: "how-we-use",
    title: "How we use information",
    body: (
      <>
        <p>We use the information we collect to:</p>
        <LegalList
          items={[
            "Provide BizBuddy, including time keeping, schedules, leave and payroll.",
            "Keep accounts and records secure.",
            "Send service messages and provide support.",
            "Improve BizBuddy.",
            "Meet our legal obligations.",
          ]}
        />
      </>
    ),
  },
  {
    id: "sharing",
    title: "How we share information",
    body: (
      <>
        <p>We do not sell your personal information or share it for advertising. We share it only with:</p>
        <LegalList
          items={[
            "Your employer.",
            "Service providers that help us run BizBuddy, who may use it only for that purpose.",
            "Authorities, when the law requires it.",
          ]}
        />
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: <p>We use reasonable measures to protect the information we hold.</p>,
  },
  {
    id: "retention",
    title: "Retention",
    body: (
      <p>
        We keep information for as long as it’s needed to provide BizBuddy, for your employer’s records, or as the
        law requires. After that, we delete it or make it anonymous.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and choices",
    body: (
      <>
        <LegalList
          items={[
            "You can ask to see, correct or delete your personal information. For work records, your employer may need to approve the change.",
            <>
              You can delete your account on the{" "}
              <Link href="/account-deletion" className={legalLink}>
                account deletion page
              </Link>
              .
            </>,
            "You can turn off location access in your device settings. Some features may not work without it.",
          ]}
        />
        <p>
          Depending on where you live, such as California, you may have additional rights. To use any of them,
          contact us as described below.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use cookies and similar browser storage to keep you signed in and remember your preferences. We don’t use
        them for advertising.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>BizBuddy isn’t meant for anyone under 16, and we don’t knowingly collect their information.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>When we change this policy, we’ll update the “Last updated” date at the top of this page.</p>,
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        <p>For questions about this policy or to use your rights, contact:</p>
        <CompanyAddress />
      </>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated={LAST_UPDATED} sections={SECTIONS} />
  );
}
