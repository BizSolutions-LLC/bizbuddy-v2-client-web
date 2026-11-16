// app/dashboard/company/employee-report/page.jsx
// BB-129: submitted Daily Task Reports, read-only, for supervisors and admins.
import EmployeeTaskReports from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeTaskReports";

export const metadata = {
  title: "Employee Report | BizBuddy",
  description: "Read the daily task reports your employees submitted",
};

export default function EmployeeReportPage() {
  return <EmployeeTaskReports />;
}
