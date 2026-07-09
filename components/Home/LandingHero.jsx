// components/Home/LandingHero.jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Smartphone, Download } from "lucide-react";

export default function LandingHero() {
  const [qrModalType, setQrModalType] = useState(null);

  const handleOpenQrModal = (type) => {
    setQrModalType(type);
  };

  const handleCloseQrModal = () => {
    setQrModalType(null);
  };

  return (
    <section className="md:py-12 py-7 mx-4 shadow-xl flex flex-col md:flex-row items-center justify-around max-w-7xl bg-gradient-to-r from-orange-400 to-red-600 rounded-xl overflow-hidden relative">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full md:w-1/2 p-5 flex flex-col justify-center items-start md:space-y-4 space-y-2"
      >
        <div className="space-y-2 font-medium">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl md:text-5xl text-white"
          >
            Start Time Tracking,
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-3xl md:text-5xl text-black"
          >
            Effortless Productivity
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-base md:text-lg text-black"
          >
            Available on All Platforms
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className=" text-base md:text-lg text-black font-medium"
          >
            <span className="text-white">Bizbuddy</span> is accessible on Google Play, Appstore, Windows, Mac, and Web. Track time
            effortlessly across all your devices and stay productive anywhere, anytime!
          </motion.p>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-base md:text-lg text-black font-medium"
        >
          Download <span className="text-white">Bizbuddy</span> for free!
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex md:gap-4 gap-2 items-center"
        >
          <Image
            src="/download-app-store.png"
            alt="download app store"
            width={160}
            height={48}
            className="w-44 sm:w-48 hover:scale-105 transition-transform cursor-pointer"
            onClick={() => handleOpenQrModal("app")}
          />
          <Image
            src="/download-google-play.png"
            alt="download google play"
            width={160}
            height={48}
            className="w-44 sm:w-48 hover:scale-105 transition-transform cursor-pointer"
            onClick={() => handleOpenQrModal("play")}
          />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
        className="w-full md:w-1/2 flex justify-center items-center md:mt-0 mt-10"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: [20, -20, 20] }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 4,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/landing-hero-image.png"
            alt="Devices"
            width={700}
            height={700}
            className="w-[150%] h-auto object-contain"
          />
        </motion.div>
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
              <div className="bg-gradient-to-r from-orange-400 to-red-600 p-4 relative">
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
