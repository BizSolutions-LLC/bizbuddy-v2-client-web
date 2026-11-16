// app/dashboard/company/employee-map/page.jsx
// BB-128: where employees clocked in and out (supervisors and admins).
import EmployeeMap from "@/components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/EmployeeMap";

export const metadata = {
  title: "Employee Map | BizBuddy",
  description: "See where employees clocked in and out",
};

export default function EmployeeMapPage() {
  return <EmployeeMap />;
}
