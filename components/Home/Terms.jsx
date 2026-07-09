// components/Home/Terms.jsx
"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const termsItems = [
  {
    value: "intro",
    title: "Welcome to MyBizBuddy.co",
    content: `
MyBizBuddy.co is a cloud-based time-keeping and payroll platform operated by BizSolutions LLC (“Company,” “we,” “us,” or “our”).
By accessing our website, mobile application, or services (“Platform”), you agree to be bound by these Terms and Conditions (“Terms”).`,
  },
  {
    value: "subscription",
    title: "1. Subscription and Billing",
    content: `
a. Subscription Requirement  
   Access is available only through a paid subscription, priced by user count and selected features.

b. Billing Cycle  
   Subscriptions are billed monthly or annually in advance; payments are non-refundable except where required by law.

c. Auto-Renewal  
   Plans renew automatically unless cancelled at least five (5) business days before the renewal date.

d. Payment Method  
   You authorize BizSolutions LLC to charge your designated payment method for all subscription fees.`,
  },
  {
    value: "accounts",
    title: "2. User Accounts and Responsibilities",
    content: `
a. Account Registration  
   You must register an account with accurate information and keep your credentials secure.

b. Authorized Use  
   The Platform may be used only for lawful time-keeping, payroll, and workforce-management purposes. You are responsible for all activity under your account.

c. User Content  
   You retain ownership of your data but grant us a limited license to process, store, and display it as necessary to deliver the service.`,
  },
  {
    value: "privacy",
    title: "3. Data Privacy and Security",
    content: `
We handle all personal and payroll information in accordance with our Privacy Policy (incorporated here by reference).`,
  },
  {
    value: "availability",
    title: "4. Service Availability and Support",
    content: `
a. Uptime Commitment – We target 99.9 % uptime but cannot guarantee uninterrupted service.  
b. Maintenance – Planned updates are scheduled during off-peak hours with prior notice where possible.  
c. Technical Support – Available 9 AM – 6 PM PST, Monday–Friday, via help-desk or info@bizsolutions.us.`,
  },
  {
    value: "termination",
    title: "5. Termination and Suspension",
    content: `
a. By User – Cancel any time in account settings; service ends at the current billing cycle’s close.  
b. By Company – We may suspend or terminate accounts for Terms violations, including non-payment or abuse.  
c. Data Retention – Data is retained up to 60 days after termination, then permanently deleted unless law requires otherwise.`,
  },
  {
    value: "ip",
    title: "6. Intellectual Property",
    content: `
All content, trademarks, logos, and software are the property of BizSolutions LLC. You may not reproduce, distribute, or reverse-engineer any part of the Platform without prior written consent.`,
  },
  {
    value: "liability",
    title: "7. Limitation of Liability",
    content: `
To the maximum extent permitted by law, BizSolutions LLC is not liable for indirect, incidental, special, or consequential damages (including loss of data or income) arising from use of—or inability to use—the Platform.`,
  },
  {
    value: "indemnification",
    title: "8. Indemnification",
    content: `
You agree to indemnify and hold harmless BizSolutions LLC, its affiliates, and employees from any claims or damages arising out of your Platform use or breach of these Terms.`,
  },
  {
    value: "modifications",
    title: "9. Modifications to Terms",
    content: `
We may modify these Terms at any time. Updated versions will appear on our site with a new “Effective Date.” Continued use after changes indicates acceptance.`,
  },
  {
    value: "law",
    title: "10. Governing Law and Dispute Resolution",
    content: `
These Terms are governed by the laws of the State of California. Any dispute will be resolved in the courts of Santa Clara County, California.`,
  },
  {
    value: "contact",
    title: "11. Contact Information",
    content: (
      <div className="space-y-2">
        <p>BizSolutions&nbsp;LLC</p>
        <p>
          <Link
            href="https://www.google.com/maps/search/?api=1&query=20289+Stevens+Creek+Boulevard+%231039+Cupertino+California+95014"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 underline"
          >
            20289&nbsp;Stevens&nbsp;Creek&nbsp;Boulevard&nbsp;#1039
            <br />
            Cupertino,&nbsp;CA&nbsp;95014&nbsp;USA
          </Link>
        </p>
        <p>
          Email:&nbsp;
          <a href="mailto:info@bizsolutions.us" className="text-orange-600 underline">
            info@bizsolutions.us
          </a>
        </p>
        <p>
          Website:&nbsp;
          <Link href="https://mybizbuddy.co" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">
            mybizbuddy.co
          </Link>
        </p>
      </div>
    ),
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

export default function Terms() {
  return (
    <motion.section
      className="py-10 md:py-10 px-4 mx-auto w-full max-w-7xl"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.h2
        className="text-orange-500 font-bold text-center pb-2 text-xl sm:text-2xl md:text-4xl lg:text-5xl"
        variants={itemVariants}
      >
        Terms&nbsp;and&nbsp;Conditions
      </motion.h2>

      <motion.div className="flex flex-col items-center mt-10 max-w-3xl mx-auto" variants={containerVariants}>
        <Accordion type="single" collapsible className="w-full">
          {termsItems.map((term, i) => (
            <motion.div key={`term-${term.value}-${i}`} variants={itemVariants}>
              <AccordionItem value={term.value} className="border-b last:border-b-0">
                <AccordionTrigger className="py-4 px-2 text-left">{term.title}</AccordionTrigger>
                <AccordionContent className="px-2 pb-4">
                  {typeof term.content === "string" ? <span className="whitespace-pre-line">{term.content}</span> : term.content}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </motion.div>
    </motion.section>
  );
}
