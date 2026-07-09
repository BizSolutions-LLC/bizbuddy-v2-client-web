// components/Home/DataDisplay.jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { appData } from "@/lib/data";
import { X, Smartphone, Download } from "lucide-react";

function DataDisplay() {
  const [qrModalType, setQrModalType] = useState(null);
  const handleOpenQrModal = (type) => {
    setQrModalType(type);
  };

  const handleCloseQrModal = () => {
    setQrModalType(null);
  };

  return (
    <section className="relative w-full shadow-xl overflow-hidden bg-gradient-to-b from-red-600 via-orange-400 to-neutral-200 outline-none border-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20"
      >
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="w-full lg:w-1/2 space-y-6 text-center lg:text-left lg:pl-20"
          >
            <div className="space-y-2">
              <motion.h1
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold"
              >
                <span className="text-white">Time Management,</span>
                <br />
                <span className="text-black">Made Simple.</span>
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="text-lg sm:text-xl text-neutral-800 max-w-2xl mx-auto lg:mx-0"
              >
                Manage schedules, track hours, and stay on top of work. Try BizBuddy now!
              </motion.p>
            </div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex flex-col md:flex-row items-center justify-center lg:justify-start lg:gap-4 gap-2 lg:pt-4 pt-2"
            >
              <Image
                src="/download-app-store.png"
                alt="Download on App Store"
                width={180}
                height={54}
                className="w-20 sm:w-48 hover:scale-105 transition-transform cursor-pointer"
                onClick={() => handleOpenQrModal("app")}
              />
              <Image
                src="/download-google-play.png"
                alt="Get it on Google Play"
                width={180}
                height={54}
                className="w-20 sm:w-48 hover:scale-105 transition-transform cursor-pointer"
                onClick={() => handleOpenQrModal("play")}
              />
            </motion.div>
          </motion.div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="w-3/5 lg:w-1/2 h-28 flex justify-center items-center mt-4 lg:mt-2"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3 }}
              className="relative w-full h-[300px] lg:h-[800px]"
            >
              <Image src="/laptop.png" alt="BizBuddy App Interface" fill className="object-contain drop-shadow-2xl" />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="w-full bg-red-600 py-8 border-none outline-none"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4">
            {appData.map((data, index) => (
              <motion.div
                key={data.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8 + index * 0.1, duration: 0.6 }}
                className="text-center bg-gradient-to-t from-red-600 via-orange-600 to-orange-400 backdrop-blur-sm rounded-lg p-4 transform hover:scale-105 transition-transform flex-1 min-w-[150px] max-w-[200px]"
              >
                <p className="text-3xl font-bold text-white mb-1">
                  {typeof data.quantity === "number" ? data.quantity.toLocaleString() : data.quantity}
                </p>
                <p className="text-sm text-white/90">{data.metric}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {qrModalType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleCloseQrModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-red-600 to-orange-400 p-4 relative">
                <button
                  onClick={handleCloseQrModal}
                  className="absolute top-3 right-3 text-white bg-black/20 hover:bg-black/30 rounded-full p-1 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="size-5" />
                </button>
                <h3 className="text-xl font-bold text-white">
                  {qrModalType === "app" ? "Download for iOS" : "Download for Android"}
                </h3>
                <p className="text-white/90 text-sm mt-1">Scan the QR code to download BizBuddy</p>
              </div>

              <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="relative">
                  <motion.div
                    animate={{
                      boxShadow: ["0 0 0 0px rgba(239, 68, 68, 0.2)", "0 0 0 4px rgba(239, 68, 68, 0.2)"],
                    }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                    className="bg-white p-3 rounded-lg"
                  >
                    <Image
                      src={qrModalType === "app" ? "/bizbuddy-appstore.png" : "/bizbuddy-playstore.png"}
                      alt={qrModalType === "app" ? "Bizbuddy AppStore QR" : "Bizbuddy PlayStore QR"}
                      width={180}
                      height={180}
                      className="rounded-md"
                    />
                  </motion.div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                      <Smartphone className="size-5 text-red-600" />
                      <span className="font-medium">Open your camera app</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 pl-7">
                      Point your camera at the QR code to scan it
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                      <Download className="size-5 text-red-600" />
                      <span className="font-medium">Install BizBuddy</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 pl-7">
                      Tap the notification and follow the instructions to install
                    </p>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Or visit directly:</p>
                    <a
                      href={
                        qrModalType === "app" ? "https://apps.apple.com/bizbuddy" : "https://play.google.com/store/apps/bizbuddy"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      {qrModalType === "app" ? "apps.apple.com/bizbuddy" : "play.google.com/store/apps/bizbuddy"}
                    </a>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-100 dark:bg-neutral-900 p-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex flex-wrap gap-3 justify-center text-center">
                  <div className="text-xs text-neutral-600 dark:text-neutral-400 px-2">
                    <span className="font-semibold block text-neutral-800 dark:text-neutral-200">Easy Setup</span>
                    2-minute onboarding
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default DataDisplay;
