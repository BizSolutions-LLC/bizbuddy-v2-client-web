// File: biz-web-app/components/Partial/Footer.jsx
"use client";

import React from "react";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { FaLinkedin, FaFacebook, FaTwitter, FaTiktok, FaInstagram, FaYoutube } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { motion } from "framer-motion";

const Footer = () => {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const socials = [
    {
      icon: FaLinkedin,
      href: "https://www.linkedin.com/company/bizsolutions-llc/posts/",
      label: "LinkedIn",
    },
    {
      icon: FaFacebook,
      href: "https://www.facebook.com/SupportusBizSolutions",
      label: "Facebook",
    },
    {
      icon: FaTwitter,
      href: "https://x.com/",
      label: "Twitter / X",
    },
    {
      icon: FaTiktok,
      href: "https://www.tiktok.com/@bizsolutionsllc",
      label: "TikTok",
    },
    {
      icon: FaInstagram,
      href: "https://www.instagram.com/bizsolutionsllc/",
      label: "Instagram",
    },
    {
      icon: FaYoutube,
      href: "https://www.youtube.com/@BizSolutionsLLC",
      label: "YouTube",
    },
  ];

  return (
    <>
      <Script async data-cfasync="false" src="https://pl28936865.effectivegatecpm.com/1c7f0a653cf4336c856b10980ada0fbe/invoke.js" />
      <div id="container-1c7f0a653cf4336c856b10980ada0fbe" />
      <motion.footer className="w-full px-2 mt-28" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="container mx-auto px-2 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 items-center justify-center">
          <div className="space-y-6">
            <div className="flex items-center">
              <Image src="/logo.png" alt="BizBuddy Logo" width={200} height={60} className="w-48 sm:w-52 lg:w-56" />
            </div>
            <p className="text-sm sm:text-base leading-relaxed">
              BizBuddy makes time management seamless and hassle-free. With a simple and intuitive experience, it keeps you organized and in control every
              step of the way.
            </p>
            <p className="font-medium">Stay productive, stay efficient!</p>

            <div className="flex items-center gap-4">
              {socials.map(({ icon: Icon, href, label }) => (
                <Link
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="hover:text-orange-500 transform hover:scale-110 transition-all duration-200"
                >
                  <Icon size={22} />
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-semibold text-lg">Help</h3>
            <ul className="space-y-4">
              {[
                { title: "Privacy Policy", href: "/privacy-policy" },
                { title: "Terms of Service", href: "/terms" },
                { title: "FAQ", href: "/faq" },
              ].map((link) => (
                <li key={link.title}>
                  <Link
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-orange-500 transition-colors duration-200 flex items-center group"
                  >
                    <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform duration-200">{link.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6 shadow-xl rounded-xl p-2 h-full dark:bg-neutral-900 bg-orange-50">
            <div className="p-6 rounded-xl">
              <h3 className="font-bold text-2xl mb-4 text-neutral-800 dark:text-neutral-200">Subscribe to Our Newsletter</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <input
                    type="text"
                    id="name"
                    className="w-full dark:bg-neutral-800 bg-white p-2 text-sm pl-3 rounded-lg dark:border-2 border-input focus:border-2 focus:outline-none focus:ring-0 focus:border-orange-500"
                    required
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <input
                    type="email"
                    id="email"
                    className="w-full dark:bg-neutral-800 bg-white p-2 text-sm pl-3 rounded-lg dark:border-2 border-input focus:border-2 focus:outline-none focus:ring-0 focus:border-orange-500"
                    required
                    placeholder="Your email"
                  />
                </div>
                <button type="submit" className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl text-white py-3 px-5 text-sm font-semibold w-full shadow-md hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transition-all duration-200">
                  <span className="flex items-center justify-center">
                    <span className="mr-2">Subscribe</span>
                    <FiArrowRight className="w-5 h-5" />
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Bottom bar ---------- */}
      <div className="border-t border-orange-400 dark:border-orange-600">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center text-sm">
            Powered By:&nbsp;
            <span className="font-semibold">BizSolutions LLC</span>
          </div>
        </div>
      </div>
      </motion.footer>
    </>
  );
};

export default Footer;
