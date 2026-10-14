// components/Dashboard/DashboardContent/EmployeePanel/Documentation/settingsDocsContent.js
//
// BB-097 — Static content for the Company Settings documentation tab.
// Admin / superadmin only (the sidebar's "account" group). Keep labels in sync
// with the real UI when Settings pages change.
//
// Same section/topic shape as companyDocsContent.js (groupId, routeId, topics).

const settingsDocsContent = [
  {
    id: "company-profile",
    groupId: "account",
    routeId: "company/profile",
    title: "Profile",
    summary: "Your company's legal identity, contact details and locale.",
    topics: [
      {
        title: "Updating the company profile",
        steps: [
          "Go to Settings → Profile.",
          "Update Identity (Legal Business Name, DBA, EIN), Contact (phone, business email, website), Address, and Locale & Preferences (currency, language).",
          "Save your changes.",
        ],
      },
    ],
  },
  {
    id: "configurations",
    groupId: "account",
    routeId: "company/configurations",
    title: "Configurations",
    summary: "Company-wide time-keeping, overtime, break and fixed-hours rules.",
    topics: [
      {
        title: "Company timezone (set this first)",
        body: "Under Time Settings, the Company TimeZone drives all shift schedules, time calculations, break tracking, reports and payroll. You'll be asked to confirm before it changes, with a preview of the current time in the new zone.",
        tips: ["Set the timezone before configuring anything else, then click Save Settings."],
      },
      {
        title: "Time-keeping defaults",
        body: "Also under Time Settings: Default Shift Hours, Minimum Lunch Deduction (min) and Grace Period (minutes). These apply when a department or shift doesn't override them.",
      },
      {
        title: "Overtime configuration",
        body: "Under OT Configurations, choose one basis for overtime: a Daily, Weekly, or Cutoff OT Threshold. Each company uses exactly one basis.",
      },
      {
        title: "How overtime gets approved",
        companyType: "DAYCARE",
        body: "Employees request OT approval on individual punches from their Punch logs. Supervisors and admins approve or reject those requests in Employees Overtime Requests.",
        tips: [
          "Only employees submit OT requests. Supervisors and admins don't submit them.",
          "Unapproved OT isn't credited. The session is capped at the scheduled end.",
        ],
      },
      {
        title: "How overtime gets approved",
        companyType: "BNC",
        body: "Overtime isn't requested per punch. BizBuddy calculates it from total hours using the basis and threshold you set here, and it appears as OT blocks in Cutoff Review for an admin or supervisor to Approve OT or Exclude.",
      },
      {
        title: "Break policy",
        body: "Under Break Policy, set lunch and coffee break rules per department and turn on Auto-Lunch or Auto-Coffee, which add breaks automatically at clock-out. Choose whether entitlement is set per department or per shift template. Click Save Break Policy when done.",
        tips: [
          "Coffee breaks: up to 5 per day, each up to 30 minutes. Time over the allowance is deducted automatically on approval.",
          "Setting coffee breaks to 0 turns off coffee break tracking for that department.",
          "Added breaks are labelled Auto-injected in time log details.",
        ],
      },
      {
        title: "Fixed hours",
        body: "Under Fixed Hours, turn a department on, then pick which employees are on fixed hours. Those employees get the department's hours per cutoff (80 by default), whatever their clock-ins. Everyone else stays punch-based.",
        tips: [
          "Paid leave counts toward the total: 8h of leave gives 72h regular + 8h leave = 80h.",
          "Punches are kept for reference but don't count for pay, never create OT, and never block Lock or Finalize.",
          "Turning fixed hours off only affects open cutoffs. Locked and processed cutoffs stay as they are.",
        ],
      },
      {
        title: "DayCare settings",
        companyType: "DAYCARE",
        body: "The DayCare Settings tab holds the driver/aide rules: the Driver-Aide Threshold, Shift Assignment Window, early clock-in and clock-out grace, auto clock-out warning and grace hours, and which supervisors are emailed when an auto clock-out fires.",
      },
    ],
  },
  {
    id: "leave-settings",
    groupId: "account",
    routeId: "company/leave-settings",
    title: "Leave Settings",
    summary: "Leave types, accrual, approval routing and employee leave credits.",
    topics: [
      {
        title: "Leave types",
        steps: [
          "Go to Settings → Leave Settings and find Manage Leave Types.",
          "Click Create Leave Type, enter a name (e.g. Vacation, Sick Leave), choose Paid or Unpaid, and choose who it's assigned to.",
          "Use Edit, Archive / Unarchive or Delete on existing types.",
        ],
        tips: ["Archive a type instead of deleting it if it's already been used. History stays intact."],
      },
      {
        title: "Leave accrual",
        body: "Turn on Enable Leave Accrual to earn credits each period instead of all at once. Choose the month the accrual year resets, and optionally Credit New Employees for Elapsed Months so mid-year hires aren't penalized.",
        tips: ["Balances are capped at the policy maximum. Carry-over runs automatically at year-end."],
      },
      {
        title: "Two-step approval",
        body: "Turn on Enable Two-Step Leave Approval so the first approver can escalate a request to a second approver, who gives the final sign-off. When it's off, the supervisor's approval is final.",
      },
      {
        title: "Punch-vs-leave conflicts",
        body: "Turn on Automatically Resolve Punch-vs-Leave Conflicts to let the system resolve a day that has both a punch and an approved leave, instead of an admin clicking Honor Punch or Honor Leave in Cutoff Review. The refund works the same either way.",
      },
      {
        title: "Adjusting employee credits",
        steps: [
          "In Leave Credits Management, search for an employee to see their Credits, Used and Available hours per leave type.",
          "Click Adjust Credits, choose the employee and leave type, enter the new hours and a Reason (required, recorded on the leave ledger).",
          "Click a balance's history icon to view the ledger of accruals, deductions and adjustments.",
        ],
      },
    ],
  },
  {
    id: "notifications",
    groupId: "account",
    routeId: "company/notifications",
    title: "Notifications",
    summary: "Attendance alerts for employees and daily reports for management.",
    topics: [
      {
        title: "Configuring notifications",
        steps: [
          "Go to Settings → Notifications.",
          "Under Grace Periods, set how many minutes after a scheduled start or end to wait before alerting (Clock-In and Clock-Out Grace Period).",
          "Under Employee Notifications, turn Missed Clock-In Alerts and Missed Clock-Out Alerts on or off.",
          "Under Management Reports, turn on Daily Reports to Management and set the Morning and Evening Report Time.",
          "Click Save Settings.",
        ],
        tips: [
          "Employee alerts are sent by email and appear in the notification bell.",
          "Management reports go to all admins and supervisors at the scheduled times.",
        ],
      },
    ],
  },
  {
    id: "subscription",
    groupId: "account",
    routeId: "company/subscription",
    title: "Subscription",
    summary: "Your BizBuddy plan, user capacity and upgrade options.",
    topics: [
      {
        title: "Viewing and upgrading your plan",
        body: "Settings → Subscription shows your current plan, start and end dates, features, user capacity and billing. Use the upgrade option to see available plans and unlock more features or users.",
        tips: ["An orange dot next to Subscription in the sidebar means your plan ends within 30 days."],
      },
    ],
  },
  {
    id: "company-deletion",
    groupId: "account",
    routeId: "company/deletion",
    title: "Deletion",
    summary: "Permanently delete your company account.",
    topics: [
      {
        title: "Deleting your company account",
        body: "This permanently removes your company profile and data, all connected user accounts, active subscriptions and payment information, and all historical data and settings. To confirm, type \"delete my account\". This can't be undone.",
        tips: ["Export any reports you need (punch logs, payroll, leave) before deleting."],
      },
    ],
  },
];

export default settingsDocsContent;
