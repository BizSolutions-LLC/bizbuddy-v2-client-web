// app/dashboard/company/cutoff-periods/page.jsx
// BB-121: CutoffPeriodsSwitch picks the List (EmployeeCutoff) or Calendar page per company setting.
import CutoffPeriodsSwitch from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/CutoffPeriodsSwitch";

export const metadata = {
  title: "Employee Cutoff | BizBuddy",
  description: "Manage payroll cutoff periods and approve employee time logs",
};

export default function CutoffPeriodsPage() {
  return <CutoffPeriodsSwitch />;
}