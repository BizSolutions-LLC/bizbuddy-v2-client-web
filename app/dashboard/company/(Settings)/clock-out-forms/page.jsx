// app/dashboard/company/(Settings)/clock-out-forms/page.jsx
// BB-129 phase 1: custom clock-out forms (admin / superadmin only).
import TaskReportForms from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportForms";

export const metadata = {
  title: "Clock-out Forms | BizBuddy",
  description: "Build questionnaires for employees to answer after a shift",
};

export default function ClockOutFormsPage() {
  return <TaskReportForms />;
}
