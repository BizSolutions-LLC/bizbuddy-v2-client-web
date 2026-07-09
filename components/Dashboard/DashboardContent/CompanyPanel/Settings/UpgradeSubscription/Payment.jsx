// components/Dashboard/DashboardContent/CompanyPanel/Settings/UpgradeSubscription/Payment.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, ShieldCheck, AlertCircle, Building, Sparkles, LockKeyhole } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({ plan, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const { token } = useAuthStore();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    if (plan.price <= 0) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/upgrade`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ planId: plan.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || data.message || "Failed to upgrade subscription.");
          setProcessing(false);
          return;
        }
        toast.message("Subscription upgraded successfully!", {
          icon: <CheckCircle2 className="h-5 w-5 text-orange-500" />,
        });
        setPaymentSuccess(true);
        setTimeout(() => {
          onPaymentSuccess();
        }, 1500);
      } catch (err) {
        setError(err.message || "Payment failed");
        setProcessing(false);
      }
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/create-upgrade-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          amount: plan.price,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || data.message || "Error creating payment intent.");
        setProcessing(false);
        return;
      }
      const clientSecret = data.data.clientSecret;
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });
      if (result.error) {
        setError(result.error.message);
        setProcessing(false);
      } else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        setPaymentSuccess(true);
        toast.message("Payment successful!", {
          icon: <CheckCircle2 className="h-5 w-5 text-orange-500" />,
        });
        setTimeout(() => {
          onPaymentSuccess();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 shadow-md p-6"
      >
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-500 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-bold mb-2 text-green-700 dark:text-green-400">Payment Successful!</h3>
        <p className="text-muted-foreground mb-4">Your subscription has been upgraded successfully.</p>
        <div className="w-full max-w-xs mx-auto h-1.5 bg-green-100 dark:bg-green-900/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500"
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5 }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="rounded-lg border p-4 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-black/10 dark:border-white/10">
            <div className="p-1.5 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
              <Building className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Plan Details</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-muted-foreground">Monthly Price</span>
            <span className="font-medium">${plan.price}/month</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">User Capacity</span>
            <span className="font-medium">{plan.rangeOfUsers}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
              <CreditCard className="h-4 w-4" />
            </div>
            Card Information
          </label>
          <div className="relative">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#424770",
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    "::placeholder": {
                      color: "#aab7c4",
                    },
                    ":-webkit-autofill": {
                      color: "#424770",
                    },
                  },
                  invalid: {
                    color: "#e53e3e",
                    iconColor: "#e53e3e",
                  },
                },
              }}
              className="p-4 border border-black/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-orange-500/50 bg-white dark:bg-black/20 transition-all duration-200"
            />
            <CreditCard className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            <ShieldCheck className="h-3 w-3 mr-1 text-green-500" />
            Your payment information is secure
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="pt-4">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                disabled={!stripe || processing}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white transition-all h-12 rounded-xl font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <LockKeyhole className="h-4 w-4 mr-2" />
                    Confirm Payment (${plan.price})
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Securely process your payment</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </form>
  );
}

export default function UpgradePayment({ plan, onPaymentSuccess }) {
  return (
    <TooltipProvider delayDuration={300}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
          <div className="h-1 w-full bg-orange-500"></div>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
                <Sparkles className="h-5 w-5" />
              </div>
              Upgrade to {plan.name || "Selected"} Plan
            </CardTitle>
            <CardDescription>Complete your payment to upgrade your subscription</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Elements stripe={stripePromise}>
              <PaymentForm plan={plan} onPaymentSuccess={onPaymentSuccess} />
            </Elements>
          </CardContent>
          <CardFooter className="pt-0 pb-6">
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-4">
                <LockKeyhole className="h-3 w-3" />
                All transactions are secure and encrypted
              </p>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}
