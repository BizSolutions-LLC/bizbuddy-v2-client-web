// app/api/contact/route.js
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { FiMessageSquare, FiSend } from "react-icons/fi";
import { MdOutlineContactSupport, MdOutlineEmail } from "react-icons/md";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Example icons from react-icons (AiOutlinePhone, AiOutlineMail)
import { AiOutlinePhone, AiOutlineMail } from "react-icons/ai";

function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [status, setStatus] = useState({
    loading: false,
    success: null, // or 'success'/'error'
    error: null,
  });

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

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: null, error: null });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await res.json();

      if (res.ok) {
        // Email sent successfully
        setStatus({ loading: false, success: true, error: null });
        // Clear form if needed
        setFormData({ name: "", email: "", message: "" });
      } else {
        throw new Error(result.error || "Something went wrong");
      }
    } catch (error) {
      setStatus({ loading: false, success: false, error: error.message });
    }
  };

  return (
    <motion.div className="py-10 mx-auto px-4 w-full max-w-7xl" initial="hidden" animate="visible" variants={containerVariants}>
      <motion.h2
        className="text-orange-500 font-bold text-center pb-2 max-w-7xl mx-auto text-xl sm:text-2xl md:text-4xl lg:text-5xl capitalize"
        variants={itemVariants}
      >
        Get in Touch
      </motion.h2>
      <div className="flex flex-col justify-center items-center w-full mt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* Contact Details Card */}
          <motion.div variants={itemVariants} className="w-full">
            <Card className="rounded-xl p-2 border-none shadow-xl h-full bg-white dark:bg-neutral-800">
              <CardHeader>
                <h3 className="flex items-center text-xl sm:text-2xl font-bold dark:text-neutral-200 text-neutral-800">
                  <MdOutlineContactSupport className="mr-2 text-orange-500" />
                  Contact Details
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 bg-orange-50 dark:bg-neutral-900 p-2 rounded-xl text-neutral-600 dark:text-neutral-400 text-base">
                    <MdOutlineEmail className="w-6 h-6 text-white bg-orange-500 p-1 rounded-xl" />
                    <Link href="#" prefetch={false} className="text-xs sm:text-sm hover:text-orange-500 transition-colors">
                      info@bizsolutions.us
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Send Message Card */}
          <motion.div variants={itemVariants} className="w-full">
            <Card className="rounded-xl p-2 border-none shadow-xl h-full bg-orange-50 dark:bg-neutral-900">
              <CardHeader>
                <h3 className="flex items-center text-xl sm:text-2xl font-bold dark:text-neutral-200 text-neutral-800">
                  <FiMessageSquare className="mr-2 text-orange-500" />
                  Send Message
                </h3>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Input
                      id="name"
                      placeholder="Your name"
                      className="border-none p-2 pl-3 bg-white dark:bg-neutral-800"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      id="email"
                      placeholder="Your email"
                      type="email"
                      className="border-none p-2 pl-3 bg-white dark:bg-neutral-800"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      id="message"
                      placeholder="Your message"
                      className="bg-white dark:bg-neutral-800"
                      value={formData.message}
                      onChange={handleChange}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={status.loading}
                    className="py-3 px-4 w-full font-semibold text-white rounded-xl text-sm bg-gradient-to-r from-orange-500 to-orange-600"
                  >
                    <span className="flex items-center justify-center">
                      {status.loading ? <span className="mr-2 animate-pulse">Sending...</span> : <span className="mr-2">Send Message</span>}
                      <FiSend />
                    </span>
                  </Button>
                </form>

                {/* Success / Error Messages */}
                {status.success && <p className="mt-4 text-green-600 font-medium">Thank you! Your message has been sent.</p>}
                {status.error && <p className="mt-4 text-red-600 font-medium">Oops! {status.error}</p>}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default Contact;
