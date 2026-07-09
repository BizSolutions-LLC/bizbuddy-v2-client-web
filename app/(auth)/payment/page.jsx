// app/(auth)/payment/page.jsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Footer from "@/components/Partial/Footer";
import { motion } from "framer-motion";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ planId, planPrice, email, companyName, onPaymentSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          email,
          companyName,
          amount: planPrice,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || data.message || "Error creating payment intent.");
        setProcessing(false);
        return;
      }

      if (data.data.clientSecret === null) {
        localStorage.setItem("paymentStatus", "paid");
        onPaymentSuccess();
        setProcessing(false);
        return;
      }

      const clientSecret = data.data.clientSecret;
      setClientSecret(clientSecret);
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: { name: companyName, email },
        },
      });
      if (result.error) {
        setError(result.error.message);
        setProcessing(false);
      } else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        localStorage.setItem("paymentStatus", "paid");
        onPaymentSuccess();
        setProcessing(false);
      }
    } catch (err) {
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      <div className="space-y-2">
        <label htmlFor="card-element" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Card Details
        </label>
        <div className="p-4 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus-within:ring-2 focus-within:ring-orange-500/50 transition-all duration-200">
          <CardElement
            id="card-element"
            options={{
              hidePostalCode: true,
              style: {
                base: {
                  color: "#32325d",
                  fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                  fontSmoothing: "antialiased",
                  fontSize: "16px",
                  "::placeholder": {
                    color: "#aab7c4",
                  },
                },
                invalid: {
                  color: "#fa755a",
                  iconColor: "#fa755a",
                },
              },
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {processing ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing Payment...
          </>
        ) : (
          <>
            Complete Payment
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}
    </form>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const [plan, setPlan] = useState(null);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const storedPlan = localStorage.getItem("selectedPlan");
    if (storedPlan) {
      setPlan(JSON.parse(storedPlan));
    }

    const storedUser = localStorage.getItem("userForm");
    const storedCompany = localStorage.getItem("companyForm");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.email) {
          setEmail(user.email);
        }
      } catch (err) {
        console.error("Error parsing userForm from localStorage:", err);
      }
    }
    if (storedCompany) {
      try {
        const company = JSON.parse(storedCompany);
        if (company.name) {
          setCompanyName(company.name);
        }
      } catch (err) {
        console.error("Error parsing companyForm from localStorage:", err);
      }
    }
  }, []);

  const handlePaymentSuccess = () => {
    router.push("/sign-up");
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-orange-50 to-white dark:from-neutral-950 dark:to-neutral-900"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div
          className="max-w-md mx-auto mb-8 text-center"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-500">Complete Your Payment</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Secure payment for your subscription</p>
        </motion.div>

        <motion.div
          className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {plan ? (
            <div className="mb-6">
              <div className="p-6 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/10 border border-orange-200 dark:border-orange-800/30">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-lg text-orange-600 dark:text-orange-400">{plan.name} Plan</span>
                  <span className="text-xl font-bold">${plan.price}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-neutral-700 dark:text-neutral-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p>{plan.rangeOfUsers} users</p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 pl-7">{plan.description}</p>
                </div>
              </div>

              <div className="flex flex-col space-y-1 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Email:</span>
                  <span className="font-medium">{email || "Not provided"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Company:</span>
                  <span className="font-medium">{companyName || "Not provided"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 rounded-xl bg-neutral-50 dark:bg-neutral-700 border border-dashed border-neutral-300 dark:border-neutral-600 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-neutral-600 dark:text-neutral-400 mt-4">No plan selected.</p>
              <button type="button" onClick={() => router.push("/pricing")} className="mt-4 text-orange-600 dark:text-orange-400 underline text-sm">
                Browse Available Plans
              </button>
            </div>
          )}

          {(!email || !companyName) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 p-4 rounded-lg text-sm flex items-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Missing user email or company name. Please complete your sign-up details.</span>
            </div>
          )}

          <Elements stripe={stripePromise}>
            {plan && email && companyName && (
              <CheckoutForm planId={plan.id} planPrice={plan.price} email={email} companyName={companyName} onPaymentSuccess={handlePaymentSuccess} />
            )}
          </Elements>

          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Secured by Stripe
          </div>
        </motion.div>

        <motion.div className="max-w-md mx-auto mt-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <button
            onClick={() => router.push("/sign-up")}
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm flex items-center justify-center mx-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Return to Sign Up
          </button>
        </motion.div>
      </div>
      <Footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6" />
    </motion.div>
  );
}
