// components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanySubscription.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState, useRef } from "react";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building,
  Calendar,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  ArrowUp,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  RefreshCcw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UpgradePricing from "./UpgradeSubscription/Pricing";
import UpgradePayment from "./UpgradeSubscription/Payment";

export default function CompanySubscription() {
  const { token } = useAuthStore();
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [groupedPlans, setGroupedPlans] = useState({});

  const upgradeContentRef = useRef(null);
  const pricingRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    async function fetchProfile() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data && data.data) {
          const { user, company, subscription } = data.data;
          if (company.userId !== user.id) {
            setError("Access denied. Only the company owner can manage subscriptions.");
            toast.message("Access denied. Only the company owner can manage subscriptions.", {
              icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              duration: 5000,
            });
            setLoading(false);
            return;
          }
          setCompany(company);
          setSubscription(subscription);
        } else {
          setError("Failed to retrieve profile data.");
          toast.message("Failed to retrieve profile data.", {
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
            duration: 5000,
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to fetch profile.");
        toast.message("Failed to fetch profile.", {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [token]);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscription-plans`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok && data.data) {
          setPlans(data.data);

          const grouped = {};
          data.data.forEach((plan) => {
            if (!grouped[plan.name]) {
              grouped[plan.name] = {
                ...plan,
                options: [],
              };
            }
            grouped[plan.name].options.push({
              id: plan.id,
              price: plan.price,
              rangeOfUsers: plan.rangeOfUsers,
              description: plan.description,
              features: plan.features,
            });
          });
          Object.keys(grouped).forEach((planName) => {
            grouped[planName].options.sort((a, b) => {
              const aLow = Number(a.rangeOfUsers.split("-")[0]);
              const bLow = Number(b.rangeOfUsers.split("-")[0]);
              return aLow - bLow;
            });
          });
          setGroupedPlans(Object.values(grouped));
        } else {
          toast.message(data.message || "Failed to fetch subscription plans.", {
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
            duration: 5000,
          });
        }
      } catch (err) {
        console.error("Error fetching subscription plans:", err);
        toast.message("Failed to fetch subscription plans.", {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          duration: 5000,
        });
      }
    }
    fetchPlans();
  }, []);

  useEffect(() => {
    if (showUpgrade && pricingRef.current) {
      const timer = setTimeout(() => {
        pricingRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showUpgrade]);

  const handleUpgradeClick = () => {
    setShowUpgrade(true);
  };

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setTimeout(() => {
      if (upgradeContentRef.current) {
        upgradeContentRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 300);
  };

  const handleBackToPlans = () => {
    setSelectedPlan(null);
    setTimeout(() => {
      if (pricingRef.current) {
        pricingRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 300);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handlePaymentSuccess = async () => {
    if (selectedPlan) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/upgrade`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.message(data.message || "Failed to upgrade subscription.", {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          duration: 5000,
        });
        return;
      }
    }
    toast.message("Subscription upgraded successfully!", {
      icon: <CheckCircle2 className="h-5 w-5 text-orange-500" />,
    });
    setShowUpgrade(false);
    setSelectedPlan(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data && data.data) {
        setSubscription(data.data.subscription);
      }
    } catch (error) {
      console.error("Error refetching profile after upgrade:", error);
    }
    scrollToTop();
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-orange-500" />
            Company Subscription
          </h2>
        </div>
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </CardContent>
        </Card>
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-orange-500" />
            Company Subscription
          </h2>
        </div>
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-red-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-500">
                <AlertCircle className="h-5 w-5" />
              </div>
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
          <CardFooter className="pt-2 pb-6">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
        <Toaster position="top-center" />

        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-orange-500" />
            Company Subscription
          </h2>
        </div>

        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
                <Building className="h-5 w-5" />
              </div>
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border p-4 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Company ID</p>
                <p className="font-medium text-lg">{company.id}</p>
              </div>
              <div className="rounded-lg border p-4 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                <p className="text-sm text-muted-foreground mb-1">Company Name</p>
                <p className="font-medium text-lg">{company.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
                <CreditCard className="h-5 w-5" />
              </div>
              Subscription Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {subscription ? (
              <div className="flex flex-col space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center">
                    <Badge className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 mr-2 px-3 py-1">
                      {subscription.plan.name} Plan
                    </Badge>
                    <span className="text-sm text-muted-foreground">{subscription.plan.rangeOfUsers} users</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="rounded-lg border p-3 flex items-center gap-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Start Date</p>
                        <p className="text-sm font-medium">{new Date(subscription.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {subscription.endDate && (
                      <div className="rounded-lg border p-3 flex items-center gap-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">End Date</p>
                          <p className="text-sm font-medium">{new Date(subscription.endDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 bg-orange-500/10 border-orange-500/30 dark:bg-orange-500/20 dark:border-orange-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-full bg-white text-orange-500 dark:bg-black/50 dark:text-orange-500">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="font-medium">Plan Features</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.plan.description || "Access to premium features"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-full bg-white text-black/70 dark:bg-black/50 dark:text-white/70">
                        <Building className="h-4 w-4" />
                      </div>
                      <p className="font-medium">User Capacity</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{subscription.plan.rangeOfUsers} users</p>
                  </div>
                  <div className="rounded-lg border p-4 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-full bg-white text-black/70 dark:bg-black/50 dark:text-white/70">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <p className="font-medium">Billing</p>
                    </div>
                    <p className="text-sm text-muted-foreground">${subscription.plan.price}/month per plan</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div className="w-16 h-16 bg-white dark:bg-black/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="h-8 w-8 text-orange-500" />
                </div>
                <p className="text-muted-foreground mb-4">No active subscription found for your company.</p>
                <Button onClick={handleUpgradeClick} className="bg-orange-500 hover:bg-orange-600 text-white">
                  Get Started
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
                <Sparkles className="h-5 w-5" />
              </div>
              Upgrade Subscription
            </CardTitle>
            <CardDescription>Upgrade your plan to access more features and increase user limits</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <AnimatePresence mode="wait">
              {!showUpgrade ? (
                <motion.div key="upgrade-button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleUpgradeClick}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Upgrade Subscription
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View available plans and upgrade options</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ) : (
                <motion.div
                  key="upgrade-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4"
                  ref={pricingRef}
                >
                  {!selectedPlan ? (
                    <UpgradePricing
                      currentPlan={subscription?.plan}
                      plans={groupedPlans.length > 0 ? groupedPlans : plans}
                      onPlanSelect={handlePlanSelect}
                    />
                  ) : (
                    <div className="space-y-4" ref={upgradeContentRef}>
                      <div className="flex items-center">
                        <Button
                          variant="outline"
                          onClick={handleBackToPlans}
                          className="mb-4 flex items-center gap-1 border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Back to plans
                        </Button>
                      </div>
                      <UpgradePayment plan={selectedPlan} onPaymentSuccess={handlePaymentSuccess} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="border dark:border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Subscription Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Premium Support</p>
                <p className="text-sm font-medium">24/7 Access</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Data Storage</p>
                <p className="text-sm font-medium">Unlimited</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Feature Updates</p>
                <p className="text-sm font-medium">Priority Access</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {showUpgrade && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-6 right-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={scrollToTop}
                  size="icon"
                  className="rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl w-12 h-12"
                >
                  <ArrowUp className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Scroll to top</p>
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
}
