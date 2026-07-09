// app/(home)/faq/page.jsx
"use client";

import Contact from "@/components/Home/Contact";
import Footer from "@/components/Partial/Footer";
import React from "react";
function page() {
  return (
    <div className="flex flex-col justify-between items-center bg-white dark:bg-black">
      <Contact />
      <Footer />
    </div>
  );
}
export default page;
