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
  }, []);

  const imageVariants = {
    initial: { x: 100, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 },
  };

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

  return (
    <motion.div
      className="w-full py-2 md:py-14 px-4 sm:px-6 lg:px-8 lg:py-28 lg:my-6 "
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div className="mb-8" variants={itemVariants}>
        <h2 className="text-orange-500 mb-10 font-bold text-center pb-2 max-w-7xl mx-auto text-xl sm:text-2xl md:text-4xl lg:text-5xl capitalize">
          Key Features
        </h2>
      </motion.div>
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-center justify-center">
        <motion.div
          className="w-full lg:w-3/5 h-[30vh] sm:h-[40vh] lg:h-[60vh] relative overflow-hidden rounded-3xl"
          variants={itemVariants}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={images[currentImageIndex]}
              alt={`Feature Image ${currentImageIndex + 1}`}
              variants={imageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
        </motion.div>
        <div className="w-full lg:w-3/5 flex flex-col items-start justify-center lg:shadow-2xl  shadow-none p-2 md:rounded-xl dark:shadow-neutral-900  ">
          <motion.div
            className="
              w-full max-w-7xl mx-auto
              px-4
              flex flex-nowrap items-center justify-center
              gap-2 sm:gap-4 md:gap-6
              "
            variants={itemVariants}
          >
            {featureDetails.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.button
                  key={feature.id}
                  onClick={() => setActiveFeature(feature.id)}
                  className={`
          inline-flex items-center justify-center
          gap-1 sm:gap-2
          px-2 sm:px-3 md:px-4
          py-1 sm:py-2
          rounded-lg md:rounded-xl
          text-xs sm:text-sm md:text-base lg:text-sm font-semibold
          shrink-0
          border-none outline-none
          transition-colors duration-300
          ${
            activeFeature === feature.id
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:bg-orange-500"
              : "hover:bg-gradient-to-r from-orange-500 to-orange-600 hover:text-white"
          }
        `}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
                  <span className="leading-tight">{feature.name}</span>
                </motion.button>
              );
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeFeature}
              className="p-4 rounded-xl w-full mt-10 "
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <p className="text-sm sm:text-base lg:text-2xl font-semibold">{activeDetail?.details}</p>
              {activeDetail?.moreDetails && (
                <motion.ul
                  className="mt-4 space-y-2 text-left text-xs sm:text-sm lg:text-xl "
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {Object.values(activeDetail.moreDetails).map((detail, index) => (
                    <motion.li key={index} className="flex items-start gap-2" variants={itemVariants}>
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 mt-1" color="#f97316" />
                      <span>{detail}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default KeyFeatures;
