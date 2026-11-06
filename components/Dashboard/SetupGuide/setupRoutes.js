// components/Dashboard/SetupGuide/setupRoutes.js
// BB-115 — maps the server's step `page` to a client route. `navId` is the sidebar nav id
// used for plan locking (lockChildByPlan). `null` = no page on web yet (holidays).

const PAGES = {
  company_profile:     { navId: "company/profile",        route: "/dashboard/company/profile" },
  departments:         { navId: "company/departments",    route: "/dashboard/company/departments" },
  locations:           { navId: "company/locations",      route: "/dashboard/company/locations" },
  employees:           { navId: "company/employees",      route: "/dashboard/company/employees" },
  shifts:              { navId: "company/shifts",         route: "/dashboard/company/shifts" },
  schedules:           { navId: "company/schedules",      route: "/dashboard/company/schedules" },
  cutoff_settings:     { navId: "company/configurations", route: "/dashboard/company/configurations?tab=ot-config" },
  cutoff_periods:      { navId: "company/cutoff-periods", route: "/dashboard/company/cutoff-periods" },
  attendance_settings: { navId: "company/configurations", route: "/dashboard/company/configurations?tab=time-settings" },
  leave_policies:      { navId: "company/leave-settings", route: "/dashboard/company/leave-settings?section=leave-types" },
  leave_settings:      { navId: "company/leave-settings", route: "/dashboard/company/leave-settings?section=leave-credits" },
  payroll_settings:    { navId: "employee/payroll",       route: "/dashboard/employee/payroll?tab=company" },
  holidays:            null,
};

export function resolveStepPage(page) {
  return PAGES[page] || null;
}
