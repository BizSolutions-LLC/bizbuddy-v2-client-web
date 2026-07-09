/* components/Dashboard/DashboardContent/Profile/MyEmplymntDtls.jsx */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building, Users, Calendar } from "lucide-react";
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

const FormField = ({ label, children, description }) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    {description && <p className="text-xs text-muted-foreground">{description}</p>}
    {children}
  </div>
);

export default function MyEmplymntDtls() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [departments, setDeps] = useState([]);
  const [form, setForm] = useState({
    jobTitle: "",
    departmentId: "none",
    supervisorId: "",
    employmentStatus: "none",
    exemptStatus: "none",
    employmentType: "none",
    probationEndDate: "",
    workLocation: "none",
    timeZone: "",
  });

  useEffect(() => {
    if (!token) return;

    const fetchDeps = fetch(`${API}/api/departments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setDeps(j.data || []))
      .catch(() => {});

    const fetchDetails = fetch(`${API}/api/employment-details/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          const d = j.data;
          setForm({
            jobTitle: d.jobTitle || "",
            departmentId: d.departmentId || "none",
            supervisorId: d.supervisorId || "",
            employmentStatus: d.employmentStatus || "none",
            exemptStatus: d.exemptStatus || "none",
            employmentType: d.employmentType || "none",
            probationEndDate: d.probationEndDate ? d.probationEndDate.split("T")[0] : "",
            workLocation: d.workLocation || "none",
            timeZone: d.timeZone || "",
          });
        }
      })
      .catch(() => toast.error("Failed to load employment details"));

    Promise.all([fetchDeps, fetchDetails]).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-4xl mx-auto p-4 lg:px-6 px-2 space-y-6">
      <Toaster position="top-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-7 w-7 text-orange-500" />
            Employment Details
          </h2>
          <p className="text-muted-foreground mt-1">View your employment information and work details</p>
        </div>
      </div>

      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Building className="h-5 w-5" />
            </div>
            Work Information
          </CardTitle>
          <CardDescription>Your current job details and employment status</CardDescription>
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
              <FormSection icon={Briefcase} title="Job Information">
                <FormField label="Job Title / Role">
                  <Input disabled value={form.jobTitle} className="bg-muted/20" />
                </FormField>
                <FormField label="Department">
                  <Input
                    disabled
                    value={form.departmentId === "none" ? "" : departments.find((d) => d.id === form.departmentId)?.name || ""}
                    className="bg-muted/20"
                  />
                </FormField>
                <FormField label="Supervisor User ID">
                  <Input disabled value={form.supervisorId} className="bg-muted/20" />
                </FormField>
              </FormSection>

              <FormSection icon={Users} title="Employment Status">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Employment Status">
                    <Input disabled value={form.employmentStatus.replaceAll("_", " ")} className="bg-muted/20 capitalize" />
                  </FormField>
                  <FormField label="Exempt Status">
                    <Input disabled value={form.exemptStatus.replaceAll("_", " ")} className="bg-muted/20 capitalize" />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Employment Type">
                    <Input disabled value={form.employmentType.replaceAll("_", " ")} className="bg-muted/20 capitalize" />
                  </FormField>
                  <FormField label="Work Location">
                    <Input disabled value={form.workLocation} className="bg-muted/20 capitalize" />
                  </FormField>
                </div>
              </FormSection>

              <FormSection icon={Calendar} title="Additional Details">
                <FormField label="Probation End Date">
                  <Input disabled type="date" value={form.probationEndDate} className="bg-muted/20" />
                </FormField>
                <FormField label="Time Zone">
                  <Textarea disabled value={form.timeZone} className="bg-muted/20 min-h-[80px]" />
                </FormField>
              </FormSection>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
