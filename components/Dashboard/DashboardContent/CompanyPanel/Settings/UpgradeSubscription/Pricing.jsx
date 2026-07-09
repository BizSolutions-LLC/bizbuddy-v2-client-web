// components/Dashboard/DashboardContent/CompanyPanel/Settings/UpgradeSubscription/Pricing.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronLeft, ChevronRight, Sparkles, Star, Shield, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const featureLabels = {
  timekeeping: "Timekeeping",
  leaves: "Leaves",
  payroll: "Payroll",
  "timekeeping-punch-offline": "Timekeeping Offline",
  "timekeeping-punch-location": "Timekeeping Location",
};

export default function UpgradePricing({ currentPlan, plans, onPlanSelect }) {
  plans.forEach((plan) => {
    if (typeof plan.features === "string") {
      try {
        plan.features = JSON.parse(plan.features);
      } catch {
        plan.features = {};
      }
    }
    if (Array.isArray(plan.options)) {
      plan.options.forEach((opt) => {
        if (typeof opt.features === "string") {
          try {
            opt.features = JSON.parse(opt.features);
          } catch {
            opt.features = {};
          }
        }
      });
    }
  });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const [selectedOptionIndices, setSelectedOptionIndices] = useState({});

  const handlePrevOption = (planName) => {
    setSelectedOptionIndices((prev) => ({
      ...prev,
      [planName]: Math.max(0, (prev[planName] || 0) - 1),
    }));
  };

  const handleNextOption = (planName, maxIndex) => {
    setSelectedOptionIndices((prev) => ({
      ...prev,
      [planName]: Math.min(maxIndex, (prev[planName] || 0) + 1),
    }));
  };

  const hasOptions = plans.length > 0 && plans[0].options;

  const isCurrentOption = (option, planName) => {
    if (!currentPlan) return false;
    return (
      currentPlan.name === planName && currentPlan.rangeOfUsers === option.rangeOfUsers && currentPlan.price === option.price
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2 text-orange-700 dark:text-orange-400">Choose Your Plan</h3>
          <p className="text-muted-foreground">Select the plan that best fits your business needs</p>
        </div>

        {currentPlan && (
          <motion.div variants={item} className="mb-8">
            <Card className="border-2 border-orange-500 shadow-md overflow-hidden dark:border-white/10">
              <div className="h-1 w-full bg-orange-500"></div>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-center mb-2">
                  <CardTitle className="flex items-center text-xl">
                    <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500 mr-2">
                      <Star className="h-5 w-5" />
                    </div>
                    Your Current Plan
                  </CardTitle>
                  <Badge className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 px-3 py-1">Active</Badge>
                </div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold">${currentPlan.price}</span>
                  <span className="text-sm text-muted-foreground ml-2">/ month</span>
                </div>
                <p className="text-sm mt-1 text-muted-foreground">{currentPlan.rangeOfUsers} users</p>
              </CardHeader>
              <CardContent className="pb-6 pt-4">
                <p className="text-sm mb-4">{currentPlan.description}</p>
                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Features:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(featureLabels).map(([featureKey, label]) => (
                      <div
                        key={featureKey}
                        className="flex items-center p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 ${
                            currentPlan.features && currentPlan.features[featureKey]
                              ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                              : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {currentPlan.features && currentPlan.features[featureKey] ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </div>
                        <span className="text-sm">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            if (!plan) return null;

            const optionIndex = selectedOptionIndices[plan.name] || 0;
            const selectedOption =
              hasOptions && plan.options && plan.options.length > 0
                ? plan.options[optionIndex]
                : { ...plan, features: plan.features || {} };

            const isCurrentlySelected = isCurrentOption(selectedOption, plan.name);
            const isPro = plan.name === "Pro";

            return (
              <motion.div key={plan.name} variants={item}>
                <Card
                  className={`h-full transition-all duration-300 hover:shadow-lg border-2 shadow-md overflow-hidden dark:border-white/10 ${
                    isPro ? "border-orange-500/50" : ""
                  }`}
                >
                  <div className={`h-1 w-full ${isPro ? "bg-orange-500" : "bg-neutral-200 dark:bg-neutral-700"}`}></div>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-2">
                      <CardTitle className="flex items-center text-xl">
                        <div
                          className={`p-2 rounded-full ${
                            isPro
                              ? "bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500"
                              : "bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70"
                          } mr-2`}
                        >
                          {isPro ? <Sparkles className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
                        </div>
                        {plan.name}
                      </CardTitle>
                      {isPro && (
                        <Badge className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 px-3 py-1">
                          <Sparkles className="h-3 w-3 mr-1" /> Popular
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-bold">${selectedOption.price}</span>
                      <span className="text-sm text-muted-foreground ml-2">/ month</span>
                    </div>
                    {hasOptions && plan.options && plan.options.length > 1 && (
                      <div className="flex items-center justify-between mt-3 p-1 bg-black/5 dark:bg-white/5 rounded-lg">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handlePrevOption(plan.name)}
                              disabled={optionIndex === 0}
                              className={`p-1 ${
                                isPro
                                  ? "border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                  : ""
                              }`}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Previous option</TooltipContent>
                        </Tooltip>
                        <span className="text-sm font-medium">{selectedOption.rangeOfUsers} users</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleNextOption(plan.name, plan.options.length - 1)}
                              disabled={optionIndex === plan.options.length - 1}
                              className={`p-1 ${
                                isPro
                                  ? "border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                  : ""
                              }`}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Next option</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {!hasOptions && <p className="text-sm mt-1 text-muted-foreground">{selectedOption.rangeOfUsers} users</p>}
                  </CardHeader>
                  <CardContent className="pb-6 pt-4">
                    <p className="text-sm mb-4">{selectedOption.description || plan.description}</p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium mb-2">Features:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(featureLabels).map(([featureKey, label]) => (
                          <div
                            key={featureKey}
                            className="flex items-center p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
                          >
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 ${
                                selectedOption.features && selectedOption.features[featureKey]
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {selectedOption.features && selectedOption.features[featureKey] ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </div>
                            <span className="text-sm">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 pb-6">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => onPlanSelect(selectedOption)}
                          className={`w-full rounded-xl font-semibold h-auto py-2.5 ${
                            isPro
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : "border border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                          }`}
                          disabled={isCurrentlySelected}
                        >
                          {isCurrentlySelected ? (
                            "Current Plan"
                          ) : currentPlan && currentPlan.name === plan.name ? (
                            <>Change User Range</>
                          ) : (
                            <>
                              {isPro ? <Zap className="mr-2 h-4 w-4" /> : null}
                              Upgrade to {plan.name}
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isCurrentlySelected
                          ? "This is your current plan"
                          : currentPlan && currentPlan.name === plan.name
                          ? "Change the number of users in your current plan"
                          : `Upgrade to the ${plan.name} plan with ${selectedOption.rangeOfUsers} users`}
                      </TooltipContent>
                    </Tooltip>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
