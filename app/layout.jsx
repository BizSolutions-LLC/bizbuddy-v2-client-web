// app/layout.jsx

import "./globals.css";
import { ThemeProvider } from "@/components/Theme/ThemeProvider";
import NavBar from "@/components/Partial/Navbar";
import BizChatLoader from "@/components/Home/BizChatLoader";
import VersionCheck from "@/components/VersionCheck";
import { Inter, Inter_Tight } from "next/font/google";

// BB-145 — public-site fonts, exposed as CSS variables (font-landing / font-display).
// Both are variable fonts: no `weight` list (one file covers all weights). Listing weights makes
// Google return `/l/font?kit=…&skey=…` URLs, which Turbopack's font loader rejects
// ("next/font/google queries have exactly one entry").
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

export const metadata = {
  title: "BizBuddy",
  description: "BizBuddy web application for time-keeping, payroll and leaves.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable}`}>
      <head />
      <body className="bg-white dark:bg-black text-neutral-700 dark:text-neutral-400">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <VersionCheck />
          <NavBar />
          <main className="pt-16">{children}</main>
          {/* <BizChatLoader clientId="socckVI7VnKfbO5Jf6f6" /> */}
        </ThemeProvider>
      </body>
    </html>
  );
}
