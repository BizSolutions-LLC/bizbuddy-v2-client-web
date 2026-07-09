// app/(auth)/reset-password/confirm/page.jsx

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, CheckCircle, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import Footer from "@/components/Partial/Footer";
import { motion } from "framer-motion";

function ResetPasswordConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [step, setStep] = useState("verifying"); // verifying, form, success, error
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [userData, setUserData] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verify token on component mount
  useEffect(() => {
    if (token === null) return;    
    if (token === "") {
      setStep("error");
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/account/reset-password/verify?token=${token}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setUserData(data.data.user);
        setStep("form");
      } else {
        setStep("error");
        setError(data.message || "Invalid or expired reset link.");
      }
    } catch (err) {
      console.error("Token verification failed:", err);
      setStep("error");
      setError("Failed to verify reset link. Please try again.");
    }
  };

  const handleInputChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/reset-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep("success");
      } else {
        setError(data.message || "Failed to reset password.");
        if (data.expired) {
          // Token expired, show error state
          setStep("error");
        }
      }
    } catch (err) {
      console.error("Password reset failed:", err);
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const passwordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    return strength;
  };

  const getStrengthColor = (strength) => {
    switch (strength) {
      case 0:
      case 1:
        return "bg-red-500";
      case 2:
        return "bg-yellow-500";
      case 3:
        return "bg-blue-500";
      case 4:
        return "bg-green-500";
      default:
        return "bg-neutral-300";
    }
  };

  const getStrengthText = (strength) => {
    switch (strength) {
      case 0:
      case 1:
        return "Weak";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Strong";
      default:
        return "";
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-between bg-white dark:bg-black"
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
          <h2 className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-500">
            {step === "verifying" && "Verifying Reset Link"}
            {step === "form" && "Create New Password"}
            {step === "success" && "Password Reset Complete"}
            {step === "error" && "Reset Link Invalid"}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            {step === "verifying" && "Please wait while we verify your reset link..."}
            {step === "form" && "Enter your new password below"}
            {step === "success" && "Your password has been successfully updated"}
            {step === "error" && "There was a problem with your reset link"}
          </p>
        </motion.div>

        {/* Verifying State */}
        {step === "verifying" && (
          <motion.div
            className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
                <svg className="animate-spin h-8 w-8 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400">Verifying your reset link...</p>
            </div>
          </motion.div>
        )}

        {/* Password Reset Form */}
        {step === "form" && (
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-6 max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {userData.firstName && (
              <div className="text-center mb-6">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Resetting password for: <span className="font-medium text-neutral-900 dark:text-neutral-100">{userData.firstName} {userData.lastName}</span>
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">{userData.email}</p>
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  name="newPassword"
                  placeholder="Enter your new password"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full p-3 pr-10 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.newPassword && (
                <div className="mt-2">
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded ${
                          passwordStrength(formData.newPassword) >= level
                            ? getStrengthColor(passwordStrength(formData.newPassword))
                            : "bg-neutral-200 dark:bg-neutral-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Password strength: {getStrengthText(passwordStrength(formData.newPassword))}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm your new password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full p-3 pr-10 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <p className={`text-xs mt-1 ${
                  formData.newPassword === formData.confirmPassword 
                    ? "text-green-600 dark:text-green-400" 
                    : "text-red-600 dark:text-red-400"
                }`}>
                  {formData.newPassword === formData.confirmPassword ? "Passwords match" : "Passwords don't match"}
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating Password...
                </>
              ) : (
                <>
                  Update Password
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>

            {error && (
              <motion.div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </motion.form>
        )}

        {/* Success State */}
        {step === "success" && (
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
                Password Updated Successfully!
              </h3>
              
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>

              <button
                onClick={() => router.push("/sign-in")}
                className="w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center"
              >
                Continue to Sign In
                <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {step === "error" && (
          <motion.div
            className="max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700 space-y-6"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                Reset Link Invalid
              </h3>
              
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                {error}
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push("/reset-password")}
                  className="w-full px-5 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center"
                >
                  Request New Reset Link
                  <ArrowRight className="h-4 w-4 ml-1" />
                </button>
                
                <button
                  onClick={() => router.push("/sign-in")}
                  className="w-full text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium text-sm flex items-center justify-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Sign In
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
      <Footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6" />
    </motion.div>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    }>
      <ResetPasswordConfirmContent />
    </Suspense>
  );
}