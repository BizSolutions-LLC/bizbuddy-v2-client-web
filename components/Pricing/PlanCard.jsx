// components/Pricing/PlanCard.jsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { motion } from "framer-motion";

const featureLabels = {
  timekeeping: "Timekeeping",
  leaves: "Leaves",
  payroll: "Payroll",
  "timekeeping-punch-offline": "Timekeeping Offline",
  "timekeeping-punch-location": "Timekeeping Location",
};

export default function PriceCard({ plan }) {
  const router = useRouter();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options =
    Array.isArray(plan.options) && plan.options.length > 0
      ? plan.options
      : [
          {
            id: plan.id,
            price: plan.price,
            rangeOfUsers: plan.rangeOfUsers,
            description: plan.description,
          },
        ];
  const selectedOption = options[selectedOptionIndex];

  const handlePrevOption = () => {
    if (selectedOptionIndex > 0) {
      setSelectedOptionIndex(selectedOptionIndex - 1);
    }
  };

  const handleNextOption = () => {
    if (selectedOptionIndex < options.length - 1) {
      setSelectedOptionIndex(selectedOptionIndex + 1);
    }
  };

  const handleChoosePlan = () => {
    localStorage.setItem("selectedPlan", JSON.stringify(selectedOption));
    router.push(`/sign-up?planId=${selectedOption.id}`);
  };

  return (
    <motion.div
      className="relative dark:bg-neutral-800 rounded-2xl shadow-lg p-6 flex flex-col transition-all duration-300 hover:shadow-xl"
      initial="hidden"
      animate={mounted ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: -50 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
      }}
    >
      {plan.name === "Pro" && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1 rounded-tr-2xl rounded-bl-2xl text-sm font-semibold">
          Most Popular
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="lg:text-4xl text-2xl font-bold">{plan.name} Plan</h2>
        <span className="lg:text-4xl text-2xl font-bold">${selectedOption.price}</span>
      </div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevOption}
            disabled={selectedOptionIndex === 0}
            className="p-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <span className="lg:text-xl text-lg font-semibold">{selectedOption.rangeOfUsers} users</span>
          <button
            onClick={handleNextOption}
            disabled={selectedOptionIndex === options.length - 1}
            className="p-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="mb-6 flex-grow">
        <h3 className="text-lg font-semibold mb-3">Features:</h3>
        <ul className="space-y-2">
          {Object.entries(featureLabels).map(([featureKey, label]) => (
            <motion.li
              key={featureKey}
              className="flex items-center"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.1 * Object.keys(featureLabels).indexOf(featureKey),
              }}
            >
              {plan.features[featureKey] ? (
                <svg
                  className="w-5 h-5 mr-3 text-green-500 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 mr-3 text-red-500 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span>{label}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="mt-auto">
        <p className="text-neutral-600 dark:text-neutral-400 text-sm italic">{selectedOption.description}</p>
      </div>
      <motion.button
        onClick={handleChoosePlan}
        className="mt-6 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-all ease-in-out duration-200"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Choose Plan
      </motion.button>
    </motion.div>
  );
}
