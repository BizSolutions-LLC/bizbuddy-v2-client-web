// app/dashboard/company/cutoff-periods/page.jsx
import EmployeeCutoff from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeCutoff";

export const metadata = {
  title: "Employee Cutoff | BizBuddy",
  description: "Manage payroll cutoff periods and approve employee time logs",
};

export default function CutoffPeriodsPage() {
  return <EmployeeCutoff />;
}