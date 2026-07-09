// components/Dashboard/DashboardContent/CompanyPanel/Settings/CompanyProfile.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { Building, Phone, Globe, MapPin, Trash2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

const API = process.env.NEXT_PUBLIC_API_URL;

const FormSection = ({ icon: Icon, title, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-orange-500/20">
      <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
    </div>
    <div className="space-y-4 pl-10">{children}</div>
  </div>
);

const FormField = ({ label, children, required = false, description }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-muted-foreground">
      {label} {required && <span className="text-orange-500">*</span>}
    </Label>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
    {children}
  </div>
);

export default function CompanyProfile() {
  const { token, role } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    dba: "",
    ein: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phoneNumber: "",
    businessEmail: "",
    websiteUrl: "",
    currency: "",
    language: "",
  });

  useEffect(() => {
    if (!token) return;

    fetch(`${API}/api/company/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setForm((f) => ({ ...f, ...j.data }));
          const clean = Object.fromEntries(Object.entries(j.data).map(([k, v]) => [k, v ?? ""]));
          setForm((f) => ({ ...f, ...clean }));
        } else {
          throw new Error(j.message || "Unable to load company");
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/company/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (r.ok) toast.success("Company profile updated!");
      else {
        const j = await r.json();
        throw new Error(j.error || "Save failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete company profile? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API}/api/company/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) toast.success("Company deleted. You will be logged out.");
      else {
        const j = await r.json();
        throw new Error(j.error || "Delete failed");
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 lg:px-6 px-2 space-y-6">
      <Toaster position="top-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building className="h-7 w-7 text-orange-500" />
            Company Profile
          </h2>
          <p className="text-muted-foreground mt-1">Manage your organisation’s identity and contact details</p>
        </div>
      </div>

      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Building className="h-5 w-5" />
            </div>
            Company Information
          </CardTitle>
          <CardDescription>Update legal and contact data</CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {loading ? (
            <div className="space-y-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <FormSection icon={Building} title="Identity">
                <FormField label="Legal Business Name" required>
                  <Input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. BizSolutions LLC"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>

                <FormField label="DBA (Doing Business As)">
                  <Input
                    name="dba"
                    value={form.dba}
                    onChange={handleChange}
                    placeholder="e.g. BizBuddy"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>

                <FormField label="Employer Identification Number (EIN)">
                  <Input
                    name="ein"
                    value={form.ein}
                    onChange={handleChange}
                    placeholder="12-3456789"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>
              </FormSection>

              <FormSection icon={Phone} title="Contact">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Phone Number">
                    <Input
                      name="phoneNumber"
                      value={form.phoneNumber}
                      onChange={handleChange}
                      placeholder="(555) 123-4567"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>

                  <FormField label="Business Email" required>
                    <Input
                      name="businessEmail"
                      type="email"
                      value={form.businessEmail}
                      onChange={handleChange}
                      placeholder="support@company.com"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>

                  <FormField label="Website URL">
                    <Input
                      name="websiteUrl"
                      value={form.websiteUrl}
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection icon={MapPin} title="Address">
                <FormField label="Address Line 1">
                  <Input
                    name="addressLine1"
                    value={form.addressLine1}
                    onChange={handleChange}
                    placeholder="123 Innovation Blvd"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>

                <FormField label="Address Line 2">
                  <Input
                    name="addressLine2"
                    value={form.addressLine2}
                    onChange={handleChange}
                    placeholder="Suite 400"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField label="City">
                    <Input
                      name="city"
                      value={form.city}
                      onChange={handleChange}
                      placeholder="Cupertino"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>

                  <FormField label="State / Province">
                    <Input
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      placeholder="CA"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>

                  <FormField label="Postal Code">
                    <Input
                      name="postalCode"
                      value={form.postalCode}
                      onChange={handleChange}
                      placeholder="95014"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                </div>

                <FormField label="Country">
                  <Input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="USA"
                    className="focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </FormField>
              </FormSection>

              <FormSection icon={Globe} title="Locale & Preferences">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Currency" required>
                    <Input
                      name="currency"
                      value={form.currency}
                      onChange={handleChange}
                      placeholder="USD"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>

                  <FormField label="Language">
                    <Input
                      name="language"
                      value={form.language}
                      onChange={handleChange}
                      placeholder="en"
                      className="focus:border-orange-500 focus:ring-orange-500/20"
                    />
                  </FormField>
                </div>
              </FormSection>

              <div className="pt-6 border-t border-orange-500/20 flex flex-col gap-4">
                <Button
                  disabled={saving}
                  onClick={save}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3"
                  size="lg"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving Changes...
                    </>
                  ) : (
                    "Save Company Profile"
                  )}
                </Button>

                {role === "superadmin" && (
                  <Button disabled={deleting} onClick={remove} variant="destructive" className="w-full py-3" size="lg">
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Company
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
