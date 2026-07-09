// components/Dashboard/DashboardContent/CompanyPanel/Settings/Company&AccsDeletion.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useState } from "react";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Trash2, Shield, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function CompanyAndAccsDeletion() {
  const { token, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to delete account.");
        toast.message(data.message || "Failed to delete account.", {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          duration: 5000,
        });
        setLoading(false);
        return;
      }
      toast.message("Account deleted successfully.", {
        icon: <CheckCircle2 className="h-5 w-5 text-orange-500" />,
      });
      logout();
    } catch (err) {
      setError(err.message || "Failed to delete account.");
      toast.message(err.message || "Failed to delete account.", {
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
        duration: 5000,
      });
    } finally {
      setLoading(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
        <Toaster position="top-center" />
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-7 w-7 text-orange-500" />
            Company & Accounts Deletion
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
            <div className="h-1 w-full bg-red-500"></div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                Company & Accounts Deletion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex items-start space-x-4 p-4 bg-red-500/10 dark:bg-red-500/5 rounded-lg border border-red-200 dark:border-red-500/20"
              >
                <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-700 dark:text-red-400">Warning: This action cannot be undone</h3>
                  <p className="text-neutral-700 dark:text-neutral-300 text-sm">Deleting your account will permanently remove:</p>
                  <ul className="list-disc pl-5 text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                    <li>Your company profile and all associated data</li>
                    <li>All user accounts connected to your company</li>
                    <li>All active subscriptions and payment information</li>
                    <li>All historical data, settings, and preferences</li>
                  </ul>
                </div>
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden"
                  >
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full">
                    <Button
                      onClick={() => setIsConfirmOpen(true)}
                      variant="destructive"
                      className="w-full bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold py-2.5 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This action cannot be undone</p>
                </TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        </motion.div>

        <AnimatePresence>
          {isConfirmOpen && (
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
              <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <div className="h-1 w-full bg-red-500"></div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="p-6"
                >
                  <DialogHeader>
                    <DialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Confirm Company & Accounts Deletion
                    </DialogTitle>
                    <DialogDescription>
                      This action is permanent and cannot be reversed. All your data will be permanently deleted.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      className="bg-amber-500/10 dark:bg-amber-500/5 p-3 rounded-md border border-amber-200 dark:border-amber-500/20"
                    >
                      <p className="text-sm text-amber-800 dark:text-amber-400">
                        To confirm, please type <strong>delete my account</strong> in the field below.
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.2 }}
                    >
                      <Input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="delete my account"
                        className="border-red-200 dark:border-red-800 focus:ring-red-500"
                      />
                    </motion.div>
                  </div>

                  <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsConfirmOpen(false)}
                        className="mt-2 sm:mt-0 border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={confirmText === "delete my account" && !loading ? { scale: 1.02 } : {}}
                      whileTap={confirmText === "delete my account" && !loading ? { scale: 0.98 } : {}}
                    >
                      <Button
                        type="button"
                        disabled={confirmText !== "delete my account" || loading}
                        onClick={handleDeleteAccount}
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <svg
                              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
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
                          </span>
                        ) : (
                          "Permanently Delete Account"
                        )}
                      </Button>
                    </motion.div>
                  </DialogFooter>
                </motion.div>
              </DialogContent>
            </Dialog>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
