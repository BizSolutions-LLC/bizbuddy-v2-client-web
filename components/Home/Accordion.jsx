// components/Home/Accordion.jsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const faqItems = [
  {
    value: "what-is-bizbuddy",
    question: "What is BizBuddy?",
    answer: `
BizBuddy is an all-in-one timekeeping and productivity monitoring solution designed specifically for small to mid-sized businesses and remote teams. It empowers business owners to track work hours, monitor employee performance, and streamline labor audits — all in one user-friendly platform.

With BizBuddy, businesses gain real-time insights into how time is spent, enabling more accurate payroll processing, better workforce accountability, and optimized productivity. Whether your team is on-site or remote, BizBuddy ensures you stay in control of your labor costs while maintaining compliance with local labor laws.

BizBuddy is developed by BizSolutions LLC as a comprehensive workforce management solution. It offers a suite of tools designed to streamline operations, enhance productivity, and ensure compliance for small to mid-sized businesses.        
    `,
  },
  {
    value: "where-to-get-app",
    question: "Where can I get the BizBuddy app?",
    answer: `
You can download the BizBuddy app from the official website: mybizbuddy.co. The app is available on multiple platforms, including:

• iOS (App Store): Click the "Download on the App Store" button on the website to access the app for iPhone and iPad.
• Android (Google Play): Click the "Get it on Google Play" button on the website to access the app for Android devices.
• Windows and Mac: Desktop versions are also available; follow the respective download links provided on the website.

These links will direct you to the appropriate app store or download page for your device. For more information about the app's features and supported platforms, visit the BizBuddy homepage.      
    `,
  },
  {
    value: "key-services-offered",
    question: "What are the key services offered by BizBuddy?",
    answer: `
BizBuddy, developed by BizSolutions LLC, is a comprehensive workforce management solution tailored for small to mid-sized businesses. It offers a wide range of features:

1. Timekeeping & Attendance Tracking
   • Real-time clock-in/out functionality
   • Offline punch capability for areas with limited connectivity
   • Location-based punching to verify employee locations

2. Scheduling & Shift Management
   • Create and manage employee shifts with ease
   • Automatic reminders for upcoming shifts or changes
   • Flexible adjustments to accommodate staffing needs

3. Leave Management
   • Track and manage employee leave requests
   • Monitor leave balances and approvals

4. Payroll Integration
   • Simplify payroll processes with integrated time tracking
   • Generate accurate reports for payroll processing

5. Geofencing & Location Tracking
   • Ensure employees are within designated work areas
   • Enhance accountability with location verification

6. Cross-Platform Accessibility
   • Available on iOS, Android, Windows, Mac, and Web
   • Sync data across all devices for seamless access

With over 1.5 million downloads and a 4.8-star rating, BizBuddy is trusted by businesses worldwide to manage their workforce efficiently. 
    `,
  },
  {
    value: "flexibility",
    question: "How flexible is BizBuddy?",
    answer: `
BizBuddy is a versatile and flexible workforce management platform designed to meet the diverse needs of small to mid-sized businesses. Its adaptability stems from:

1. Cross-Platform Accessibility
   • Available on iOS, Android, Windows, Mac, and Web, ensuring seamless access across devices.

2. Customizable Scheduling & Shift Management
   • Easily create, modify, and set automatic reminders for shifts.
   • Make flexible adjustments to accommodate changing staffing needs.

3. Comprehensive Timekeeping Features
   • Real-time clock-in/out functionality.
   • Offline punch capability for areas with limited connectivity.
   • Location-based punching to verify employee locations.

4. Integrated Leave & Payroll Management
   • Track and approve employee leave requests.
   • Simplify payroll processes with integrated time tracking and reporting.

5. Scalable Solutions for Growing Businesses
   • Adapts to both small and large teams, including remote or on-site.

In short, BizBuddy’s flexibility allows it to accommodate various business models and operational demands, making it a valuable tool for efficient workforce management. 
    `,
  },
  {
    value: "pricing",
    question: "How does BizBuddy’s pricing compare to others?",
    answer: `
Industry-standard pricing for workforce management software usually ranges from $2.50 to $72.00 per user per month. However, BizBuddy offers an affordable and flexible pricing model, tailored to your actual number of employees and the specific features you need. Advantages include:

• Pay only for what you use — no unnecessary add-ons or bloated packages.
• Cost-efficient for growing teams — easily scale up or down as your workforce changes.
• Ideal for businesses of all sizes — from startups to established companies.
• Powerful features (GPS time tracking, scheduling, payroll reporting, geofencing) at a fraction of the cost of enterprise tools like Kronos or ADP.

For a custom quote, visit mybizbuddy.co. Simply provide your team size, the features you require, and your usage level to receive a fair and accurate rate. 
    `,
  },
  {
    value: "data-security",
    question: "Is my data secure?",
    answer: `
BizBuddy takes the security of your data seriously. They employ measures to protect against unauthorized access, theft, or misuse of your information. Key details include:

• Security Environment
  BizBuddy advises users to access their services within a secure environment, as no electronic transmission or storage can be 100% guaranteed.

• Compliance and Privacy Practices
  BizBuddy processes your information only with a valid legal reason and does not sell or share personal information with third parties for commercial purposes. They retain data only as long as needed to fulfill their outlined purposes, unless law requires otherwise.

• User Rights and Transparency
  Depending on your location, you may request access to, correction of, or deletion of your personal information by contacting BizBuddy. They prioritize transparency in how they collect, use, and share data.

Overall, BizBuddy is committed to safeguarding user data with both organizational and technical processes. 
    `,
  },
  {
    value: "payment-methods",
    question: "What payment methods do you accept?",
    answer: `
BizBuddy uses a subscription-based billing model where you pay for the features and employee count you need, rather than a flat per-user fee. While their official website does not specify the exact payment methods, most similar platforms typically accept major credit cards (Visa, MasterCard, American Express) and popular digital payment options.

Key Benefits of BizBuddy’s Payment Model:
• Cost-Effective: Pay only for the functionalities and employee numbers you actually use.
• Scalable: Easily adjust your plan as your business grows or needs change.
• Transparent Billing: Clear breakdowns of charges so you know exactly what you’re paying for.

For precise payment methods or to get a custom quote, visit mybizbuddy.co or contact their customer support. 
    `,
  },
];

function FAQ() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <motion.section
      className="py-10 md:py-10 mx-auto px-4 w-full max-w-7xl"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.h2
        className="text-orange-500 font-bold text-center pb-2 max-w-7xl mx-auto text-xl sm:text-2xl md:text-4xl lg:text-5xl capitalize"
        variants={itemVariants}
      >
        Frequently Asked Questions
      </motion.h2>

      <motion.div className="flex flex-col justify-center items-center mt-10 max-w-3xl mx-auto" variants={containerVariants}>
        {/* Accordion: Single collapsible */}
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, index) => (
            <motion.div key={`faq-${item.value}-${index}`} variants={itemVariants}>
              <AccordionItem value={item.value} className="border-b last:border-b-0">
                <AccordionTrigger className="py-4 px-2 text-left">{item.question}</AccordionTrigger>
                <AccordionContent className="px-2 pb-4 whitespace-pre-line">{item.answer}</AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </motion.div>
    </motion.section>
  );
}

export default FAQ;
