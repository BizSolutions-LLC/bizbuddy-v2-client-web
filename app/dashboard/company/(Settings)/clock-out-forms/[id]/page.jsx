// app/dashboard/company/(Settings)/clock-out-forms/[id]/page.jsx
// BB-129 phase 1: build ("new") or edit one custom clock-out form.
import TaskReportFormEditor from "@/components/Dashboard/DashboardContent/CompanyPanel/Settings/TaskReportFormEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Clock-out Form | BizBuddy",
};

export default async function ClockOutFormPage({ params }) {
  const { id } = await params;
  return <TaskReportFormEditor formId={id} />;
}
