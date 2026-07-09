// app/(auth)/reset-password/page.jsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Mail, Clock, CheckCircle, ArrowRight, ArrowLeft, Crown, Shield, UserCheck, User } from "lucide-react";
import Footer from "@/components/Partial/Footer";
import { motion } from "framer-motion";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // step: "email" | "select" | "sent"
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // Pre-fill email from query param (passed from sign-in page)
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  // Resend countdown timer
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
  };

  const getRoleIcon = (role) => {
    switch ((role || "").toLowerCase()) {
      case "superadmin": return <Crown className="h-4 w-4" />;
      case "admin":      return <Shield className="h-4 w-4" />;
      case "supervisor": return <UserCheck className="h-4 w-4" />;
      default:           return <User className="h-4 w-4" />;
    }
  };

  // Step 1 — look up accounts for this email
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/account/get-user-email?email=${encodeURIComponent(
          email.trim().toLowerCase()
        )}`
      );
      const data = await res.json();

      if (!res.ok || !data.hasActiveAccounts || data.data.length === 0) {
        // Return a vague message to prevent email enumeration
        setStep("sent");
        setResendTimer(180);
        setCanResend(false);
        setLoading(false);
        return;
      }

      setAccounts(data.data);

      // If only one account, skip the selector and send immediately
      if (data.data.length === 1) {
        await sendResetLink(data.data[0].userId);
        return;
      }

      setStep("select");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  // Step 1.5 — user picked a company, send reset for that specific account
  const handleAccountSelect = async (userId) => {
    setSelectedUserId(userId);
    setError("");
    await sendResetLink(userId);
  };

  // Shared send logic
  const sendResetLink = async (userId) => {
    setLoading(true);

    // Always move to "sent" after a short delay regardless of outcome
    // (prevents email enumeration via timing)
    setTimeout(() => {
      setStep("sent");
      setResendTimer(180);
      setCanResend(false);
      setLoading(false);
    }, 1500);

    try {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          userId,
        }),
      });
    } catch (err) {
      console.error("Reset password API call failed:", err);
    }
  };

  // Resend — reuse the same userId that was selected
  const handleResendEmail = async () => {
    if (!canResend || !selectedUserId) return;
    setError("");
    await sendResetLink(selectedUserId);
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-between bg-white dark:bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <motion.div
          className="max-w-md mx-auto mb-8 text-center"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-500">
            {step === "email"  && "Reset Password"}
            {step === "select" && "Select Account"}
            {step === "sent"   && "Check Your Email"}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            {step === "email"  && "Enter your email address and we'll send you a reset link"}
            {step === "select" && "Choose which account you want to reset the password for"}
            {step === "sent"   && "We've sent password reset instructions to your email"}
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div
          className="max-w-md mx-auto mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-center space-x-2">
            {/* Dot 1 */}
            <div className={`w-3 h-3 rounded-full ${step === "email" ? "bg-orange-500" : "bg-green-500"}`} />
            {/* Line 1-2 */}
            <div className={`h-0.5 w-8 ${step !== "email" ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
            {/* Dot 2 */}
            <div className={`w-3 h-3 rounded-full ${
              step === "select" ? "bg-orange-500" :
              step === "sent"   ? "bg-green-500"  :
              "bg-neutral-300 dark:bg-neutral-700"
            }`} />
            {/* Line 2-3 */}
            <div className={`h-0.5 w-8 ${step === "sent" ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
            {/* Dot 3 */}
            <div className={`w-3 h-3 rounded-full ${step === "sent" ? "bg-green-500" : "bg-neutral-300 dark:bg-neutral-700"}`} />
          </div>
        </motion.div>

        {step === "email" && (
          <motion.form
            onSubmit={handleEmailSubmit}
            className="space-y-6 max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200"
                required
              />
              {searchParams.get("email") && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Pre-filled from your sign-in attempt. You can change this if needed.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Looking up accounts...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>

            {error && <ErrorBox message={error} />}

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center">Remember your password?</p>
              <button
                type="button"
                onClick={() => router.push("/sign-in")}
                className="w-full mt-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium text-sm flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </button>
            </div>
          </motion.form>
        )}

        {step === "select" && (
          <motion.div
            className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700 space-y-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep("email"); setAccounts([]); setSelectedUserId(""); }}
                className="flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm text-neutral-600 dark:text-neutral-300">
                {email}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-1">Which account needs a reset?</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                We found multiple accounts for this email. Select the one you'd like to reset.
              </p>

              <div className="bg-neutral-50 dark:bg-neutral-700 rounded-xl p-3">
                <div className="flex justify-between items-center w-full text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase border-b border-neutral-200 dark:border-neutral-600 pb-2 mb-2">
                  <span>Company</span>
                  <span>Username</span>
                  <span>Role</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.userId}
                      onClick={() => handleAccountSelect(acc.userId)}
                      disabled={loading}
                      className={`w-full p-3 text-sm font-medium flex items-center justify-between rounded-lg transition-all duration-200 ${
                        loading ? "opacity-70 cursor-not-allowed" : "hover:bg-neutral-100 dark:hover:bg-neutral-600"
                      } ${
                        selectedUserId === acc.userId
                          ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-l-4 border-orange-500"
                          : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{acc.companyName || "No Name"}</span>
                        <span className="text-neutral-600 dark:text-neutral-400">{acc.username}</span>
                        <span className={`p-1.5 rounded-full ${
                          selectedUserId === acc.userId
                            ? "bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-400"
                            : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                        }`}>
                          {getRoleIcon(acc.role)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                <svg className="animate-spin h-4 w-4 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending reset link...
              </div>
            )}

            {error && <ErrorBox message={error} />}
          </motion.div>
        )}

        {step === "sent" && (
          <motion.div
            className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700 space-y-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <motion.div
                className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </motion.div>

              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Email Sent Successfully!
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                We've sent password reset instructions to:
              </p>
              <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {email}
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-orange-800 dark:text-orange-200 font-medium mb-1">Check your email</p>
                  <p className="text-orange-700 dark:text-orange-300">
                    Click the reset link in your email to create a new password. The link will expire in 5 minutes.
                  </p>
                </div>
              </div>
            </div>

            {/* Resend */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center mb-3">
                Didn't receive the email?
              </p>
              {resendTimer > 0 ? (
                <div className="flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
                  <Clock className="h-4 w-4 mr-2" />
                  Resend available in {formatTimer(resendTimer)}
                </div>
              ) : (
                <button
                  onClick={handleResendEmail}
                  disabled={loading}
                  className={`w-full px-4 py-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium text-sm border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200 ${
                    loading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Sending..." : "Resend Email"}
                </button>
              )}
            </div>

            {error && <ErrorBox message={error} />}

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => router.push("/sign-in")}
                className="w-full text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium text-sm flex items-center justify-center"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <Footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6" />
    </motion.div>
  );
}

function ErrorBox({ message }) {
  return (
    <motion.div
      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </motion.div>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}