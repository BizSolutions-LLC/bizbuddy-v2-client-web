/* components/Dashboard/DashboardContent/Others/UserSettingsComponent.jsx */
/* eslint-disable react-hooks/exhaustive-deps */

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, Shield, AlertCircle, Check, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

const getPasswordStrength = (password) => {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  Object.values(checks).forEach((check) => check && score++);

  const strength = score <= 2 ? "weak" : score <= 3 ? "medium" : score <= 4 ? "strong" : "very-strong";
  const percentage = (score / 5) * 100;

  return { strength, percentage, checks, score };
};

export default function UserSettingsComponent() {
  const router = useRouter();
  const { token, logout } = useAuthStore();

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [reveal, setReveal] = useState({
    old: false,
    new: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const toggleReveal = (field) => setReveal((r) => ({ ...r, [field]: !r[field] }));

  const passwordStrength = useMemo(() => getPasswordStrength(form.newPassword), [form.newPassword]);

  const mismatch = useMemo(
    () => form.confirmPassword.length > 0 && form.confirmPassword !== form.newPassword,
    [form.newPassword, form.confirmPassword]
  );

  const isFormValid = useMemo(() => {
    return (
      form.oldPassword.length > 0 &&
      form.newPassword.length >= 8 &&
      form.confirmPassword === form.newPassword &&
      passwordStrength.score >= 3
    );
  }, [form, passwordStrength.score]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mismatch) {
      toast.warning("New password and confirmation do not match");
      return;
    }

    if (!form.oldPassword || !form.newPassword) {
      toast.warning("Please fill in all fields");
      return;
    }

    if (passwordStrength.score < 3) {
      toast.warning("Please choose a stronger password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/api/account/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to update password");

      toast.success("Password updated successfully!");

      setTimeout(() => {
        logout();
        router.replace("/sign-in");
      }, 2000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (strength) => {
    switch (strength) {
      case "weak":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "strong":
        return "bg-orange-500";
      case "very-strong":
        return "bg-green-500";
      default:
        return "bg-gray-300";
    }
  };

  const getStrengthText = (strength) => {
    switch (strength) {
      case "weak":
        return "Weak";
      case "medium":
        return "Medium";
      case "strong":
        return "Strong";
      case "very-strong":
        return "Very Strong";
      default:
        return "";
    }
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
      <Toaster position="top-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-orange-500" />
            User Settings
          </h2>
          <p className="text-muted-foreground mt-1">Manage your password and account security</p>
        </div>
      </div>

      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Update Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type={reveal.old ? "text" : "password"}
                  value={form.oldPassword}
                  onChange={onChange}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleReveal("old")}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                >
                  {reveal.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={reveal.new ? "text" : "password"}
                  value={form.newPassword}
                  onChange={onChange}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleReveal("new")}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                >
                  {reveal.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {form.newPassword && (
                <div className="space-y-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Password Strength</span>
                    <Badge variant="outline" className={`${getStrengthColor(passwordStrength.strength)} text-white border-0`}>
                      {getStrengthText(passwordStrength.strength)}
                    </Badge>
                  </div>

                  <Progress value={passwordStrength.percentage} className="h-2" />

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {Object.entries({
                      "At least 8 characters": passwordStrength.checks.length,
                      "Lowercase letter": passwordStrength.checks.lowercase,
                      "Uppercase letter": passwordStrength.checks.uppercase,
                      Number: passwordStrength.checks.numbers,
                      "Special character": passwordStrength.checks.special,
                    }).map(([requirement, met]) => (
                      <div key={requirement} className="flex items-center gap-2">
                        {met ? <Check className="h-3 w-3 text-green-500" /> : <X className="h-3 w-3 text-gray-400" />}
                        <span className={met ? "text-green-600 dark:text-green-400" : "text-gray-500"}>{requirement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={reveal.confirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={onChange}
                  required
                  className={`pr-10 ${mismatch ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => toggleReveal("confirm")}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                >
                  {reveal.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mismatch && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Passwords do not match</span>
                </div>
              )}

              {form.confirmPassword && !mismatch && form.confirmPassword === form.newPassword && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Passwords match</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !isFormValid}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? "Updating…" : "Update Password"}
            </Button>

            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <div className="flex gap-3">
                <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Security Notice</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    After changing your password, you'll be automatically signed out and redirected to the signin page for
                    security purposes.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
