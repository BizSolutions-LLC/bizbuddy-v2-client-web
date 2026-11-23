// components/Home/Terms.jsx
// BB-145 — Terms of Service. Layout: components/Home/legal/LegalDocument.jsx. Draft: Carlo reviews the wording.
// Corrected against the app (2026-11-23): there is a Free plan (plus Basic and Pro), paid plans are monthly,
// company accounts are deleted from Settings. Same public-copy rules as the Privacy Policy: no provider names,
// no internal or security details.
import Link from "next/link";
import LegalDocument, { CompanyAddress, LegalList, legalLink } from "@/components/Home/legal/LegalDocument";

const LAST_UPDATED = "November 23, 2026";

const SECTIONS = [
  {
    id: "about",
    title: "About these Terms",
    body: (
      <>
        <p>
          BizBuddy (mybizbuddy.co) is a time keeping, leave and payroll service provided by BizSolutions LLC (“we”,
          “our”, “us”). These Terms apply to our website, web app and mobile apps (the “Services”).
        </p>
        <p>
          By using the Services, you agree to these Terms. If you use BizBuddy through your employer, your employer
          manages your account and decides how BizBuddy is set up.
        </p>
      </>
    ),
  },
  {
    id: "plans-billing",
    title: "Plans and billing",
    body: (
      <LegalList
        items={[
          "BizBuddy offers a free plan and paid plans. Paid plans are priced by plan and features.",
          "Paid plans are billed monthly in advance and renew automatically each month until cancelled.",
          "Fees are non-refundable, except where the law requires otherwise.",
          "By choosing a paid plan, you authorize us to charge your payment method for the plan’s fees.",
        ]}
      />
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <LegalList
        items={[
          "You must give accurate information and keep your login details secure.",
          "You are responsible for activity under your account.",
          "Company admins are responsible for the people they add and for the settings they choose.",
        ]}
      />
    ),
  },
  {
    id: "your-data",
    title: "Your data",
    body: (
      <>
        <p>
          You and your company own the data you put into BizBuddy. You give us permission to store, process and
          display it only as needed to provide the Services.
        </p>
        <p>
          We handle personal information as described in our{" "}
          <Link href="/privacy-policy" className={legalLink}>
            Privacy Policy
          </Link>
          , which is part of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Use BizBuddy only for lawful time keeping, payroll and workforce management. Don’t:</p>
        <LegalList
          items={[
            "Access accounts or data you aren’t authorized to use.",
            "Interfere with or disrupt the Services.",
            "Copy, resell or reverse engineer any part of the Services.",
          ]}
        />
      </>
    ),
  },
  {
    id: "availability-support",
    title: "Availability and support",
    body: (
      <>
        <p>
          We work to keep BizBuddy available, but we can’t guarantee uninterrupted service. We may update the Services
          from time to time and will try to schedule maintenance at quiet hours.
        </p>
        <p>
          Support is available 24 hours a day, by email or phone (see Contact us).
        </p>
      </>
    ),
  },
  {
    id: "termination",
    title: "Cancellation and termination",
    body: (
      <LegalList
        items={[
          "You can stop using BizBuddy at any time. To cancel a paid plan, contact us. Paid service continues to the end of the current billing period.",
          "Company admins can delete the company account in Settings. Deleted data can’t be recovered.",
          "We may suspend or end an account that breaks these Terms, including for non-payment or misuse.",
          "After an account ends, we delete its data, except where the law requires us to keep it.",
        ]}
      />
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <p>
        BizBuddy, its software, content, trademarks and logos belong to BizSolutions LLC. These Terms don’t give you
        any rights to them beyond using the Services.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, BizSolutions LLC is not liable for indirect, incidental, special or
        consequential damages, including loss of data or income, arising from use of, or inability to use, the
        Services.
      </p>
    ),
  },
  {
    id: "indemnification",
    title: "Indemnification",
    body: (
      <p>
        You agree to indemnify and hold harmless BizSolutions LLC, its affiliates and employees from claims or damages
        arising from your use of the Services or your breach of these Terms.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms. When we do, we’ll update the date at the top of this page. If you keep using the
        Services after a change takes effect, you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the State of California. Any dispute will be resolved in the courts of
        Santa Clara County, California.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    body: (
      <>
        <p>For questions about these Terms, contact:</p>
        <CompanyAddress />
      </>
    ),
  },
];

export default function Terms() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated={LAST_UPDATED} sections={SECTIONS} />
  );
}
