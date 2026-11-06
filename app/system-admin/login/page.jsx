// app/system-admin/login/page.jsx
//
// BB-110: system-admin sign-in with 2FA.
//   password → (first time) setup: scan QR + first code → save recovery codes
//            → (enrolled)   verify: authenticator code or a recovery code

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, User, Eye, EyeOff, Terminal, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { systemAdminFetch, setSystemAdminToken, RECOVERY_LEFT_KEY, LOGIN_NOTICE_KEY } from "@/lib/systemAdminFetch";
import RecoveryCodes from "@/components/system-admin/RecoveryCodes";

const LOCKED_MESSAGE = "Too many failed attempts. Try again in 15 minutes.";

const groupInFours = (secret = "") => (secret.match(/.{1,4}/g) || []).join(" ");

export default function SystemAdminLoginPage() {
  const router = useRouter();
  // "password" | "setup" | "verify" | "codes"
  const [step, setStep] = useState("password");
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [mfa, setMfa] = useState({ mfaToken: "", secret: "", otpauthUrl: "" });
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  // One-off message from another page, e.g. "Password changed. Please sign in again."
  useEffect(() => {
    try {
      const message = sessionStorage.getItem(LOGIN_NOTICE_KEY);
      if (message) {
        setNotice(message);
        sessionStorage.removeItem(LOGIN_NOTICE_KEY);
      }
    } catch {}
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const backToPassword = (message = "") => {
    setStep("password");
    setMfa({ mfaToken: "", secret: "", otpauthUrl: "" });
    setFormData((prev) => ({ ...prev, password: "" }));
    setCode("");
    setUseRecovery(false);
    setError(message);
  };

  // Shared error handling for every step
  const handleError = (err) => {
    if (err.code === "ADMIN_LOCKED") return setError(LOCKED_MESSAGE);
    if (err.code === "MFA_TOKEN_INVALID") return backToPassword("Your sign-in step expired.");
    if (err.code === "MFA_INVALID_CODE") {
      setCode("");
      return setError(err.message);
    }
    if (err.code === "INVALID_CREDENTIALS") return setError("Invalid username or password.");
    setError(err.message || "An error occurred. Please try again.");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await systemAdminFetch("/api/system-admin/auth/login", {
        method: "POST",
        body: { username: formData.username.trim(), password: formData.password },
        redirectOn401: false,
      });
      if (data.mfaSetupRequired) {
        setMfa({ mfaToken: data.mfaToken, secret: data.secret, otpauthUrl: data.otpauthUrl });
        setStep("setup");
      } else if (data.mfaRequired) {
        setMfa({ mfaToken: data.mfaToken, secret: "", otpauthUrl: "" });
        setStep("verify");
      } else {
        setError("Unexpected sign-in response. Please try again.");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await systemAdminFetch("/api/system-admin/auth/2fa/setup", {
        method: "POST",
        body: { mfaToken: mfa.mfaToken, code },
        redirectOn401: false,
      });
      setSystemAdminToken(data.token);
      setRecoveryCodes(data.recoveryCodes || []);
      setStep("codes");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await systemAdminFetch("/api/system-admin/auth/2fa/verify", {
        method: "POST",
        body: useRecovery
          ? { mfaToken: mfa.mfaToken, recoveryCode: code.trim() }
          : { mfaToken: mfa.mfaToken, code },
        redirectOn401: false,
      });
      setSystemAdminToken(data.token);
      try {
        if (typeof data.recoveryCodesRemaining === "number" && data.recoveryCodesRemaining <= 3) {
          sessionStorage.setItem(RECOVERY_LEFT_KEY, String(data.recoveryCodesRemaining));
        } else {
          sessionStorage.removeItem(RECOVERY_LEFT_KEY);
        }
      } catch {}
      router.push("/system-admin/dashboard");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const switchCodeMode = () => {
    setUseRecovery((prev) => !prev);
    setCode("");
    setError("");
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-neutral-300 bg-white text-neutral-900 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200";

  const submitClass = `w-full px-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center ${
    loading ? "opacity-70 cursor-not-allowed" : ""
  }`;

  const BackLink = () => (
    <button
      type="button"
      onClick={() => backToPassword()}
      className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  const CodeInput = () =>
    useRecovery ? (
      <input
        id="mfa-code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`${inputClass} font-mono`}
        autoComplete="off"
        autoFocus
        required
      />
    ) : (
      <input
        id="mfa-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${inputClass} font-mono text-center text-lg tracking-[0.5em]`}
        autoFocus
        required
      />
    );

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="max-w-md w-full"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mb-4 shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring" }}
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">System Administrator</h1>
          <p className="text-neutral-600 flex items-center justify-center gap-2">
            <Terminal className="w-4 h-4" />
            Restricted Access · Authorized Personnel Only
          </p>
        </div>

        <motion.div
          className="bg-white rounded-2xl shadow-xl p-8 border border-neutral-200"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Step 1: password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              {notice && !error && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm" role="status">
                  {notice}
                </div>
              )}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-neutral-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    id="username"
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={`${inputClass} pl-10`}
                    placeholder="Enter system username"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`${inputClass} pl-10 pr-12`}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Authenticating...</> : "Continue"}
              </button>
            </form>
          )}

          {/* Step 2a: first-time 2FA setup */}
          {step === "setup" && (
            <form onSubmit={handleSetupSubmit} className="space-y-5">
              <BackLink />
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-neutral-900">Set up two-factor authentication</h2>
                <p className="text-sm text-neutral-600">
                  Scan with Google Authenticator, Microsoft Authenticator, Authy or 1Password, then enter the 6-digit code.
                </p>
              </div>

              <div className="flex justify-center rounded-xl border border-neutral-200 bg-white p-4">
                <QRCodeSVG value={mfa.otpauthUrl} size={176} marginSize={1} />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Can&apos;t scan? Enter this key in your app.</p>
                <p className="rounded-lg bg-neutral-100 px-3 py-2 text-center font-mono text-sm tracking-wider text-neutral-900 break-all select-all">
                  {groupInFours(mfa.secret)}
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-neutral-700 mb-2">
                  6-digit code
                </label>
                {CodeInput()}
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Verifying...</> : "Turn on two-factor authentication"}
              </button>
            </form>
          )}

          {/* Step 2b: enter a code */}
          {step === "verify" && (
            <form onSubmit={handleVerifySubmit} className="space-y-5">
              <BackLink />
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-neutral-900">Enter your authentication code</h2>
                <p className="text-sm text-neutral-600">
                  {useRecovery
                    ? "Enter one of your saved recovery codes. Each code works once."
                    : "Open your authenticator app and enter the 6-digit code for BizBuddy."}
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className="block text-sm font-medium text-neutral-700 mb-2">
                  {useRecovery ? "Recovery code" : "6-digit code"}
                </label>
                {CodeInput()}
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Verifying...</> : "Verify"}
              </button>

              <button
                type="button"
                onClick={switchCodeMode}
                className="w-full text-center text-sm text-orange-600 hover:text-orange-700 hover:underline"
              >
                {useRecovery ? "Use your authenticator app instead" : "Use a recovery code instead"}
              </button>
            </form>
          )}

          {/* After setup: recovery codes, shown once */}
          {step === "codes" && (
            <RecoveryCodes
              codes={recoveryCodes}
              username={formData.username.trim()}
              continueLabel="Continue to dashboard"
              onContinue={() => router.push("/system-admin/dashboard")}
            />
          )}

          {/* Warning */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <div className="flex items-start gap-2 text-xs text-neutral-500">
              <Lock className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>Unauthorized access is prohibited and monitored. All activity is logged and audited.</p>
            </div>
          </div>
        </motion.div>

        <p className="text-center mt-6 text-neutral-500 text-xs">BizBuddy System Administration v1.0</p>
      </motion.div>
    </motion.div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm" role="alert">
      {message}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
