// components/Home/Contact.jsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { FiMessageSquare, FiSend } from "react-icons/fi";
import { MdOutlineContactSupport, MdOutlineEmail } from "react-icons/md";
import { AiOutlinePhone } from "react-icons/ai";

export default function Contact() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const mailSubject = encodeURIComponent(subject);
    const mailBody = encodeURIComponent(message);
    const mailto = `mailto:info@bizsolutions.us?subject=${mailSubject}&body=${mailBody}`;

    window.open(mailto, "_blank");
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div className="py-10 mx-auto px-4 w-full max-w-7xl " initial="hidden" animate="visible" variants={containerVariants}>
      <motion.h2
        className="text-orange-500 font-bold text-center pb-2 text-xl sm:text-2xl md:text-4xl lg:text-5xl capitalize"
        variants={itemVariants}
      >
        Get in Touch
      </motion.h2>
      <div className="flex flex-col items-center w-full mt-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          <motion.div variants={itemVariants}>
            <Card className="rounded-xl p-2 border-none shadow-xl  h-full">
              <CardHeader>
                <h3 className="flex items-center text-xl sm:text-2xl font-bold dark:text-neutral-200 text-neutral-800">
                  <MdOutlineContactSupport className="mr-2 text-orange-500" />
                  Contact Details
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 bg-orange-50 dark:bg-neutral-900 p-2 rounded-xl text-neutral-600 dark:text-neutral-400">
                    <MdOutlineEmail className="w-6 h-6 text-white bg-orange-500 p-1 rounded-xl" />
                    <Link
                      href="mailto:info@bizsolutions.us"
                      className="text-xs sm:text-sm hover:text-orange-500 transition-colors"
                    >
                      info@bizsolutions.us
                    </Link>
                  </div>
                  <div className="flex items-center space-x-2 bg-orange-50 dark:bg-neutral-900 p-2 rounded-xl text-neutral-600 dark:text-neutral-400">
                    <AiOutlinePhone className="w-6 h-6 text-white bg-orange-500 p-1 rounded-xl" />
                    <p href="tel:1-800-800-8000" className="text-xs sm:text-sm hover:text-orange-500 transition-colors">
                      +1 833-249-7418
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card className="rounded-xl p-2 border-none shadow-xl bg-orange-50 dark:bg-neutral-900 h-full">
              <CardHeader>
                <h3 className="flex items-center text-xl sm:text-2xl font-bold dark:text-neutral-200 text-neutral-800">
                  <FiMessageSquare className="mr-2 text-orange-500" />
                  Send Message
                </h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    id="subject"
                    placeholder="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="  "
                    required
                  />
                  <Textarea
                    id="message"
                    placeholder="Your message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className=""
                    required
                  />
                  <Button
                    type="submit"
                    className="py-3 px-4 w-full font-semibold text-white rounded-lg text-sm bg-gradient-to-r from-orange-500 to-orange-600"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-2">Send Message</span>
                      <FiSend />
                    </span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
