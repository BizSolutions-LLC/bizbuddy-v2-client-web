// app/dashboard/company/employee-schedules/page.jsx
//
// BB-135: the old Requests & Logs → Employee Schedule page (coverage cards + one employee's
// shifts) was merged into Shifts & Schedules → Employees Schedule (coverage cards on top,
// Calendar view for one employee, Roster for everyone). This address stays so old links,
// bookmarks and notifications still land on the right page.

import { redirect } from "next/navigation";

export default function EmployeeSchedulesRedirect() {
  redirect("/dashboard/company/schedules");
}
