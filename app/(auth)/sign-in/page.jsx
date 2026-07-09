// app/(auth)/sign-in/page.jsx

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Shield, UserCheck, User, Eye, EyeOff, Check } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import Footer from "@/components/Partial/Footer";
import { motion } from "framer-motion";

export default function SignInPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [users, setUsers] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/account/get-user-email?email=${encodeURIComponent(
          formData.email.trim().toLowerCase()
        )}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Error checking email");
        setLoading(false);
        return;
      }

      if (!data.hasActiveAccounts || data.data.length === 0) {
        setError("No active accounts found for this email.");
        setLoading(false);
        return;
      }

      setUsers(data.data);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  const handleCompanySelect = (companyId) => {
    setSelectedCompanyId(companyId);
    setError("");
  };

  const handleSignInWithPassword = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !selectedCompanyId) {
      setError("Email, password, and company selection are required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          companyId: selectedCompanyId,
        }),
      });
      const data = await res.json();

      if (res.status === 403) {
        setError("Your account is inactive. Please contact your administrator to reactivate your account.");
        setLoading(false);
        return;
      }

      if (res.status !== 200 || !data.data?.token) {
        setError(data.message || "Invalid credentials.");
        setLoading(false);
        return;
      }

      login(data.data.token);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    }
    setLoading(false);
  };

  const handleForgotPassword = () => {
    const params = new URLSearchParams({ email: formData.email.trim().toLowerCase() });
    router.push(`/reset-password?${params.toString()}`);
  };

  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case "superadmin": return <Crown className="h-4 w-4" />;
      case "admin":      return <Shield className="h-4 w-4" />;
      case "supervisor": return <UserCheck className="h-4 w-4" />;
      default:           return <User className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role) => {
    switch (role?.toLowerCase()) {
      case "superadmin": return "Super Admin";
      case "admin":      return "Admin";
      case "supervisor": return "Supervisor";
      default:           return "Employee";
    }
  };

  const ErrorBanner = ({ message }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span>{message}</span>
    </div>
  );

  const Spinner = () => (
    <svg className="animate-spin h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const ArrowRight = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );

  return (
    <motion.div
      className="min-h-[calc(100vh-4rem)] flex flex-col bg-white dark:bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 w-full">

        {/* Heading */}
        <motion.div
          className="w-full max-w-md sm:max-w-lg text-center mb-8"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-orange-600 dark:text-orange-500">Welcome Back</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-sm sm:text-base">Sign in to access your account</p>
        </motion.div>

        {/* Step indicators */}
        <motion.div
          className="w-full max-w-md sm:max-w-lg mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-center gap-3">
            <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${step === 1 ? "bg-orange-500" : "bg-green-500"}`} />
            <div className={`h-0.5 w-10 rounded-full transition-colors duration-300 ${step === 2 ? "bg-orange-500" : step > 2 ? "bg-green-500" : "bg-neutral-200 dark:bg-neutral-700"}`} />
            <div className={`w-3 h-3 rounded-full transition-colors duration-300 ${step === 2 ? "bg-orange-500" : step > 2 ? "bg-green-500" : "bg-neutral-200 dark:bg-neutral-700"}`} />
          </div>
        </motion.div>

        {/* Step 1: Email */}
        {step === 1 && (
          <motion.form
            onSubmit={handleEmailSubmit}
            className="w-full max-w-md sm:max-w-lg space-y-5 bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-800"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl font-semibold text-neutral-800 dark:text-neutral-100">Enter your email</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">We&apos;ll look up the accounts linked to this email.</p>
            </div>

            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 transition-all duration-200 text-base placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <><Spinner /> Processing...</> : <>Continue <ArrowRight /></>}
            </button>

            {error && <ErrorBanner message={error} />}

            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-3">Don&apos;t have an account?</p>
              <button
                type="button"
                onClick={() => router.push("/pricing")}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-base border-2 border-orange-400 dark:border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200"
              >
                Create one here <ArrowRight />
              </button>
            </div>
          </motion.form>
        )}

        {/* Step 2: Select company + password */}
        {step === 2 && (
          <motion.div
            className="w-full max-w-md sm:max-w-lg bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-800 space-y-6"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Back + email pill */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm font-medium flex-shrink-0 transition-colors duration-150"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back
              </button>
              <div className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-xs text-neutral-500 dark:text-neutral-300 truncate min-w-0 max-w-[200px] sm:max-w-xs border border-neutral-200 dark:border-neutral-700">
                {formData.email}
              </div>
            </div>

            {/* Company selection */}
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold text-neutral-800 dark:text-neutral-100 mb-0.5">Select your company</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Choose the account you want to sign in to</p>

              <div className="space-y-2 max-h-[240px] sm:max-h-[280px] overflow-y-auto pr-0.5">
                {users.map((u) => (
                  <button
                    key={u.companyId}
                    onClick={() => handleCompanySelect(u.companyId)}
                    disabled={loading}
                    className={`w-full p-3.5 rounded-xl transition-all duration-200 flex items-center gap-3 text-left
                      ${loading ? "opacity-70 cursor-not-allowed" : ""}
                      ${selectedCompanyId === u.companyId
                        ? "bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 shadow-sm"
                        : "bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/30 dark:hover:bg-orange-900/10"
                      }`}
                  >
                    <span className={`p-2.5 rounded-lg flex-shrink-0 ${
                      selectedCompanyId === u.companyId
                        ? "bg-orange-100 dark:bg-orange-800/50 text-orange-600 dark:text-orange-400"
                        : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                    }`}>
                      {getRoleIcon(u.role)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${
                        selectedCompanyId === u.companyId
                          ? "text-orange-700 dark:text-orange-400"
                          : "text-neutral-800 dark:text-neutral-100"
                      }`}>
                        {u.companyName || "No Name"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs truncate ${
                          selectedCompanyId === u.companyId
                            ? "text-orange-500/80 dark:text-orange-400/70"
                            : "text-neutral-400 dark:text-neutral-500"
                        }`}>
                          {u.username}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          selectedCompanyId === u.companyId
                            ? "bg-orange-100 dark:bg-orange-800/40 text-orange-600 dark:text-orange-400"
                            : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                        }`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </div>
                    </div>

                    {selectedCompanyId === u.companyId && (
                      <Check className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Password form */}
            {selectedCompanyId && (
              <motion.form
                onSubmit={handleSignInWithPassword}
                className="space-y-4"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-3.5 pr-11 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400 transition-all duration-200 text-base"
                      required
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline transition-colors duration-200"
                  >
                    Forgot your password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl font-bold text-base text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <><Spinner /> Signing in...</> : <>Sign In <ArrowRight /></>}
                </button>
              </motion.form>
            )}

            {error && <ErrorBanner message={error} />}
          </motion.div>
        )}
      </div>

      <Footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6" />
    </motion.div>
  );
}
