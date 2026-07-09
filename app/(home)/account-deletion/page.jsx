"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Shield, Trash2, AlertTriangle, X } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function AccountDeletionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState({ firstName: "", lastName: "" });
  
  const [resendTimer, setResendTimer] = useState(0);
  const [canResend, setCanResend] = useState(true);

  const expectedConfirmation = `Yes, I confirm to delete ${userData.firstName} ${userData.lastName} account.`;

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmailSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account-deletion/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.message("Verification code sent to your email");
        setStep(2);
        
        setResendTimer(180);
        setCanResend(false);
      } else {
        toast.message(data.message || "Failed to send verification code");
        setError(data.message || "Failed to send verification code");
      }
    } catch (error) {
      console.error("Error sending code:", error);
      toast.message("Something went wrong. Please try again.");
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account-deletion/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.data) {
        setUserData({
          firstName: data.data.user.firstName || "User",
          lastName: data.data.user.lastName || "",
        });
        
        sessionStorage.setItem("verificationToken", data.data.verificationToken);
        
        toast.message("Code verified successfully");
        setShowDeleteModal(true);
      } else {
        toast.message(data.message || "Invalid verification code");
        setError(data.message || "Invalid verification code");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      toast.message("Something went wrong. Please try again.");
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalDelete = async () => {
    setError("");
    setLoading(true);

    try {
      const verificationToken = sessionStorage.getItem("verificationToken");
      
      if (!verificationToken) {
        toast.message("Session expired. Please start over.");
        setShowDeleteModal(false);
        setStep(1);
        setLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account-deletion/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          verificationToken,
          confirmationText: confirmationText.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.message("Account deletion request submitted successfully.");
        sessionStorage.removeItem("verificationToken");
        setShowDeleteModal(false);
        
        setTimeout(() => {
          router.push("/");
        }, 7000);
      } else {
        toast.message(data.message || "Failed to submit request");
        setError(data.message || "Failed to submit request");
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      toast.message("Something went wrong. Please try again.");
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account-deletion/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.message("Verification code resent to your email");
        
        setResendTimer(180);
        setCanResend(false);
      } else {
        toast.message(data.message || "Failed to resend code");
      }
    } catch (error) {
      console.error("Error resending code:", error);
      toast.message("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-screen flex flex-col justify-center relative overflow-hidden bg-gradient-to-br from-neutral-50 via-red-50/20 to-orange-50/30 dark:from-neutral-950 dark:via-red-950/10 dark:to-orange-950/10 py-12">
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(239, 68, 68) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(239, 68, 68) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      ></div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-red-300/15 dark:bg-red-500/10 rounded-full blur-3xl"
        ></motion.div>
        
        <motion.div
          animate={{
            y: [0, 20, 0],
            x: [0, -15, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-300/15 dark:bg-orange-500/10 rounded-full blur-3xl"
        ></motion.div>
      </div>

      <Toaster position="top-center" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-md mx-auto mb-8 text-center"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-500" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-red-600 dark:text-red-500">
              Delete Your Account
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">
              This action cannot be undone. Please verify your identity.
            </p>
          </motion.div>

          <motion.div
            className="max-w-md mx-auto mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center space-x-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  step === 1 ? "bg-red-500" : "bg-green-500"
                }`}
              ></div>
              <div
                className={`h-0.5 w-8 ${
                  step === 2
                    ? "bg-red-500"
                    : step > 2
                    ? "bg-green-500"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              ></div>
              <div
                className={`w-3 h-3 rounded-full ${
                  step === 2
                    ? "bg-red-500"
                    : step > 2
                    ? "bg-green-500"
                    : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              ></div>
            </div>
          </motion.div>

          {step === 1 && (
            <motion.div
              className="space-y-6 max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    <p className="font-semibold mb-1">Warning</p>
                    <p>
                      Deleting your account will permanently remove all your data,
                      including time logs, projects, and settings. This action cannot be
                      reversed.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
                >
                  Enter your email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && email) {
                        e.preventDefault();
                        handleEmailSubmit();
                      }
                    }}
                    className="w-full pl-10 p-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                    required
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                  We'll send a 6-digit verification code to this email.
                </p>
              </div>

              <button
                onClick={handleEmailSubmit}
                disabled={loading || !email}
                className={`w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center ${
                  loading || !email ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending code...
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700 space-y-6"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Back
                </button>
                <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-full text-sm text-neutral-600 dark:text-neutral-300">
                  {email}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <p className="font-semibold mb-1">Code Sent</p>
                    <p>A 6-digit verification code has been sent to {email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="code"
                    className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
                  >
                    Enter 6-digit verification code
                  </label>
                  <input
                    id="code"
                    type="text"
                    name="code"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && verificationCode.length === 6) {
                        e.preventDefault();
                        handleCodeSubmit();
                      }
                    }}
                    className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200 text-center text-2xl tracking-widest font-mono"
                    required
                  />
                  {/* ✅ UPDATE: Show timer or resend button */}
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Didn't receive the code?{" "}
                    {!canResend ? (
                      <span className="text-neutral-600 dark:text-neutral-400 font-mono">
                        Resend in {formatTimer(resendTimer)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={loading || !canResend}
                        className="text-red-600 dark:text-red-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Resend
                      </button>
                    )}
                  </p>
                </div>

                <button
                  onClick={handleCodeSubmit}
                  disabled={loading || verificationCode.length !== 6}
                  className={`w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center ${
                    loading || verificationCode.length !== 6
                      ? "opacity-70 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 flex-shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </div>
              )}
            </motion.div>
          )}

          <AnimatePresence>
            {showDeleteModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setShowDeleteModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 relative">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="absolute top-3 right-3 text-white bg-black/20 hover:bg-black/30 rounded-full p-1 transition-colors"
                      aria-label="Close modal"
                    >
                      <X className="size-5" />
                    </button>
                    <h3 className="text-xl font-bold text-white flex items-center">
                      <Trash2 className="h-5 w-5 mr-2" />
                      Delete {userData.firstName} {userData.lastName} Account
                    </h3>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                      <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-red-800 dark:text-red-300">
                          <p className="font-semibold mb-1">Final Warning</p>
                          <p>
                            This will permanently delete your account and all associated
                            data. This action is irreversible.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        To confirm, type "<span className="font-bold text-red-600 dark:text-red-400">{expectedConfirmation}</span>" in the box below
                      </label>
                      <input
                        type="text"
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && confirmationText === expectedConfirmation) {
                            e.preventDefault();
                            handleFinalDelete();
                          }
                        }}
                        placeholder="Type the confirmation text..."
                        className="w-full p-3 rounded-xl border border-red-300 dark:border-red-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-2 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 px-5 py-3 rounded-xl font-medium text-sm bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleFinalDelete}
                        disabled={
                          loading || confirmationText !== expectedConfirmation
                        }
                        className={`flex-1 px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white transition-all duration-200 flex items-center justify-center ${
                          loading || confirmationText !== expectedConfirmation
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {loading ? (
                          <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          "Delete this account"
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
  );
}