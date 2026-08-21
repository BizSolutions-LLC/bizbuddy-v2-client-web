"use client";
import React, { useState, useEffect } from "react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const TAX_EXEMPTION_FIELDS = [
  { key: "exemptFederal", label: "Federal" },
  { key: "exemptSocialSecurity", label: "Social Security" },
  { key: "exemptMedicare", label: "Medicare" },
  { key: "exemptSdi", label: "SDI" },
  { key: "exemptPit", label: "PIT" },
];

function resolveExemptFlag(value, fallback = false) {
  if (value == null) return fallback;
  return Boolean(value);
}

function ExemptToggle({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!value)}
          aria-pressed={value}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            value ? "bg-orange-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">{value ? "Yes" : "No"}</span>
      </div>
    </div>
  );
}

const Employee = () => {
  const { token } = useAuthStore();

  // Employee list
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Selected employee
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Dynamic earning rates (from company settings)
  const [customRateEarningTypes, setCustomRateEarningTypes] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    // Employee info (read-only from profile)
    firstName: "",
    lastName: "",
    ssnItin: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    isActive: true,
    position: "",

    // Payroll details (editable)
    maritalStatus: "single",
    payType: "hourly",
    payRate: "",
    driverPayRate: "",
    additionalFedIncomeTax: "",
    additionalStateIncomeTax: "",
    federalRateMode: "auto",
    customFederalRate: "",
    stateRateMode: "auto",
    customStateRate: "",
    ptoHoursBalance: "",
    exemptFederal: false,
    exemptSocialSecurity: false,
    exemptMedicare: false,
    exemptSdi: false,
    exemptPit: false,
    withCalSavers: false,

    // Dynamic earning rates
    earningRates: {},
  });

  // ============================================
  // FETCH EMPLOYEES LIST
  // ============================================
  useEffect(() => {
    fetchEmployees();
  }, [token]);

  const fetchEmployees = async () => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/payroll-system/get-employees-list`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch employees");
      }

      if (data.success) {
        setEmployees(data.data.employees);
        toast.success("Employees loaded successfully");
      } else {
        throw new Error(data.message || "Failed to fetch employees");
      }
    } catch (err) {
      const errorMessage = err.message || "An unexpected error occurred";
      toast.error(errorMessage);
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FETCH EMPLOYEE PAYROLL DETAILS
  // ============================================
  const fetchEmployeePayrollDetails = async (userId) => {
    if (!token || !userId) return;

    try {
      setLoadingDetails(true);

      const response = await fetch(`${API_URL}/api/employee-payroll-details/employees/${userId}/payroll-details`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch employee details");
      }

      if (data.success) {
        const { employeeInfo, payrollDetails, earningRates } = data.data;

        // Store custom rate earning types for dynamic rendering
        setCustomRateEarningTypes(earningRates);

        // Build earning rates object
        const earningRatesMap = {};
        earningRates.forEach((er) => {
          earningRatesMap[er.earningTypeId] = er.rate?.toString() || "";
        });

        setFormData({
          // Employee info (from profile - read only)
          firstName: employeeInfo.firstName || "",
          lastName: employeeInfo.lastName || "",
          ssnItin: employeeInfo.ssnItin || "",
          address: employeeInfo.address || "",
          city: employeeInfo.city || "",
          state: employeeInfo.state || "",
          zip: employeeInfo.zip || "",
          isActive: employeeInfo.isActive,
          position: employeeInfo.position || "",

          // Payroll details
          maritalStatus: payrollDetails.maritalStatus || "single",
          payType: payrollDetails.payType || "hourly",
          payRate: payrollDetails.payRate?.toString() || "",
          driverPayRate: payrollDetails.driverPayRate?.toString() || "",
          additionalFedIncomeTax: payrollDetails.additionalFedIncomeTax?.toString() || "",
          additionalStateIncomeTax: payrollDetails.additionalStateIncomeTax?.toString() || "",
          federalRateMode: payrollDetails.customFederalRate != null ? "custom" : "auto",
          customFederalRate: payrollDetails.customFederalRate != null ? payrollDetails.customFederalRate.toString() : "",
          stateRateMode: payrollDetails.customStateRate != null ? "custom" : "auto",
          customStateRate: payrollDetails.customStateRate != null ? payrollDetails.customStateRate.toString() : "",
          ptoHoursBalance: payrollDetails.ptoHoursBalance?.toString() || "",
          exemptFederal: resolveExemptFlag(payrollDetails.exemptFederal),
          exemptSocialSecurity: resolveExemptFlag(
            payrollDetails.exemptSocialSecurity,
            payrollDetails.skipFicaMedicare
          ),
          exemptMedicare: resolveExemptFlag(payrollDetails.exemptMedicare, payrollDetails.skipFicaMedicare),
          exemptSdi: resolveExemptFlag(payrollDetails.exemptSdi),
          exemptPit: resolveExemptFlag(payrollDetails.exemptPit),
          withCalSavers: payrollDetails.withCalSavers || false,

          // Dynamic earning rates
          earningRates: earningRatesMap,
        });

        toast.success("Employee details loaded successfully");
      }
    } catch (err) {
      const errorMessage = err.message || "An unexpected error occurred";
      toast.error(errorMessage);
      console.error("Error:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ============================================
  // HANDLE EMPLOYEE SELECTION
  // ============================================
  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployee(employeeId);
    fetchEmployeePayrollDetails(employeeId);
  };

  // ============================================
  // HANDLE INPUT CHANGES
  // ============================================
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Switching a tax rate back to Auto also clears its custom rate input, so a stale
  // number can't be silently resubmitted next time the admin flips back to Custom.
  const handleRateModeChange = (modeField, rateField, mode) => {
    setFormData((prev) => ({
      ...prev,
      [modeField]: mode,
      [rateField]: mode === "auto" ? "" : prev[rateField],
    }));
  };

  const handleEarningRateChange = (earningTypeId, value) => {
    setFormData((prev) => ({
      ...prev,
      earningRates: {
        ...prev.earningRates,
        [earningTypeId]: value,
      },
    }));
  };

  // ============================================
  // SAVE EMPLOYEE PAYROLL DETAILS
  // ============================================
  const handleSave = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee first");
      return;
    }

    try {
      setSaving(true);

      // Build earning rates array
      const earningRatesArray = Object.entries(formData.earningRates).map(([earningTypeId, rate]) => ({
        earningTypeId,
        rate: parseFloat(rate) || 0,
      }));

      const payload = {
        maritalStatus: formData.maritalStatus,
        payType: formData.payType,
        payRate: parseFloat(formData.payRate) || 0,
        driverPayRate: parseFloat(formData.driverPayRate) || 0,
        additionalFedIncomeTax: parseFloat(formData.additionalFedIncomeTax) || 0,
        additionalStateIncomeTax: parseFloat(formData.additionalStateIncomeTax) || 0,
        customFederalRate: formData.federalRateMode === "custom" ? parseFloat(formData.customFederalRate) || 0 : null,
        customStateRate: formData.stateRateMode === "custom" ? parseFloat(formData.customStateRate) || 0 : null,
        ptoHoursBalance: parseFloat(formData.ptoHoursBalance) || 0,
        exemptFederal: formData.exemptFederal,
        exemptSocialSecurity: formData.exemptSocialSecurity,
        exemptMedicare: formData.exemptMedicare,
        exemptSdi: formData.exemptSdi,
        exemptPit: formData.exemptPit,
        skipFicaMedicare: formData.exemptSocialSecurity && formData.exemptMedicare,
        withCalSavers: formData.withCalSavers,
        earningRates: earningRatesArray,
      };

      const response = await fetch(`${API_URL}/api/employee-payroll-details/employees/${selectedEmployee}/payroll-details`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save employee details");
      }

      if (data.success) {
        toast.success("Employee payroll details saved successfully");
        await fetchEmployeePayrollDetails(selectedEmployee);
      }
    } catch (err) {
      const errorMessage = err.message || "An unexpected error occurred";
      toast.error(errorMessage);
      console.error("Error:", err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RESET EMPLOYEE PAYROLL DETAILS
  // ============================================
  const handleReset = async () => {
    if (!selectedEmployee) {
      clearForm();
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API_URL}/api/employee-payroll-details/employees/${selectedEmployee}/payroll-details`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset employee details");
      }

      if (data.success) {
        toast.success("Employee payroll details reset to defaults");

        const { payrollDetails, earningRates } = data.data;

        const earningRatesMap = {};
        earningRates.forEach((er) => {
          earningRatesMap[er.earningTypeId] = "";
        });

        setFormData((prev) => ({
          ...prev,
          maritalStatus: payrollDetails.maritalStatus,
          payType: payrollDetails.payType,
          payRate: "",
          driverPayRate: "",
          additionalFedIncomeTax: "",
          additionalStateIncomeTax: "",
          federalRateMode: "auto",
          customFederalRate: "",
          stateRateMode: "auto",
          customStateRate: "",
          ptoHoursBalance: "",
          exemptFederal: resolveExemptFlag(payrollDetails.exemptFederal),
          exemptSocialSecurity: resolveExemptFlag(
            payrollDetails.exemptSocialSecurity,
            payrollDetails.skipFicaMedicare
          ),
          exemptMedicare: resolveExemptFlag(payrollDetails.exemptMedicare, payrollDetails.skipFicaMedicare),
          exemptSdi: resolveExemptFlag(payrollDetails.exemptSdi),
          exemptPit: resolveExemptFlag(payrollDetails.exemptPit),
          withCalSavers: payrollDetails.withCalSavers,
          earningRates: earningRatesMap,
        }));
      }
    } catch (err) {
      const errorMessage = err.message || "An unexpected error occurred";
      toast.error(errorMessage);
      console.error("Error:", err);
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    const earningRatesMap = {};
    customRateEarningTypes.forEach((er) => {
      earningRatesMap[er.earningTypeId] = "";
    });

    setFormData({
      firstName: "",
      lastName: "",
      ssnItin: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      isActive: true,
      position: "",
      maritalStatus: "single",
      payType: "hourly",
      payRate: "",
      driverPayRate: "",
      additionalFedIncomeTax: "",
      additionalStateIncomeTax: "",
      federalRateMode: "auto",
      customFederalRate: "",
      stateRateMode: "auto",
      customStateRate: "",
      ptoHoursBalance: "",
      exemptFederal: false,
      exemptSocialSecurity: false,
      exemptMedicare: false,
      exemptSdi: false,
      exemptPit: false,
      withCalSavers: false,
      earningRates: earningRatesMap,
    });
    setSelectedEmployee(null);
  };

  // ============================================
  // FORMAT SSN FOR DISPLAY (masked)
  // ============================================
  const formatSSN = (ssn) => {
    if (!ssn) return "";
    // Show only last 4 digits: XXX-XX-1234
    if (ssn.length >= 4) {
      return `XXX-XX-${ssn.slice(-4)}`;
    }
    return ssn;
  };

  // ============================================
  // LOADING SPINNER
  // ============================================
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-12">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
        <div className="w-12 h-12 border-4 border-orange-600 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <Toaster position="top-center" richColors />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 p-3 sm:p-6 min-w-0">
        {/* Left Sidebar - Employee List */}
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b border-gray-300">
              <h3 className="text-sm font-semibold text-gray-700">{loading ? "Loading..." : `${employees.length} Employees`}</h3>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : error ? (
              <div className="p-4">
                <p className="text-sm text-red-600 mb-2">{error}</p>
                <button onClick={fetchEmployees} className="text-sm text-orange-600 hover:text-orange-700 underline">
                  Retry
                </button>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500">No employees found</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[280px] lg:max-h-[calc(100vh-250px)]">
                <ul className="divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <li
                      key={employee.id}
                      onClick={() => (employee.status === "Active" ? handleSelectEmployee(employee.id) : null)}
                      className={`px-4 py-3 transition-colors ${
                        employee.status !== "Active"
                          ? "opacity-50 bg-gray-100 cursor-not-allowed"
                          : selectedEmployee === employee.id
                            ? "bg-orange-50 text-orange-700 cursor-pointer"
                            : "text-gray-700 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span
                          className={`text-sm ${
                            employee.status !== "Active"
                              ? "text-gray-400 line-through"
                              : selectedEmployee === employee.id
                                ? "font-semibold"
                                : "font-medium"
                          }`}
                        >
                          {employee.name}
                        </span>
                        <span className={`text-xs mt-1 ${employee.status !== "Active" ? "text-gray-400" : "text-gray-500"}`}>
                          {employee.position || "No position"}
                        </span>
                        {employee.status !== "Active" && (
                          <span className="text-xs text-red-500 mt-1 font-medium">(Inactive)</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - Employee Form */}
        <div className="col-span-1 lg:col-span-9">
          <div className="bg-white border border-gray-300 rounded-lg">
            <div className="bg-gray-100 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-300">
              <h2 className="text-lg font-semibold text-gray-800">
                {selectedEmployee ? "Edit Employee Payroll Details" : "Select an Employee"}
              </h2>
              {selectedEmployee && <p className="text-xs text-gray-500 mt-1">Configure payroll settings for this employee</p>}
            </div>

            {loadingDetails ? (
              <LoadingSpinner />
            ) : !selectedEmployee ? (
              <div className="p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500">Select an employee from the list to view and edit their payroll details</p>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                {/* Employee Info Section (Read-Only) */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Employee Information</h3>

                  {/* Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                      <input
                        type="text"
                        value={`${formData.firstName}`}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastName}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">SS Number (format: ###-##-####)</label>
                      <input
                        type="text"
                        value={formatSSN(formData.ssnItin)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Address Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={formData.city}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                      <input
                        type="text"
                        value={formData.state}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Zip and Status Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Zip</label>
                      <input
                        type="text"
                        value={formData.zip}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                      <input
                        type="text"
                        value={formData.position}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Active</label>
                      <div className="flex items-center h-10">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          disabled
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded cursor-not-allowed"
                        />
                        <span className="ml-2 text-sm text-gray-600">{formData.isActive ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payroll Details Section */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll Settings</h3>

                  {/* Pay Type and Rate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
                      <select
                        value={formData.maritalStatus}
                        onChange={(e) => handleInputChange("maritalStatus", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="head_of_household">Head of Household</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pay Type</label>
                      <select
                        value={formData.payType}
                        onChange={(e) => handleInputChange("payType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="salary">Salary</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.payType === "salary" ? "Salary Amount" : "Hourly Pay Rate"}
                      </label>
                      <input
                        type="text"
                        value={formData.payRate}
                        onChange={(e) => handleInputChange("payRate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Driver Rate (per hour)</label>
                      <input
                        type="text"
                        value={formData.driverPayRate}
                        onChange={(e) => handleInputChange("driverPayRate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Tax Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PTO Hours Balance</label>
                      <input
                        type="text"
                        value={formData.ptoHoursBalance}
                        onChange={(e) => handleInputChange("ptoHoursBalance", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional Fed Income Tax</label>
                      <input
                        type="text"
                        value={formData.additionalFedIncomeTax}
                        onChange={(e) => handleInputChange("additionalFedIncomeTax", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Additional State Income Tax</label>
                      <input
                        type="text"
                        value={formData.additionalStateIncomeTax}
                        onChange={(e) => handleInputChange("additionalStateIncomeTax", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.withCalSavers}
                          onChange={(e) => handleInputChange("withCalSavers", e.target.checked)}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 mr-2"
                        />
                        <span className="text-sm text-gray-700">With CalSavers</span>
                      </label>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium text-gray-700 mt-6 mb-3">Tax Exemptions</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Yes means this employee is exempt — that tax is withheld at $0.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {TAX_EXEMPTION_FIELDS.map(({ key, label }) => (
                      <ExemptToggle
                        key={key}
                        label={label}
                        value={formData[key]}
                        onChange={(next) => handleInputChange(key, next)}
                      />
                    ))}
                  </div>
                </div>

                {/* Tax Rate Overrides */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Tax Rate Overrides
                    <span className="font-normal text-gray-500 ml-2">
                      (Auto uses the company&apos;s bracket tables; Custom applies a flat % of gross pay each period)
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Federal Tax Rate</label>
                      <select
                        value={formData.federalRateMode}
                        onChange={(e) => handleRateModeChange("federalRateMode", "customFederalRate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="auto">Auto (company brackets)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Federal Custom Rate</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.customFederalRate}
                          onChange={(e) => handleInputChange("customFederalRate", e.target.value)}
                          disabled={formData.federalRateMode !== "custom"}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State Tax Rate</label>
                      <select
                        value={formData.stateRateMode}
                        onChange={(e) => handleRateModeChange("stateRateMode", "customStateRate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="auto">Auto (company brackets)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">State Custom Rate</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.customStateRate}
                          onChange={(e) => handleInputChange("customStateRate", e.target.value)}
                          disabled={formData.stateRateMode !== "custom"}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Earning Rates Section */}
                {customRateEarningTypes.length > 0 && (
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Custom Earning Rates
                      <span className="font-normal text-gray-500 ml-2">(Rates specific to this employee)</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {customRateEarningTypes.map((earningType) => (
                        <div key={earningType.earningTypeId}>
                          <label className="block text-sm font-medium text-gray-700 mb-2">{earningType.label} Rate</label>
                          <input
                            type="text"
                            value={formData.earningRates[earningType.earningTypeId] || ""}
                            onChange={(e) => handleEarningRateChange(earningType.earningTypeId, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="0.00"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-4">
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    {saving ? "RESETTING..." : "RESET"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-8 py-3 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50"
                  >
                    {saving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Employee;
