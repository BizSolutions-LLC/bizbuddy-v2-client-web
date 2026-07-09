// app/layout.jsx

import "./globals.css";
import { ThemeProvider } from "@/components/Theme/ThemeProvider";
import NavBar from "@/components/Partial/Navbar";
import BizChat from "@/components/Home/BizChat";
import VersionCheck from "@/components/VersionCheck";

export const metadata = {
  title: "BizBuddy",
  description: "BizBuddy web application for time-keeping, payroll and leaves.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="bg-white dark:bg-black text-neutral-700 dark:text-neutral-400">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <VersionCheck />
          <NavBar />
          <main className="pt-16">{children}</main>
          <BizChat clientId="socckVI7VnKfbO5Jf6f6" />
        </ThemeProvider>
      </body>
    </html>
  );
}
