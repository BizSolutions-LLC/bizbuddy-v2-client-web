"use client";
import React, { useState, useEffect } from "react";
import useAuthStore from "@/store/useAuthStore";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ModalPortal from "@/components/ui/modal-portal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const DEFAULT_FUTA_RATE = 7;

function FutaInfoTooltip() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full text-teal-600 hover:text-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label="About FUTA tax"
          >
            <Info className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3 text-left leading-relaxed"
        >
          <p className="font-semibold text-white mb-2">Federal Unemployment Tax (FUTA)</p>
          <ul className="list-disc pl-4 space-y-1 mb-2 text-sm">
            <li>
              Paid by the <strong>employer only</strong> — never withheld from employee wages
            </li>
            <li>
              Applies to the first <strong>$7,000</strong> of each employee&apos;s taxable wages per calendar year
            </li>
            <li>Funds federal unemployment benefits; reported on IRS Form 940</li>
            <li>After the maximum state unemployment credit (5.4%), the effective federal rate is often 0.6%</li>
          </ul>
          <p className="text-gray-300 text-[11px]">
            Configure the rate your company uses for payroll estimates.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const Company = () => {
  const { token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company Info (Read-Only)
  const [companyInfo, setCompanyInfo] = useState({
    id: "",
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  // Payroll Config
  const [payrollConfig, setPayrollConfig] = useState({
    id: "",
    payFrequency: "biweekly",
    ptoEnabled: true,
    ptoLabel: "PTO",
    // Cutoff & Pay Date Config
    cutoffStartDay: 1,
    cutoffEndDay: 15,
    paymentDay: 20,
  });

  // Tax Rates Configuration
  const [taxRates, setTaxRates] = useState({
    federalRate: 0.12,
    stateRate: 0.05,
    ficaRate: 0.062,
    medicareRate: 0.0145,
    sdiRate: 0.011,
  });

  const [earningTypes, setEarningTypes] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState([]);

  // Modal States
  const [showAddEarning, setShowAddEarning] = useState(false);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [newEarning, setNewEarning] = useState({ code: "", label: "", isTaxable: true });
  const [newDeduction, setNewDeduction] = useState({ code: "", label: "", isPreTax: false, calculationType: "fixed" });

  const [futaConfig, setFutaConfig] = useState({ enabled: false, rate: DEFAULT_FUTA_RATE });
  const [futaRateDraft, setFutaRateDraft] = useState(String(DEFAULT_FUTA_RATE));
  const [futaRateSaving, setFutaRateSaving] = useState(false);
  const [futaToggleSaving, setFutaToggleSaving] = useState(false);
  const [showFutaEnableModal, setShowFutaEnableModal] = useState(false);

  const applyFutaSettings = ({ futaEnabled, futaRate }) => {
    const rate = futaRate ?? DEFAULT_FUTA_RATE;
    setFutaConfig({ enabled: Boolean(futaEnabled), rate });
    setFutaRateDraft(String(rate));
  };

  const fetchDeductionSettings = async () => {
    const response = await fetch(`${API_BASE_URL}/api/deductions/settings`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to fetch deduction settings");

    if (result.success && result.data) {
      applyFutaSettings(result.data);
    }
  };

  const updateDeductionSettings = async (payload) => {
    const response = await fetch(`${API_BASE_URL}/api/deductions/settings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to update deduction settings");

    if (result.success && result.data) {
      applyFutaSettings(result.data);
    }

    return result.data;
  };

  const updateFutaRate = async (futaRate) => {
    const response = await fetch(`${API_BASE_URL}/api/deductions/futa/rate`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ futaRate }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Failed to update FUTA rate");

    if (result.success && result.data) {
      const rate = result.data.futaRate ?? futaRate;
      setFutaConfig((prev) => ({ ...prev, rate }));
      setFutaRateDraft(String(rate));
    }

    return result.data;
  };

  useEffect(() => {
    if (!token) return;
    fetchCompanySettings();
  }, [token]);

  const fetchCompanySettings = async () => {
    try {
      setLoading(true);
      const [companyResponse, deductionResult] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/company-information/company-settings`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }),
        fetchDeductionSettings(),
      ]);

      if (companyResponse.status === "rejected") {
        throw companyResponse.reason;
      }

      const response = companyResponse.value;
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to fetch company settings");

      if (result.success && result.data) {
        setCompanyInfo(result.data.company);
        setPayrollConfig((prev) => ({
          ...prev,
          ...result.data.payrollConfig,
          payFrequency: result.data.payrollConfig?.payFrequency ?? prev.payFrequency,
          cutoffStartDay: result.data.payrollConfig?.cutoffStartDay ?? prev.cutoffStartDay,
          cutoffEndDay: result.data.payrollConfig?.cutoffEndDay ?? prev.cutoffEndDay,
          paymentDay: result.data.payrollConfig?.paymentDay ?? prev.paymentDay,
          ptoEnabled: result.data.payrollConfig?.ptoEnabled ?? prev.ptoEnabled,
          ptoLabel: result.data.payrollConfig?.ptoLabel ?? prev.ptoLabel,
        }));
        setEarningTypes(result.data.earningTypes);
        setDeductionTypes(result.data.deductionTypes);
        toast.success("Company settings loaded");
      }

      if (deductionResult.status === "rejected") {
        console.error("Error loading deduction settings:", deductionResult.reason);
        toast.error(deductionResult.reason?.message || "Failed to load FUTA settings");
      }
    } catch (err) {
      toast.error(err.message);
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate pay dates based on today
  const handleAutoCalculatePayPeriod = () => {
    const today = new Date();
    const day = today.getDate();

    let payFrom, payTo, payDateCalc;

    if (day >= 1 && day <= 15) {
      // Day 1-15: Previous period (16th-end of last month)
      payTo = new Date(today.getFullYear(), today.getMonth(), 0);
      payFrom = new Date(today.getFullYear(), today.getMonth() - 1, 16);
      payDateCalc = new Date(payTo);
      payDateCalc.setDate(payDateCalc.getDate() + 5);
    } else {
      // Day 16-31: Current period (1st-15th)
      payFrom = new Date(today.getFullYear(), today.getMonth(), 1);
      payTo = new Date(today.getFullYear(), today.getMonth(), 15);
      payDateCalc = new Date(payTo);
      payDateCalc.setDate(payDateCalc.getDate() + 5);
    }

    toast.success(
      `Pay Period: ${payFrom.toLocaleDateString()} - ${payTo.toLocaleDateString()}, Pay Date: ${payDateCalc.toLocaleDateString()}`,
    );
  };

  const handleUpdatePayrollConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/company-information/payroll-config`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          payFrequency: payrollConfig.payFrequency.toLowerCase(),
          ptoEnabled: payrollConfig.ptoEnabled,
          ptoLabel: payrollConfig.ptoLabel,
          cutoffStartDay: payrollConfig.cutoffStartDay,
          cutoffEndDay: payrollConfig.cutoffEndDay,
          paymentDay: payrollConfig.paymentDay,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to update");

      toast.success("Payroll configuration updated!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEarning = async () => {
    if (!newEarning.code || !newEarning.label) {
      toast.error("Code and Label are required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/company-information/earning-types`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(newEarning),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to create earning type");

      await fetchCompanySettings();
      setShowAddEarning(false);
      setNewEarning({ code: "", label: "", isTaxable: true });
      toast.success("Earning type created!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEarning = async (id, updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/company-information/earning-types/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setEarningTypes((prev) => prev.map((et) => (et.id === id ? { ...et, ...updates } : et)));
      toast.success("Earning type updated");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleEarning = async (id, currentEnabled) => {
    await handleUpdateEarning(id, { enabled: !currentEnabled });
  };

  const handleCreateDeduction = async () => {
    if (!newDeduction.code || !newDeduction.label) {
      toast.error("Code and Label are required");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/company-information/deduction-types`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(newDeduction),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      await fetchCompanySettings();
      setShowAddDeduction(false);
      setNewDeduction({ code: "", label: "", isPreTax: false, calculationType: "fixed" });
      toast.success("Deduction type created!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDeduction = async (id, updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/company-information/deduction-types/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setDeductionTypes((prev) => prev.map((dt) => (dt.id === id ? { ...dt, ...updates } : dt)));
      toast.success("Deduction type updated");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleDeduction = async (id, currentEnabled) => {
    await handleUpdateDeduction(id, { enabled: !currentEnabled });
  };

  const handleFutaToggleRequest = async () => {
    if (futaConfig.enabled) {
      try {
        setFutaToggleSaving(true);
        await updateDeductionSettings({ futaEnabled: false });
        toast.success("FUTA tracking disabled");
      } catch (err) {
        toast.error(err.message);
      } finally {
        setFutaToggleSaving(false);
      }
      return;
    }
    setShowFutaEnableModal(true);
  };

  const handleConfirmEnableFuta = async () => {
    const rate = futaConfig.rate > 0 ? futaConfig.rate : DEFAULT_FUTA_RATE;

    try {
      setFutaToggleSaving(true);
      await updateDeductionSettings({ futaEnabled: true, futaRate: rate });
      setShowFutaEnableModal(false);
      toast.success("FUTA tracking enabled");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFutaToggleSaving(false);
    }
  };

  const handleFutaRateChange = (value) => {
    setFutaRateDraft(value);
  };

  const futaRateDirty = futaConfig.enabled && parseFloat(futaRateDraft) !== parseFloat(String(futaConfig.rate));

  const handleSaveFutaRate = async () => {
    const parsed = parseFloat(futaRateDraft);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Enter a valid rate between 0 and 100");
      return;
    }

    try {
      setFutaRateSaving(true);
      await updateFutaRate(parsed);
      toast.success("FUTA rate saved");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFutaRateSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading company settings...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />

      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* Company Information Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-orange-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Company Information
            </h2>
            <p className="text-xs text-gray-500 mt-1">Read-only information from company profile</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyInfo.name || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={companyInfo.address || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                <input
                  type="text"
                  value={companyInfo.city || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                <input
                  type="text"
                  value={companyInfo.state || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payroll Settings Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Payroll & Cutoff Settings
            </h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pay Frequency</label>
                <select
                  value={payrollConfig.payFrequency ?? "biweekly"}
                  onChange={(e) => setPayrollConfig((prev) => ({ ...prev, payFrequency: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="semimonthly">Semi-Monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cutoff Start Day</label>
                <input
                  type="number"
                  value={payrollConfig.cutoffStartDay ?? ""}
                  onChange={(e) => setPayrollConfig((prev) => ({ ...prev, cutoffStartDay: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Day</label>
                <input
                  type="number"
                  value={payrollConfig.paymentDay ?? ""}
                  onChange={(e) => setPayrollConfig((prev) => ({ ...prev, paymentDay: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">PTO Enabled:</label>
                <button
                  onClick={() => setPayrollConfig((prev) => ({ ...prev, ptoEnabled: !prev.ptoEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${payrollConfig.ptoEnabled ? "bg-orange-600" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${payrollConfig.ptoEnabled ? "translate-x-6" : "translate-x-1"}`}
                  />
                </button>
              </div>

              <button
                onClick={handleAutoCalculatePayPeriod}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Calculate Pay Period
              </button>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={handleUpdatePayrollConfig}
                disabled={saving}
                className="px-8 py-3 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {saving ? "UPDATING..." : "UPDATE SETTINGS"}
              </button>
            </div>
          </div>
        </div>

        {/* Tax Configuration Card - Read Only (California Compliant) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-purple-100">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              Tax Rate Configuration
            </h2>
            <p className="text-xs text-gray-500 mt-1">California state-compliant tax rates (Read-only)</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Federal Income Tax */}
              <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-blue-900">Federal Income Tax</h3>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{(taxRates.federalRate * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-blue-200 rounded-full p-2">
                    <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Federal withholding tax based on IRS Publication 15-T. Estimated rate for demonstration. Actual rate varies by
                  filing status and allowances.
                </p>
              </div>

              {/* State Income Tax (CA) */}
              <div className="bg-green-50 rounded-lg p-5 border border-green-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-green-900">CA State Income Tax</h3>
                    <p className="text-2xl font-bold text-green-600 mt-1">{(taxRates.stateRate * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-green-200 rounded-full p-2">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-green-700 leading-relaxed">
                  California state withholding per DE 4 form. Progressive tax rate (1%-13.3%) based on income bracket. Estimated
                  average shown.
                </p>
              </div>

              {/* Social Security (FICA) */}
              <div className="bg-orange-50 rounded-lg p-5 border border-orange-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-orange-900">Social Security (FICA)</h3>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{(taxRates.ficaRate * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-orange-200 rounded-full p-2">
                    <svg className="w-5 h-5 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed">
                  Federal Insurance Contributions Act (FICA) - Social Security tax. Fixed at 6.2% on wages up to $168,600 annual
                  cap (2024).
                </p>
              </div>

              {/* Medicare */}
              <div className="bg-purple-50 rounded-lg p-5 border border-purple-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-purple-900">Medicare Tax</h3>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{(taxRates.medicareRate * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-purple-200 rounded-full p-2">
                    <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-purple-700 leading-relaxed">
                  Federal Medicare tax under FICA. Fixed at 1.45% on all wages. Additional 0.9% applies to high earners over
                  $200k.
                </p>
              </div>

              {/* CA SDI */}
              <div className="bg-red-50 rounded-lg p-5 border border-red-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-red-900">CA State Disability (SDI)</h3>
                    <p className="text-2xl font-bold text-red-600 mt-1">{(taxRates.sdiRate * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-red-200 rounded-full p-2">
                    <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  California State Disability Insurance. Employee-funded at ~1.1% on wages up to $153,164 (2024). Provides
                  short-term disability benefits.
                </p>
              </div>

              {/* CA ETT (Employer Only) - Info Card */}
              <div className="bg-yellow-50 rounded-lg p-5 border border-yellow-200 col-span-2">
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-200 rounded-full p-2 flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-yellow-900 mb-1">Employer Taxes (Not deducted from employee)</h3>
                    <p className="text-xs text-yellow-700 leading-relaxed">
                      <strong>• FUTA:</strong> Federal unemployment tax (employer only)
                      <br />
                      <strong>• CA SUI:</strong> California State Unemployment Insurance (employer only)
                      <br />
                      <strong>• CA ETT:</strong> Employment Training Tax - 0.1% on first $7,000 (employer only)
                      <br />
                      <strong>• FICA/Medicare Match:</strong> Employer matches employee contributions (6.2% + 1.45%)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Read-Only Configuration</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Tax rates are set by federal and California state law. These rates are automatically updated to remain
                    compliant. Actual withholding amounts vary based on employee W-4 forms, filing status, and allowances.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FUTA Configuration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-teal-100">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800">FUTA Configuration</h2>
              <FutaInfoTooltip />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Federal Unemployment Tax — employer-paid on the first $7,000 of each employee per year
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Enable FUTA tracking</p>
                <p className="text-xs text-gray-500 mt-0.5">Include FUTA in employer payroll cost estimates for this company</p>
              </div>
              <button
                type="button"
                onClick={handleFutaToggleRequest}
                disabled={futaToggleSaving}
                aria-pressed={futaConfig.enabled}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  futaConfig.enabled ? "bg-teal-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    futaConfig.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {futaConfig.enabled && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FUTA rate (%)</label>
                  <div className="flex items-center gap-2 max-w-sm">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={futaRateDraft}
                        onChange={(e) => handleFutaRateChange(e.target.value)}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                    </div>
                    {futaRateDirty && (
                      <button
                        type="button"
                        onClick={handleSaveFutaRate}
                        disabled={futaRateSaving}
                        className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        {futaRateSaving ? "Saving..." : "Save rate"}
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Default is {DEFAULT_FUTA_RATE}%. Applied to taxable wages up to $7,000 per employee per calendar year.
                  </p>
                </div>

                <div className="flex items-start gap-2 text-xs text-teal-800 bg-teal-100/80 rounded-md p-3 border border-teal-200">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Example: at {futaRateDraft || DEFAULT_FUTA_RATE}% on $7,000 wages, employer FUTA cost is{" "}
                    <strong>${(((parseFloat(futaRateDraft) || DEFAULT_FUTA_RATE) / 100) * 7000).toFixed(2)}</strong> per employee
                    per year (before credits or adjustments).
                  </p>
                </div>
              </div>
            )}

            {!futaConfig.enabled && (
              <p className="text-xs text-gray-400 italic">
                FUTA is disabled. Turn on tracking to configure the employer tax rate.
              </p>
            )}
          </div>
        </div>

        {/* Earnings Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-green-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Earnings</h2>
            <button
              onClick={() => setShowAddEarning(true)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              + Add Earning Type
            </button>
          </div>

          <div className="p-6">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Enabled</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Label</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Taxable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {earningTypes.map((earning) => (
                  <tr key={earning.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleEarning(earning.id, earning.enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${earning.enabled ? "bg-green-600" : "bg-gray-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${earning.enabled ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{earning.code}</td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={earning.label ?? ""}
                        onChange={(e) =>
                          setEarningTypes((prev) =>
                            prev.map((et) => (et.id === earning.id ? { ...et, label: e.target.value } : et)),
                          )
                        }
                        onBlur={() => handleUpdateEarning(earning.id, { label: earning.label })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={earning.isTaxable ? "text-green-600 font-semibold" : "text-gray-400"}>
                        {earning.isTaxable ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Deductions</h2>
            <button
              onClick={() => setShowAddDeduction(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              + Add Deduction Type
            </button>
          </div>

          <div className="p-6">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Enabled</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Label</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Pre-Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deductionTypes.map((deduction) => (
                  <tr key={deduction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleDeduction(deduction.id, deduction.enabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${deduction.enabled ? "bg-red-600" : "bg-gray-300"}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${deduction.enabled ? "translate-x-6" : "translate-x-1"}`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">{deduction.code}</td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={deduction.label ?? ""}
                        onChange={(e) =>
                          setDeductionTypes((prev) =>
                            prev.map((dt) => (dt.id === deduction.id ? { ...dt, label: e.target.value } : dt)),
                          )
                        }
                        onBlur={() => handleUpdateDeduction(deduction.id, { label: deduction.label })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={deduction.calculationType || "fixed"}
                        onChange={(e) => {
                          const calculationType = e.target.value;
                          setDeductionTypes((prev) =>
                            prev.map((dt) => (dt.id === deduction.id ? { ...dt, calculationType } : dt)),
                          );
                          handleUpdateDeduction(deduction.id, { calculationType });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="fixed">Fixed ($)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={deduction.isPreTax ? "text-green-600 font-semibold" : "text-gray-400"}>
                        {deduction.isPreTax ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Enable FUTA Confirmation Modal */}
      {showFutaEnableModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowFutaEnableModal(false)} />
            <div className="relative bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Enable FUTA tracking?</h3>
                    <p className="text-sm text-teal-100 mt-1">Review before turning this on</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">What is FUTA?</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <strong>Federal Unemployment Tax (FUTA)</strong> is an employer-only payroll tax that funds federal
                    unemployment benefits and is reported on IRS Form 940.
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
                      <span>
                        Paid by the <strong className="text-gray-800">employer only</strong> — never withheld from employee wages
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500" />
                      <span>
                        Applies to the first <strong className="text-gray-800">$7,000</strong> of each employee&apos;s taxable
                        wages per calendar year
                      </span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">When you enable</h4>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm text-gray-700">
                    <p>
                      FUTA will be included in your <strong className="text-gray-900">employer payroll cost estimates</strong>.
                    </p>
                    <p>
                      Default rate: <strong className="text-gray-900">{DEFAULT_FUTA_RATE}%</strong> — configurable after enabling.
                    </p>
                    <p className="text-gray-500">Employee paychecks are not affected.</p>
                  </div>
                </section>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFutaEnableModal(false)}
                  disabled={futaToggleSaving}
                  className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEnableFuta}
                  disabled={futaToggleSaving}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 font-medium disabled:opacity-50"
                >
                  {futaToggleSaving ? "Enabling..." : "Enable FUTA"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Earning Modal */}
      {showAddEarning && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setShowAddEarning(false);
                setNewEarning({ code: "", label: "", isTaxable: true });
              }}
            />
            <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Add Earning Type</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={newEarning.code}
                    onChange={(e) => setNewEarning((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., overtime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <input
                    type="text"
                    value={newEarning.label}
                    onChange={(e) => setNewEarning((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g., Overtime Pay"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newEarning.isTaxable}
                    onChange={(e) => setNewEarning((prev) => ({ ...prev, isTaxable: e.target.checked }))}
                    className="h-4 w-4 text-orange-600"
                  />
                  <label className="text-sm text-gray-700">Taxable</label>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCreateEarning}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowAddEarning(false);
                    setNewEarning({ code: "", label: "", isTaxable: true });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Deduction Modal */}
      {showAddDeduction && (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => {
                setShowAddDeduction(false);
                setNewDeduction({ code: "", label: "", isPreTax: false, calculationType: "fixed" });
              }}
            />
            <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-gray-900">Add Deduction Type</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={newDeduction.code}
                    onChange={(e) => setNewDeduction((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g., 401k"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <input
                    type="text"
                    value={newDeduction.label}
                    onChange={(e) => setNewDeduction((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g., 401K Retirement"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deduction Type</label>
                  <select
                    value={newDeduction.calculationType}
                    onChange={(e) => setNewDeduction((prev) => ({ ...prev, calculationType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="fixed">Fixed amount ($)</option>
                    <option value="percent">Percentage of gross (%)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {newDeduction.calculationType === "percent"
                      ? "Employees enter a % value; the sheet calculates the dollar amount from gross pay."
                      : "Employees enter a flat dollar amount per pay period."}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newDeduction.isPreTax}
                    onChange={(e) => setNewDeduction((prev) => ({ ...prev, isPreTax: e.target.checked }))}
                    className="h-4 w-4 text-orange-600"
                  />
                  <label className="text-sm text-gray-700">Pre-Tax</label>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCreateDeduction}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                >
                  {saving ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowAddDeduction(false);
                    setNewDeduction({ code: "", label: "", isPreTax: false, calculationType: "fixed" });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
};

export default Company;
