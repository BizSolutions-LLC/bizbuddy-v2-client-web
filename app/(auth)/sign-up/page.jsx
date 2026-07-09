// app/(auth)/sign-up.page.jsx

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Footer from "@/components/Partial/Footer";
import { motion, AnimatePresence } from "framer-motion";

export default function SignUpPage() {
  const router = useRouter();
  const formRef = useRef(null);
  const [step, setStep] = useState(1);

  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
  });
  const [companyForm, setCompanyForm] = useState({ name: "" });

  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [error, setError] = useState("");

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const storedPlan = localStorage.getItem("selectedPlan");
    if (storedPlan) setSelectedPlan(JSON.parse(storedPlan));

    const storedUser = localStorage.getItem("userForm");
    if (storedUser) setUserForm(JSON.parse(storedUser));

    const storedCompany = localStorage.getItem("companyForm");
    if (storedCompany) setCompanyForm(JSON.parse(storedCompany));

    const storedPaymentStatus = localStorage.getItem("paymentStatus");
    if (storedPaymentStatus === "paid") {
      setPaymentStatus("paid");
      setStep(3);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (formRef.current && !formRef.current.contains(event.target)) {
        setUsernameError("");
        setEmailError("");
        setPasswordError("");
        setPhoneNumberError("");
        setCompanyError("");
        setFirstNameError("");
        setLastNameError("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUserChange = (e) => {
    const updated = { ...userForm, [e.target.name]: e.target.value };
    setUserForm(updated);
    localStorage.setItem("userForm", JSON.stringify(updated));
  };

  const handleCompanyChange = (e) => {
    const updated = { ...companyForm, [e.target.name]: e.target.value };
    setCompanyForm(updated);
    localStorage.setItem("companyForm", JSON.stringify(updated));
  };

  const checkUsernameAvailability = async () => {
    if (!userForm.username.trim()) {
      setUsernameError("Username is required.");
      return;
    }
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/account/check-username?username=${encodeURIComponent(userForm.username)}`);
      if (!res.ok) {
        throw new Error("Error checking username");
      }
      const data = await res.json();
      if (!data.data.available) {
        setUsernameError("Username is already taken.");
      } else {
        setUsernameError("");
      }
    } catch (err) {
      setUsernameError("Error checking username.");
    }
  };

  const checkCompanyAvailability = async () => {
    if (!companyForm.name.trim()) {
      setCompanyError("Company name is required.");
      return false;
    }
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const res = await fetch(`${baseUrl}/api/account/check-company-name?name=${encodeURIComponent(companyForm.name)}`);
      if (!res.ok) {
        throw new Error("Error checking company name");
      }
      const data = await res.json();
      if (data.data.exists) {
        setCompanyError("Company name is already in use.");
        return false;
      } else {
        setCompanyError("");
        return true;
      }
    } catch (err) {
      setCompanyError("Error checking company name.");
      return false;
    }
  };

  const validatePassword = () => {
    const { password } = userForm;
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setPasswordError("Password must include at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      setPasswordError("Password must include at least one lowercase letter.");
      return;
    }
    if (!/\d/.test(password)) {
      setPasswordError("Password must include at least one number.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setPasswordError("Password must include at least one symbol.");
      return;
    }
    setPasswordError("");
  };

  const validatePhoneNumber = () => {
    const { phoneNumber } = userForm;
    if (phoneNumber.trim() === "") {
      setPhoneNumberError("");
      return;
    }
    if (!/^\d+$/.test(phoneNumber)) {
      setPhoneNumberError("Phone number must contain digits only.");
    } else {
      setPhoneNumberError("");
    }
  };

  const handleEmailBlur = () => {
    if (!userForm.email.trim()) {
      setEmailError("Email is required.");
    } else {
      setEmailError("");
    }
  };

  const handleFirstNameBlur = () => {
    if (!userForm.firstName.trim()) {
      setFirstNameError("First name is required.");
    } else {
      setFirstNameError("");
    }
  };

  const handleLastNameBlur = () => {
    if (!userForm.lastName.trim()) {
      setLastNameError("Last name is required.");
    } else {
      setLastNameError("");
    }
  };

  const handleCompanyBlur = () => {
    if (!companyForm.name.trim()) {
      setCompanyError("Company name is required.");
    } else {
      checkCompanyAvailability();
    }
  };

  const validateStep1 = () => {
    return (
      userForm.username.trim() !== "" &&
      userForm.email.trim() !== "" &&
      userForm.password.trim() !== "" &&
      userForm.firstName.trim() !== "" &&
      userForm.lastName.trim() !== "" &&
      usernameError === "" &&
      emailError === "" &&
      passwordError === "" &&
      firstNameError === "" &&
      lastNameError === ""
    );
  };

  const validateStep2 = () => {
    return companyForm.name.trim() !== "" && companyError === "";
  };

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      const isAvailable = await checkCompanyAvailability();
      if (!isAvailable) return;
      setStep(3);
    }
  };

  const handleBack = () => setStep((prev) => prev - 1);
  const handlePayment = () => {
    router.push("/payment");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 3 || paymentStatus !== "paid") return;

    setLoading(true);
    setError("");

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      const planId = selectedPlan ? selectedPlan.id : null;

      const payload = {
        firstName: userForm.firstName,
        lastName: userForm.lastName,
        email: userForm.email,
        password: userForm.password,
        companyName: companyForm.name,
        subscriptionPlanId: planId,
        isPaid: paymentStatus === "paid",
        username: userForm.username,
      };

      const res = await fetch(`${baseUrl}/api/account/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Signup failed");
      }

      localStorage.removeItem("userForm");
      localStorage.removeItem("companyForm");
      localStorage.removeItem("paymentStatus");
      localStorage.removeItem("selectedPlan");

      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col justify-between bg-gradient-to-b from-orange-50 to-white dark:from-neutral-950 dark:to-neutral-900"
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
          <h2 className="text-3xl md:text-4xl font-bold text-orange-600 dark:text-orange-500">Create Your Account</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">Join us to start managing your business</p>
        </motion.div>

        <motion.div className="max-w-md mx-auto mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all duration-300 ${
                    stepNumber < step
                      ? "bg-green-500 text-white"
                      : stepNumber === step
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {stepNumber < step ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`text-xs ${
                    step === stepNumber ? "text-orange-600 dark:text-orange-500 font-medium" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {stepNumber === 1 ? "User" : stepNumber === 2 ? "Company" : "Plan"}
                </span>
              </div>
            ))}
            <div className="h-1 bg-neutral-200 dark:bg-neutral-700 absolute left-0 right-0 top-5 -z-10 mx-12"></div>
          </div>
        </motion.div>

        <motion.form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-6 max-w-md mx-auto bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-lg border border-neutral-100 dark:border-neutral-700"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-semibold mb-4">User Details</h2>
                <div className="grid grid-cols-1  text-sm">
                  <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={userForm.username}
                    onChange={handleUserChange}
                    onBlur={checkUsernameAvailability}
                    className={`w-full p-3 rounded-xl border ${
                      usernameError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : userForm.username
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                    required
                  />
                  {usernameError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {usernameError}
                    </div>
                  )}
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={userForm.email}
                    onChange={handleUserChange}
                    onBlur={handleEmailBlur}
                    className={`w-full p-3 rounded-xl border ${
                      emailError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : userForm.email
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                    required
                  />
                  {emailError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {emailError}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={userForm.password}
                      onChange={handleUserChange}
                      onBlur={validatePassword}
                      className={`w-full p-3 pr-10 rounded-xl border ${
                        passwordError
                          ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                          : userForm.password
                          ? "border-green-300 dark:border-green-700"
                          : "border-neutral-300 dark:border-neutral-600"
                      } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.96 9.96 0 012.112-3.321M15 12a3 3 0 00-3-3m0 0a3 3 0 00-3 3m6 0a3 3 0 00-3-3"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {passwordError}
                    </div>
                  )}
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={userForm.firstName}
                    onChange={handleUserChange}
                    onBlur={handleFirstNameBlur}
                    className={`w-full p-3 rounded-xl border ${
                      firstNameError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : userForm.firstName
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                    required
                  />
                  {firstNameError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {firstNameError}
                    </div>
                  )}
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={userForm.lastName}
                    onChange={handleUserChange}
                    onBlur={handleLastNameBlur}
                    className={`w-full p-3 rounded-xl border ${
                      lastNameError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : userForm.lastName
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                    required
                  />
                  {lastNameError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {lastNameError}
                    </div>
                  )}
                  <input
                    type="text"
                    name="phoneNumber"
                    placeholder="Phone Number"
                    value={userForm.phoneNumber}
                    onChange={handleUserChange}
                    onBlur={validatePhoneNumber}
                    className={`w-full p-3 rounded-xl border ${
                      phoneNumberError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : userForm.phoneNumber
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                  />
                  {phoneNumberError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {phoneNumberError}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-semibold mb-4">Company Details</h2>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <input
                    type="text"
                    name="name"
                    placeholder="Company Name"
                    value={companyForm.name}
                    onChange={handleCompanyChange}
                    onBlur={handleCompanyBlur}
                    className={`w-full p-3 rounded-xl border ${
                      companyError
                        ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                        : companyForm.name
                        ? "border-green-300 dark:border-green-700"
                        : "border-neutral-300 dark:border-neutral-600"
                    } bg-white dark:bg-neutral-800 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200`}
                    required
                  />
                  {companyError && (
                    <div className="flex items-center text-red-500 text-sm px-1 mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {companyError}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-semibold mb-4">Selected Plan</h2>
                {selectedPlan ? (
                  <div className="p-6 rounded-xl bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-lg text-orange-600 dark:text-orange-400">{selectedPlan.name} Plan</span>
                      <span className="text-xl font-bold">${selectedPlan.price}</span>
                    </div>
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center text-neutral-700 dark:text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <p>{selectedPlan.rangeOfUsers} users</p>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 pl-7">{selectedPlan.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-6 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${paymentStatus === "paid" ? "bg-green-500" : "bg-red-500"}`}></div>
                        <span
                          className={`font-medium ${paymentStatus === "paid" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {paymentStatus === "paid" ? "Payment Complete" : "Payment Required"}
                        </span>
                      </div>
                      {paymentStatus === "unpaid" && (
                        <button
                          type="button"
                          onClick={() => router.push("/payment")}
                          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-dashed border-neutral-300 dark:border-neutral-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 mx-auto text-neutral-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-neutral-600 dark:text-neutral-400 mt-4">No plan selected.</p>
                    <button type="button" onClick={() => router.push("/plans")} className="mt-4 text-orange-600 dark:text-orange-400 underline text-sm">
                      Browse Available Plans
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 && !(step === 3 && paymentStatus === "paid") && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center px-5 py-2.5 rounded-xl font-medium text-sm bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={(step === 1 && !validateStep1()) || (step === 2 && !validateStep2())}
                className={`ml-auto flex items-center px-5 py-2.5 rounded-xl font-medium text-sm ${
                  (step === 1 && !validateStep1()) || (step === 2 && !validateStep2())
                    ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200"
                }`}
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            {step === 3 && (
              <button
                type="submit"
                disabled={loading || paymentStatus !== "paid"}
                className={`ml-auto flex items-center px-5 py-2.5 rounded-xl font-medium text-sm ${
                  loading || paymentStatus !== "paid"
                    ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-sm hover:shadow transition-all duration-200"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Registration
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.form>
      </div>
      <Footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 py-6" />
    </motion.div>
  );
}
