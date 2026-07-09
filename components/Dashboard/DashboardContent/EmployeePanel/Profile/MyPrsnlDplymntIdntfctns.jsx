/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { User, MapPin, Shield, Users, Eye, EyeOff, AtSign, AlertCircle, CheckCircle, Info } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// SSN/ITIN AUTO-FORMAT HELPER
// Format: XXX-XX-XXXX
// ============================================
const formatSSN = (value) => {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Limit to 9 digits
  const limited = numbers.slice(0, 9);
  
  // Format as XXX-XX-XXXX
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 5) {
    return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  } else {
    return `${limited.slice(0, 3)}-${limited.slice(3, 5)}-${limited.slice(5)}`;
  }
};

const FormSection = ({ icon: Icon, title, children, description }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
      <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </div>
    <div className="space-y-4 pl-10">{children}</div>
  </div>
);

const FormField = ({ label, children, required = false, description, error, success }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Label className={`text-sm font-medium ${error ? 'text-red-600' : success ? 'text-green-600' : 'text-muted-foreground'}`}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {description && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-xs">{description}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
    {children}
    {error && (
      <div className="flex items-center gap-1 text-red-600 text-xs">
        <AlertCircle className="h-3 w-3" />
        {error}
      </div>
    )}
    {success && (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle className="h-3 w-3" />
        {success}
      </div>
    )}
  </div>
);

export default function MyPrsnlDplymntIdntfctns() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSSN, setShowSSN] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [touched, setTouched] = useState({});

  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    ssnItin: "",
    dateOfBirth: "",
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  // ============================================
  // REAL-TIME VALIDATION
  // ============================================
  const validateField = (name, value) => {
    const errors = {};

    switch (name) {
      case 'username':
        if (!value.trim()) {
          errors.username = 'Username is required';
        } else if (value.trim().length < 3) {
          errors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-z0-9]([a-z0-9._]*[a-z0-9])?$/i.test(value.trim())) {
          errors.username = 'Must start and end with letter/number. Only letters, numbers, periods (.) and underscores (_) allowed';
        } else if (/[._]{2,}/.test(value.trim())) {
          errors.username = 'Cannot contain consecutive periods or underscores';
        }
        break;
      case 'email':
        if (!value.trim()) {
          errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'phoneNumber':
        if (value && !/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
          errors.phoneNumber = 'Please enter a valid phone number';
        }
        break;
      case 'emergencyContactPhone':
        if (value && !/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
          errors.emergencyContactPhone = 'Please enter a valid phone number';
        }
        break;
      case 'ssnItin':
        if (value) {
          // Remove dashes for length check
          const digitsOnly = value.replace(/\D/g, '');
          if (digitsOnly.length > 0 && digitsOnly.length !== 9) {
            errors.ssnItin = 'SSN/ITIN must be 9 digits (format: XXX-XX-XXXX)';
          }
        }
        break;
      case 'postalCode':
        if (value && !/^\d{5}(-\d{4})?$/.test(value)) {
          errors.postalCode = 'Format: 12345 or 12345-6789';
        }
        break;
      case 'dateOfBirth':
        if (value) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.dateOfBirth = 'Please enter a valid date';
          }
        }
        break;
    }

    return errors;
  };

  // ============================================
  // HANDLE FIELD CHANGE (with SSN auto-format)
  // ============================================
  const handleFieldChange = (name, value) => {
    // Auto-format SSN/ITIN
    if (name === 'ssnItin') {
      const formattedValue = formatSSN(value);
      setForm(f => ({ ...f, [name]: formattedValue }));

      if (touched[name]) {
        const fieldErrors = validateField(name, formattedValue);
        setValidationErrors(prev => ({
          ...prev,
          [name]: fieldErrors[name]
        }));
      }
      return;
    }

    setForm(f => ({ ...f, [name]: value }));

    // Validate on change if field has been touched
    if (touched[name]) {
      const fieldErrors = validateField(name, value);
      setValidationErrors(prev => ({
        ...prev,
        [name]: fieldErrors[name]
      }));
    }
  };

  const handleFieldBlur = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const fieldErrors = validateField(name, form[name]);
    setValidationErrors(prev => ({
      ...prev,
      [name]: fieldErrors[name]
    }));
  };

  // ============================================
  // FETCH PROFILE ON MOUNT
  // ============================================
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        const p = j?.data?.profile;
        const u = j?.data?.user;
        if (p || u) {
          setForm({
            username: u?.username || p?.username || "",
            email: u?.email || p?.email || "",
            firstName: p?.firstName || "",
            lastName: p?.lastName || "",
            phoneNumber: p?.phoneNumber || "",
            ssnItin: p?.ssnItin || "",
            dateOfBirth: p?.dateOfBirth ? p.dateOfBirth.split("T")[0] : "",
            addressLine: p?.addressLine || "",
            city: p?.city || "",
            state: p?.state || "",
            postalCode: p?.postalCode || "",
            emergencyContactName: p?.emergencyContactName || "",
            emergencyContactPhone: p?.emergencyContactPhone || "",
          });
        }
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token]);

  // ============================================
  // SAVE PROFILE
  // ============================================
  const save = async () => {
    // Validate all required fields
    const usernameErrors = validateField('username', form.username);
    const emailErrors = validateField('email', form.email);
    const ssnErrors = validateField('ssnItin', form.ssnItin);
    const postalCodeErrors = validateField('postalCode', form.postalCode);
    const dobErrors = validateField('dateOfBirth', form.dateOfBirth);

    const allErrors = {
      ...usernameErrors,
      ...emailErrors,
      ...ssnErrors,
      ...postalCodeErrors,
      ...dobErrors,
    };

    if (Object.keys(allErrors).some(key => allErrors[key])) {
      setValidationErrors(prev => ({ ...prev, ...allErrors }));
      setTouched({
        username: true,
        email: true,
        ssnItin: true,
        postalCode: true,
        dateOfBirth: true,
      });
      toast.error("Please fix the validation errors before saving");
      return;
    }

    setSaving(true);
    try {
      // Send all fields to backend
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        ssnItin: form.ssnItin.trim(),
        dateOfBirth: form.dateOfBirth || null,
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
      };

      const r = await fetch(`${API}/api/account/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const response = await r.json();

      if (r.ok) {
        toast.success("Profile saved successfully!");
        setValidationErrors({});
      } else {
        toast.error(response.message || response.error || "Save failed");

        // Handle specific backend validation errors
        if (response.message?.toLowerCase().includes("username")) {
          setValidationErrors(prev => ({ ...prev, username: response.message }));
        }
        if (response.message?.toLowerCase().includes("email")) {
          setValidationErrors(prev => ({ ...prev, email: response.message }));
        }
        if (response.message?.toLowerCase().includes("ssn") || response.message?.toLowerCase().includes("itin")) {
          setValidationErrors(prev => ({ ...prev, ssnItin: response.message }));
        }
      }
    } catch (error) {
      toast.error("Save failed. Please try again.");
    }
    setSaving(false);
  };

  const hasRequiredFields = form.username.trim() && form.email.trim();
  const hasValidationErrors = Object.values(validationErrors).some(error => error);
  const isFormValid = hasRequiredFields && !hasValidationErrors;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-4xl mx-auto p-4 lg:px-6 px-2 space-y-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-7 w-7 text-orange-500" />
            Personal &amp; Identification
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and identification details
          </p>
        </div>
      </div>

      {/* Information Alert */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <span className="font-medium">Required fields:</span> Only username and email are required to save your profile.
          Other information is optional but helps complete your employee record.
        </AlertDescription>
      </Alert>

      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Shield className="h-5 w-5" />
            </div>
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal details and contact information. Fields marked with
            <span className="text-red-500 mx-1">*</span> are required.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {loading ? (
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <FormSection
                icon={AtSign}
                title="Account Information"
                description="Essential account credentials required for system access"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Username"
                    required
                    description="Letters, numbers, periods (.) and underscores (_) only. Must start and end with letter/number."
                    error={validationErrors.username}
                    success={touched.username && !validationErrors.username && form.username ? "Valid username" : null}
                  >
                    <Input
                      placeholder="Enter your username"
                      value={form.username}
                      onChange={(e) => handleFieldChange('username', e.target.value)}
                      onBlur={() => handleFieldBlur('username')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.username ? 'border-red-500 focus:border-red-500' :
                        touched.username && !validationErrors.username && form.username ? 'border-green-500' : ''
                      }`}
                    />
                  </FormField>
                  <FormField
                    label="Email Address"
                    required
                    description="Must be unique within your company"
                    error={validationErrors.email}
                    success={touched.email && !validationErrors.email && form.email ? "Valid email format" : null}
                  >
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={form.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      onBlur={() => handleFieldBlur('email')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.email ? 'border-red-500 focus:border-red-500' :
                        touched.email && !validationErrors.email && form.email ? 'border-green-500' : ''
                      }`}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                icon={User}
                title="Personal Information"
                description="Optional personal details for your employee profile"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="First Name">
                    <Input
                      placeholder="Enter your first name"
                      value={form.firstName}
                      onChange={(e) => handleFieldChange('firstName', e.target.value)}
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                  <FormField label="Last Name">
                    <Input
                      placeholder="Enter your last name"
                      value={form.lastName}
                      onChange={(e) => handleFieldChange('lastName', e.target.value)}
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Phone Number"
                    error={validationErrors.phoneNumber}
                    description="Your primary contact number"
                  >
                    <Input
                      placeholder="(555) 123-4567"
                      value={form.phoneNumber}
                      onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                      onBlur={() => handleFieldBlur('phoneNumber')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.phoneNumber ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                    />
                  </FormField>
                  <FormField
                    label="Date of Birth"
                    description="Used for age verification and benefits"
                    error={validationErrors.dateOfBirth}
                  >
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                      onBlur={() => handleFieldBlur('dateOfBirth')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.dateOfBirth ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                icon={Shield}
                title="Identification"
                description="Sensitive identification information (stored securely)"
              >
                <div className="max-w-md">
                  <FormField
                    label="SSN / ITIN"
                    description="Social Security Number or Individual Taxpayer Identification Number"
                    error={validationErrors.ssnItin}
                    success={touched.ssnItin && !validationErrors.ssnItin && form.ssnItin.length === 11 ? "Valid format" : null}
                  >
                    <div className="relative">
                      <Input
                        placeholder="000-00-0000"
                        type={showSSN ? "text" : "password"}
                        value={form.ssnItin}
                        onChange={(e) => handleFieldChange('ssnItin', e.target.value)}
                        onBlur={() => handleFieldBlur('ssnItin')}
                        maxLength={11}
                        className={`focus:border-orange-500 focus:ring-orange-500/20 pr-12 ${
                          validationErrors.ssnItin ? 'border-red-500 focus:border-red-500' :
                          touched.ssnItin && !validationErrors.ssnItin && form.ssnItin.length === 11 ? 'border-green-500' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSSN(!showSSN)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-500 transition-colors"
                        aria-label={showSSN ? "Hide SSN/ITIN" : "Show SSN/ITIN"}
                      >
                        {showSSN ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                icon={MapPin}
                title="Address Information"
                description="Your primary residential address"
              >
                <FormField label="Address Line">
                  <Input
                    placeholder="123 Main Street, Apt 4B"
                    value={form.addressLine}
                    onChange={(e) => handleFieldChange('addressLine', e.target.value)}
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="City">
                    <Input
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                  <FormField label="State">
                    <Input
                      placeholder="State"
                      value={form.state}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                  <FormField
                    label="Postal Code"
                    error={validationErrors.postalCode}
                  >
                    <Input
                      placeholder="12345"
                      value={form.postalCode}
                      onChange={(e) => handleFieldChange('postalCode', e.target.value)}
                      onBlur={() => handleFieldBlur('postalCode')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.postalCode ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection
                icon={Users}
                title="Emergency Contact"
                description="Someone to contact in case of emergency"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Contact Name">
                    <Input
                      placeholder="Emergency contact full name"
                      value={form.emergencyContactName}
                      onChange={(e) => handleFieldChange('emergencyContactName', e.target.value)}
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                  <FormField
                    label="Contact Phone"
                    error={validationErrors.emergencyContactPhone}
                  >
                    <Input
                      placeholder="(555) 987-6543"
                      value={form.emergencyContactPhone}
                      onChange={(e) => handleFieldChange('emergencyContactPhone', e.target.value)}
                      onBlur={() => handleFieldBlur('emergencyContactPhone')}
                      className={`focus:border-orange-500 focus:ring-orange-500/20 ${
                        validationErrors.emergencyContactPhone ? 'border-red-500 focus:border-red-500' : ''
                      }`}
                    />
                  </FormField>
                </div>
              </FormSection>

              {/* Save Section */}
              <div className="pt-6 border-t border-orange-500/20">
                <div className="space-y-4">
                  {hasValidationErrors && (
                    <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        Please fix the validation errors above before saving your profile.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    disabled={saving || !isFormValid}
                    onClick={save}
                    className={`w-full font-medium py-3 transition-all ${
                      isFormValid
                        ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300'
                    }`}
                    size="lg"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Profile Information"
                    )}
                  </Button>

                  {!hasRequiredFields && (
                    <p className="text-sm text-muted-foreground text-center">
                      Username and email are required to save your profile
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}