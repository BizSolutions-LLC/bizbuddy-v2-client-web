// app/system-admin/login/page.jsx
//
// BB-110: system-admin sign-in with 2FA.
//   password → (first time) setup: scan QR + first code → save recovery codes
//            → (enrolled)   verify: authenticator code or a recovery code
// BB-118 (redo): simplified look — logo only, plain card, no entrance
// animations, shorter copy. Light-only, neutral greys like the rest of /system-admin.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
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
    "w-full h-10 px-3 rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-colors";

  const labelClass = "block text-sm font-medium text-neutral-700 mb-1.5";

  const submitClass = `w-full h-10 rounded-md text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center justify-center ${
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
        className={`${inputClass} font-mono text-center text-base tracking-[0.5em]`}
        autoFocus
        required
      />
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="BizBuddy" width={132} height={48} className="h-9 w-auto" priority />
          {/* Not shown — page title for screen readers */}
          <h1 className="sr-only">System admin sign in</h1>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          {/* Step 1: password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {notice && !error && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm" role="status">
                  {notice}
                </div>
              )}
              <div>
                <label htmlFor="username" className={labelClass}>Username</label>
                <input
                  id="username"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={inputClass}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`${inputClass} pr-10`}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Signing in…</> : "Sign in"}
              </button>
            </form>
          )}

          {/* Step 2a: first-time 2FA setup */}
          {step === "setup" && (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <BackLink />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-neutral-900">Set up two-factor authentication</h2>
                <p className="text-sm text-neutral-500">Scan with your authenticator app, then enter the 6-digit code.</p>
              </div>

              <div className="flex justify-center">
                <QRCodeSVG value={mfa.otpauthUrl} size={168} marginSize={1} />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Can&apos;t scan? Use this key:</p>
                <p className="rounded-md bg-neutral-100 px-3 py-2 text-center font-mono text-sm tracking-wider text-neutral-900 break-all select-all">
                  {groupInFours(mfa.secret)}
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className={labelClass}>6-digit code</label>
                {CodeInput()}
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Verifying…</> : "Turn on 2FA"}
              </button>
            </form>
          )}

          {/* Step 2b: enter a code */}
          {step === "verify" && (
            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <BackLink />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-neutral-900">Enter your code</h2>
                <p className="text-sm text-neutral-500">
                  {useRecovery ? "Each recovery code works once." : "From your authenticator app."}
                </p>
              </div>

              <div>
                <label htmlFor="mfa-code" className={labelClass}>
                  {useRecovery ? "Recovery code" : "6-digit code"}
                </label>
                {CodeInput()}
              </div>

              {error && <ErrorMessage message={error} />}

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? <><Spinner /> Verifying…</> : "Verify"}
              </button>

              <button
                type="button"
                onClick={switchCodeMode}
                className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800 hover:underline"
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
        </div>

      </div>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm" role="alert">
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
