// app/(home)/faq/page.jsx
"use client";

import FAQ from "@/components/Home/Accordion";
import Footer from "@/components/Partial/Footer";
import React from "react";
function page() {
  return (
    <div className="flex flex-col justify-between items-center bg-white dark:bg-black">
      <FAQ />
      <Footer />
    </div>
  );
}
export default page;
