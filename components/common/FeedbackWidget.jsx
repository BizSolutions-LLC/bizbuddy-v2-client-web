"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquarePlus,
  X,
  Send,
  CheckCircle2,
  Loader2,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useAuthStore from "@/store/useAuthStore";

const CATEGORIES = [
  { value: "bug",        label: "Bug Report", icon: Bug,           color: "text-red-500"    },
  { value: "suggestion", label: "Suggestion",  icon: Lightbulb,     color: "text-yellow-500" },
  { value: "question",   label: "Question",    icon: HelpCircle,    color: "text-blue-500"   },
  { value: "other",      label: "Other",       icon: MessageSquare, color: "text-gray-500"   },
];

export default function FeedbackWidget({ isSidebarOpen = false }) {
  const { user, token } = useAuthStore();
  const pathname = usePathname();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [open, setOpen]             = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [logNumber, setLogNumber]     = useState(null);

  const [form, setForm] = useState({ category: "", title: "", description: "" });
  const [errors, setErrors] = useState({});

  const reset = () => {
    setForm({ category: "", title: "", description: "" });
    setErrors({});
    setSubmitted(false);
    setLogNumber(null);
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(reset, 300);
  };

  const validate = () => {
    const e = {};
    if (!form.category)           e.category    = "Please select a category";
    if (!form.title.trim())       e.title       = "Please add a brief title";
    if (!form.description.trim()) e.description = "Please describe the issue or suggestion";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        category:    form.category,
        title:       form.title.trim(),
        description: form.description.trim(),
        page:        pathname,
        submittedAt: new Date().toISOString(),
        submittedBy: {
          name:  user?.profile
            ? `${user.profile.firstName ?? ""} ${user.profile.lastName ?? ""}`.trim()
            : user?.email,
          email: user?.email,
          role:  user?.role,
        },
        userAgent:        typeof navigator !== "undefined" ? navigator.userAgent : "",
        screenResolution: typeof window !== "undefined"
          ? `${window.screen.width}x${window.screen.height}`
          : "",
      };

      const r = await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message || "Submission failed");
      }

      const j = await r.json();
      setLogNumber(j.data?.logNumber ?? null);
      setSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.message || "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="feedback-widget-root">
      {/* ── Bottom-left tab ────────────────────────────────────────────── */}
      <div
        className={[
          "fixed bottom-6 left-0 z-40 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "md:left-80" : "",
        ].join(" ")}
      >
        <motion.button
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleOpen}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600
                     text-white pl-2 pr-3 py-3 rounded-r-xl shadow-lg transition-colors duration-150"
          aria-label="Open feedback"
        >
          <MessageSquarePlus className="h-4 w-4 rotate-90 mb-1" />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Feedback
          </span>
        </motion.button>
      </div>

      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* ── Panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ x: -420, opacity: 0 }}
            animate={{ x: 0,    opacity: 1 }}
            exit={{   x: -420, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed left-0 top-0 h-full w-[380px] max-w-[92vw] z-50
                       bg-white dark:bg-neutral-900
                       border-r border-neutral-200 dark:border-neutral-700
                       shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="h-1 w-full bg-orange-500" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <MessageSquarePlus className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Send Feedback</h2>
                  <p className="text-xs text-muted-foreground">
                    Report a bug or share a suggestion
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full gap-4 text-center py-16"
                >
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Thanks for your feedback!</p>
                    {logNumber !== null ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Your feedback has been logged as{" "}
                        <span className="font-semibold text-foreground">#{logNumber}</span>.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        We&apos;ve received your report and will look into it.
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={reset} className="mt-2">
                    Send another
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-5">

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Category <span className="text-orange-500">*</span>
                    </label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => {
                        setForm((f) => ({ ...f, category: v }));
                        setErrors((e) => ({ ...e, category: undefined }));
                      }}
                    >
                      <SelectTrigger className={errors.category ? "border-red-400" : ""}>
                        <SelectValue placeholder="What kind of feedback?" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-2">
                              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-xs text-red-500">{errors.category}</p>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Title <span className="text-orange-500">*</span>
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, title: e.target.value }));
                        setErrors((err) => ({ ...err, title: undefined }));
                      }}
                      placeholder={
                        form.category === "bug"        ? "e.g. Clock-out button not responding" :
                        form.category === "suggestion" ? "e.g. Add dark mode toggle to mobile"  :
                        "Brief summary…"
                      }
                      maxLength={120}
                      className={errors.title ? "border-red-400" : ""}
                    />
                    {errors.title && (
                      <p className="text-xs text-red-500">{errors.title}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      Description <span className="text-orange-500">*</span>
                    </label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, description: e.target.value }));
                        setErrors((err) => ({ ...err, description: undefined }));
                      }}
                      placeholder={
                        form.category === "bug"
                          ? "Steps to reproduce, what happened, what you expected…"
                          : "Describe your feedback in detail…"
                      }
                      className={`min-h-[120px] resize-none ${errors.description ? "border-red-400" : ""}`}
                      maxLength={1000}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{errors.description && <span className="text-red-500">{errors.description}</span>}</span>
                      <span>{form.description.length}/1000</span>
                    </div>
                  </div>

                  {/* Auto-captured context */}
                  <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Auto-captured with your report</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="truncate">📄 {pathname}</span>
                      <span className="truncate">👤 {user?.role ?? "—"}</span>
                    </div>
                  </div>

                  {/* Submit error */}
                  {errors.submit && (
                    <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                      {errors.submit}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!submitted && (
              <div className="px-5 py-4 border-t border-border flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Send feedback</>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
