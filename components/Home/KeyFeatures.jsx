// components/Home/KeyFeatures.jsx
"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { featureDetails } from "@/lib/data";

function KeyFeatures() {
  const [activeFeature, setActiveFeature] = useState("schedule");
  const activeDetail = featureDetails.find((f) => f.id === activeFeature);
  const images = ["/phone.png", "/tablet.png", "/laptop.png"];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <section className="w-full px-4 py-8 sm:px-6 sm:py-14 lg:px-8 lg:py-28">
      <h2 className="mb-8 text-center text-xl font-bold capitalize text-orange-500 sm:mb-10 sm:text-2xl md:text-4xl lg:text-5xl">
        Key Features
      </h2>

      <motion.div className="mx-auto flex w-full max-w-7xl flex-col items-stretch gap-8 lg:flex-row lg:items-center lg:gap-16">
        <div className="relative h-[32vh] w-full overflow-hidden rounded-3xl sm:h-[40vh] lg:h-[60vh] lg:w-3/5">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={images[currentImageIndex]}
              alt={`Feature Image ${currentImageIndex + 1}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-full w-full object-cover"
            />
          </AnimatePresence>
        </div>

        <motion.div className="flex w-full min-w-0 flex-col lg:w-3/5">
          <motion.div
            role="tablist"
            aria-label="Key features"
            className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {featureDetails.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeFeature === feature.id;
              return (
                <button
                  key={feature.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveFeature(feature.id)}
                  className={`key-feature-tab rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "bg-orange-500 text-white shadow-md"
                      : "bg-neutral-100 text-neutral-700 hover:bg-orange-500 hover:text-white dark:bg-neutral-800 dark:text-neutral-200"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{feature.name}</span>
                </button>
              );
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              role="tabpanel"
              className="mt-6 w-full rounded-xl p-4 sm:mt-8"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-sm font-semibold sm:text-base lg:text-2xl">{activeDetail?.details}</p>
              {activeDetail?.moreDetails && (
                <ul className="mt-4 space-y-2 text-left text-xs sm:text-sm lg:text-xl">
                  {Object.values(activeDetail.moreDetails).map((detail, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5" color="#f97316" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default KeyFeatures;
