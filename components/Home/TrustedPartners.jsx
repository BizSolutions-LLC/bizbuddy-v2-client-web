// components/Home/TrusterPartners.jsx
"use client";

import { trustedPartners } from "@/lib/data";
import { motion, useAnimationControls } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

function TrustedPartners() {
  const controls = useAnimationControls();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    controls.start({
      x: ["0%", "-50%"],
      transition: {
        duration: 25,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      },
    });
  }, [controls]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    controls.stop();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    controls.start({
      x: ["0%", "-50%"],
      transition: {
        duration: 25,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      },
    });
  };

  const partnersForMarquee = [...trustedPartners, ...trustedPartners];

  return (
    <div className="w-full my-5 py-16 -mb-9 md:py-28 flex flex-col items-center overflow-hidden bg-gradient-to-b from-orange-50/40 via-white to-orange-50/40 dark:from-black/90 dark:via-neutral-900 dark:to-black/90">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <h2 className="text-orange-500 font-bold text-center pb-6 text-2xl sm:text-3xl md:text-4xl lg:text-5xl capitalize">
          Our Trusted Partners
        </h2>

        <p className="text-center text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto mb-12 text-sm sm:text-base">
          We collaborate with industry leaders to deliver exceptional solutions and services to our clients
        </p>
      </div>

      <div className="relative w-full mt-8">
        <div className="absolute left-0 w-20 h-full z-10 bg-gradient-to-r from-white dark:from-neutral-950 to-transparent"></div>
        <div className="absolute right-0 w-20 h-full z-10 bg-gradient-to-l from-white dark:from-neutral-950 to-transparent"></div>

        <div className="overflow-hidden w-full py-8" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <motion.div
            animate={controls}
            initial={{ x: "0%" }}
            className="flex items-center gap-16 sm:gap-24 md:gap-32 lg:gap-40 w-[200%]"
          >
            {partnersForMarquee.map((partner, index) => (
              <motion.div
                key={index}
                className="flex-shrink-0 group"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <div className="relative bg-white dark:bg-neutral-600 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center">
                  <Image
                    src={partner.src}
                    alt={partner.name || `Trusted Partner ${index + 1}`}
                    width={200}
                    height={200}
                    className="w-20 sm:w-24 md:w-28 lg:w-32 h-20 sm:h-24 md:h-28 lg:h-32 object-contain transition-all duration-300 group-hover:brightness-110"
                  />
                </div>
                {partner.name && (
                  <p className="text-center mt-2 text-sm text-neutral-600 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {partner.name}
                  </p>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default TrustedPartners;
