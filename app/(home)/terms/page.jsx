// File: biz-web-app/app/(home)/terms/page.jsx

"use client";
import Terms from "@/components/Home/Terms";
import Footer from "@/components/Partial/Footer";
import React from "react";

function page() {
  return (
    <div className="flex flex-col justify-between items-center">
      <Terms />
      <Footer />
    </div>
  );
}

export default page;
