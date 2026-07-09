// components/Home/FeaturesIcon.jsx
"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { features } from "@/lib/data";

const CARD_SPACING = 150;
const ROTATION_ANGLE = 25;

export default function FeaturesIcon() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const rotationY = useMotionValue(0);
  const containerRotation = useTransform(rotationY, [-200, 200], [-5, 5]);

  const getCircularIndices = () => {
    const result = [];
    const total = features.length;
    for (let i = 0; i < total; i++) {
      result.push((activeIndex + i) % total);
    }
    return result;
  };

  useEffect(() => {
    features.forEach((_, index) => {
      const element = document.getElementById(`feature-${index}`);
      if (element) {
        animate(
          element,
          { opacity: [0, 1], y: [100, 0], scale: [0.5, 1] },
          { duration: 0.6, delay: index * 0.1, ease: "easeOut" }
        );
      }
    });
  }, []);

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    const currentX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const diff = startX - currentX;

    if (Math.abs(diff) > 50) {
      const direction = diff > 0 ? 1 : -1;
      setActiveIndex((prev) => (prev + direction + features.length) % features.length);
      setIsDragging(false);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleContainerClick = (e) => {
    if (isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    if (e.clientX < midX) {
      setActiveIndex((prev) => (prev - 1 + features.length) % features.length);
    } else {
      setActiveIndex((prev) => (prev + 1) % features.length);
    }
  };

  const getCardStyle = (index) => {
    const circularIndices = getCircularIndices();
    const currentPosition = circularIndices.indexOf(index);
    const centerPosition = Math.floor(features.length / 2);

    let distance = currentPosition - centerPosition;
    if (Math.abs(distance) > features.length / 2) {
      distance = distance > 0 ? distance - features.length : distance + features.length;
    }

    const scale = 1 - Math.abs(distance) * 0.1;
    const xOffset = distance * CARD_SPACING;
    const zIndex = 100 - Math.abs(distance);
    const opacity = 1 - Math.abs(distance) * 0.15;

    return {
      x: xOffset,
      scale,
      zIndex,
      opacity,
      rotateY: distance * ROTATION_ANGLE,
    };
  };

  return (
    <div
      className={`
        relative w-full overflow-hidden perspective
        min-h-[400px] sm:min-h-[500px] md:min-h-[600px]
        pt-60 sm:pt-72 md:pt-96
        pb-16 sm:pb-24 md:pb-72
        md:mt-2  px-4 mb-20  md:mb-0
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onClick={handleContainerClick}
    >
      <motion.div className="flex items-center justify-center w-full h-full" style={{ rotateX: 10, rotateY: containerRotation }}>
        <div className="relative flex items-center justify-center">
          {features.map((feature, i) => {
            const style = getCardStyle(i);

            return (
              <motion.div
                key={feature.id}
                id={`feature-${i}`}
                className="absolute cursor-grab active:cursor-grabbing"
                style={{
                  x: style.x,
                  zIndex: style.zIndex,
                  opacity: style.opacity,
                }}
                animate={{
                  scale: style.scale,
                  rotateY: style.rotateY,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
                initial={{ opacity: 0, y: 100, scale: 0.5 }}
              >
                <motion.div
                  className="
                    w-56 h-72 sm:w-64 sm:h-80 md:w-72 md:h-96
                    rounded-xl shadow-xl
                    bg-gradient-to-b from-orange-400 to-red-600
                    flex flex-col items-center justify-center
                    text-white transform-gpu
                  "
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div whileHover={{ rotate: 360, scale: 1.2 }} transition={{ duration: 0.5 }} className="mb-6">
                    <feature.icon className="w-16 h-16 sm:w-20 sm:h-20" />
                  </motion.div>
                  <p className="text-lg sm:text-xl font-medium text-center px-6">{feature.name}</p>
                  <p className="mt-4 text-xs sm:text-sm text-center px-8 opacity-80">
                    {feature.description || "Feature description goes here"}
                  </p>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
