// components/Dashboard/DashboardContent/EmployeePanel/Documentation/docsContent.js
//
// BB-097 — Static content for the Employee Panel documentation page.
// Written for the plain employee role. Keep labels in sync with the real UI
// when Employee Panel flows change.
//
// Topic shape:
//   { title, companyType?, body?, steps?: string[], statuses?: { label, tone, meaning }[], tips?: string[] }
// Status tone → Badge colour mapping lives in Documentation.jsx.
//
// companyType (on a section or topic): "DAYCARE" (PadPro) or "BNC" (B&C). Omit it when
// the content applies to both. Tagged items are only shown to that company type; when
// the type can't be resolved, both are shown with a label. Where the two differ,
// write one topic per type with the same title.

const docsContent = [
  {
    id: "getting-started",
    title: "Getting Started",
    summary: "How to find your way around the BizBuddy Employee Panel.",
    href: null,
    topics: [
      {
        title: "Navigating the Employee Panel",
        body: "Everything you need as an employee is in the sidebar under Employee Panel. Pages are grouped into Overview, Profile, Time Keeping, Schedule, Leaves and Payroll.",
        steps: [
          "Open the sidebar with the menu button (on mobile) or keep it pinned on desktop using the pin icon.",
          "Click a group (e.g. Time Keeping) to expand it, then click a page to open it.",
          "Use the book icon in the top bar at any time to come back to this guide.",
        ],
      },
      {
        title: "Notifications, theme and your account",
        steps: [
          "The bell icon in the top bar shows updates on your requests (approved, rejected, and so on).",
          "The sun/moon icon switches between light and dark mode.",
          "Click your initials in the top-right corner to open your account menu and sign out.",
        ],
      },
      {
        title: "Why is a page locked or missing?",
        body: "Some pages depend on your company's BizBuddy plan. A page with a lock icon is not included in your company's current plan. Contact your company admin if you need access.",
      },
      {
        title: "Supervisor or admin?",
        body: "If your role includes the Company Panel, use the Company Panel and Company Settings tabs at the top of this guide to learn how to manage your team and company. You only see the tabs your role can use.",
      },
    ],
  },
  {
    id: "overview",
    title: "Overview",
    summary: "Your personal dashboard of hours, overtime, attendance and work patterns.",
    href: "/dashboard/employee/overview",
    topics: [
      {
        title: "What you'll see",
        body: "Overview shows your username, department, usual clock-in and clock-out times, total hours, overtime and absences, plus averages such as Hours / Day and Hours / Week. Charts show Daily Hours, Session Status (Active vs Completed) and Absence vs Late.",
      },
      {
        title: "Changing the date range",
        steps: [
          "Open the date range selector at the top of the page.",
          "Choose This Month, Last Month, Last 7 / 14 / 28 Days, or Custom Range.",
          "For Custom Range, pick a start date and an end date.",
        ],
        tips: [
          "Weekly and monthly averages marked as projected are estimates based on your logged days.",
          "If you are new, the page stays mostly empty until you log your first session.",
        ],
      },
    ],
  },
  {
    id: "profile",
    title: "Profile",
    summary: "Keep your personal details up to date and view your employment information.",
    href: "/dashboard/employee/personal-employment-identifications",
    topics: [
      {
        title: "Personal Identification — updating your details",
        body: "This page holds your account, personal, address and emergency contact information.",
        steps: [
          "Go to Profile → Personal Identification.",
          "Update the fields you need, e.g. name, phone number, date of birth, address (address line, city, state) or emergency contact.",
          "Fix any fields highlighted in red (e.g. an invalid phone number or date).",
          "Click Save to apply your changes.",
        ],
        tips: [
          "Only username and email are required. Everything else is optional but helps complete your employee record.",
          "SSN/ITIN is formatted automatically as XXX-XX-XXXX and must be 9 digits.",
        ],
      },
      {
        title: "Employment Details (view only)",
        body: "Profile → Employment Details shows your job title, department, supervisor, employment status, exempt status, employment type, work location, probation end date and time zone. These are managed by your company admin. Contact them if something is wrong.",
      },
    ],
  },
  {
    id: "time-keeping",
    title: "Time Keeping",
    summary: "Clock in and out, take breaks, review your punch logs and correct mistakes.",
    href: "/dashboard/employee/punch",
    topics: [
      {
        title: "Punch — clocking in and out",
        steps: [
          "Go to Time Keeping → Punch.",
          "Allow location access in your browser when asked. BizBuddy uses it to confirm you're at your work site.",
          "Click TIME IN, check the confirmation dialog, then click Confirm Time In.",
          "When your shift ends, click TIME OUT, then Confirm Time Out.",
        ],
        tips: [
          "If your shift has a scheduled start, the confirmation may show a Recognized Time that's snapped to your schedule.",
          "If you have no scheduled shift today, you'll be asked to give a reason (at least 10 characters) before clocking in. Your supervisor sees this reason during payroll review.",
        ],
      },
      {
        title: "Coffee and lunch breaks",
        steps: [
          "While timed in, use the Coffee Break or Lunch Break buttons to start a break, and click again to end it.",
          "End any active break before you time out.",
        ],
        tips: [
          "You can take up to 2 coffee breaks and 1 lunch break per day. Today's Summary shows what you've used.",
          "If your department has auto-lunch on, a \"Lunch break recommended\" banner appears after a set number of hours. If you don't take a manual lunch, the lunch is applied automatically when you time out.",
        ],
      },
      {
        title: "Location messages",
        statuses: [
          { label: "Within location", tone: "success", meaning: "You're inside your designated work location and can punch." },
          { label: "Outside Work Zone", tone: "danger", meaning: "You're outside the allowed area. Move closer to your work site and click Recheck." },
          { label: "GPS Unavailable", tone: "warning", meaning: "Your browser isn't sharing your location. Turn on location services and click Retry." },
        ],
      },
      {
        title: "Driver / Aide punch types",
        companyType: "DAYCARE",
        body: "Clocking in early or out late may ask you to choose a punch type: Regular (just clocking in early or out late), or Driver / Aide AM or PM (covering a transport slot). Pick the one that matches what you did. Your punch logs show the punch type for each record, and you can filter by it.",
      },
      {
        title: "Punch Logs — reviewing your records",
        steps: [
          "Go to Time Keeping → Punch logs.",
          "Use Filters & controls to pick a date range (or a custom range) and a cutoff status.",
          "Click any row to open the Log Details panel, which shows times, breaks, overtime, payroll cutoff, schedule, device and location.",
          "Use Export to download your logs as CSV or PDF.",
        ],
        statuses: [
          { label: "Approved", tone: "success", meaning: "The log is confirmed for payroll in a cutoff period." },
          { label: "Awaiting", tone: "warning", meaning: "The log is pending admin review for the cutoff." },
          { label: "Not included", tone: "neutral", meaning: "The log isn't part of any cutoff period yet." },
        ],
      },
      {
        title: "Requesting overtime approval",
        companyType: "DAYCARE",
        steps: [
          "In Punch logs, find a log with overtime hours and a Request button in the OT column.",
          "Click Request, then enter the hours (HH:MM) and choose an approver.",
          "Add an optional reason and submit.",
        ],
        tips: ["You can't request more than the eligible OT hours shown for that log."],
      },
      {
        title: "How overtime works",
        companyType: "BNC",
        body: "You don't request overtime on individual punches. Overtime is calculated from your total hours for the day, week or cutoff period (whichever your company uses), and your admin reviews and approves it during the cutoff review. Just punch in and out accurately. Approved overtime is included when payroll is processed.",
        tips: ["If you think your hours are wrong, contest the punch (see Contest Time Logs below) so your total is correct before the cutoff is finalized."],
      },
      {
        title: "Requesting a missing punch entry",
        companyType: "DAYCARE",
        body: "If you forgot to clock in or out entirely, ask for an entry to be added to your logs.",
        steps: [
          "In Punch logs, click Request entry.",
          "Step 1: enter the date and your clock-in and clock-out times, and choose the Shift type (Regular or Driver / Aide). Tick Next day if your shift ended after midnight.",
          "Step 2: select an approver.",
          "Step 3: choose a reason (e.g. Forgot To Clock, System Malfunction, Emergency), add details, then click Submit request.",
        ],
        tips: ["Your request appears under Punch log entry requests as Pending until your approver decides."],
      },
      {
        title: "Requesting a missing punch entry",
        companyType: "BNC",
        body: "If you forgot to clock in or out entirely, ask for an entry to be added to your logs.",
        steps: [
          "In Punch logs, click Request entry.",
          "Step 1: enter the date and your clock-in and clock-out times. Tick Next day if your shift ended after midnight.",
          "Step 2: select an approver.",
          "Step 3: choose a reason (e.g. Forgot To Clock, System Malfunction, Emergency), add details, then click Submit request.",
        ],
        tips: ["Your request appears under Punch log entry requests as Pending until your approver decides."],
      },
      {
        title: "Overtime — tracking your requests",
        companyType: "DAYCARE",
        body: "Time Keeping → Overtime lists every overtime request you've filed, with hours requested, status, approver, reason and last update. Use the tabs (All, Pending, Approved, Rejected) or the search bar to find a request, then click it to see full details and comments.",
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Waiting for your approver." },
          { label: "Approved", tone: "success", meaning: "Accepted. The hours count toward your approved overtime." },
          { label: "Rejected", tone: "danger", meaning: "Declined. Check the comments for the reason." },
        ],
      },
      {
        title: "Contest Time Logs — correcting a punch",
        body: "Use a contest when a recorded clock-in or clock-out time is wrong.",
        steps: [
          "In Punch logs, click Contest time.",
          "Choose the punch log to contest, then enter the corrected clock-in and/or clock-out time.",
          "Select an approver and a reason, add a description, and submit.",
          "Track your contests in Time Keeping → Contest Time Logs. Click a row to compare requested and original times.",
        ],
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Your approver hasn't reviewed it yet. Nothing has changed on your log." },
          { label: "Approved", tone: "success", meaning: "The correction has been applied to your log." },
          { label: "Rejected", tone: "danger", meaning: "The original times stay as recorded." },
        ],
      },
    ],
  },
  {
    id: "schedule",
    title: "My Schedule",
    summary: "See your upcoming shifts in a calendar.",
    href: "/dashboard/employee/schedule",
    topics: [
      {
        title: "Viewing your shifts",
        steps: [
          "Go to Schedule → My Schedule.",
          "The top cards show Today's Shifts, Total Hours today and This Month's total hours.",
          "In Calendar View, click any date to see the shifts for that day.",
        ],
        tips: [
          "If your shifts span more than one time zone, a Multi-timezone notice explains which zone each time is in.",
          "Your schedule is set by your company. Contact your supervisor if a shift is missing or wrong.",
        ],
      },
    ],
  },
  {
    id: "leaves",
    title: "Leaves",
    summary: "File leave requests, check balances and track approvals.",
    href: "/dashboard/employee/leave-logs",
    topics: [
      {
        title: "Filing a leave request",
        steps: [
          "Go to Leaves → Leave Logs and click New request.",
          "Select the leave type and an approver.",
          "Pick the start and end dates. Turn on Include weekends only if weekend days should count.",
          "Add a reason and click Submit request. Nothing changes until your approver confirms.",
        ],
        tips: [
          "You can't file a request that overlaps one that's already pending or approved. Choose a different date range.",
          "Check Leave balances at the top of the page before filing. If no balances show, contact HR.",
        ],
      },
      {
        title: "Leave statuses",
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Waiting for your approver." },
          { label: "Pending final", tone: "info", meaning: "Escalated for a second, final approval." },
          { label: "Approved", tone: "success", meaning: "Confirmed. Days are deducted from your balance." },
          { label: "Rejected", tone: "danger", meaning: "Declined by the approver." },
          { label: "Cancelled", tone: "neutral", meaning: "Withdrawn and no longer active." },
        ],
      },
      {
        title: "Cancelling a pending request",
        steps: [
          "Click the request in Leave requests history to open its details.",
          "Click Cancel request and confirm.",
        ],
        tips: ["Only Pending or Pending final requests can be cancelled here. Your leave balance isn't affected."],
      },
    ],
  },
  {
    id: "payslip",
    title: "My Payslip",
    summary: "View and download your payslips.",
    href: "/dashboard/employee/payslip",
    topics: [
      {
        title: "Viewing and downloading payslips",
        steps: [
          "Go to Payroll → My Payslip.",
          "Each payslip shows Gross Pay, Taxes, Deductions and Net Pay.",
          "Click View to open a payslip, or Download to save a copy.",
        ],
        tips: ["Payslips appear here once your company processes payroll."],
      },
    ],
  },
  {
    id: "faq",
    title: "FAQ & Troubleshooting",
    summary: "Quick answers to common issues.",
    href: null,
    topics: [
      {
        title: "I can't punch in — it says I'm outside the work zone",
        body: "Your company restricts punching to a set location. Move closer to your work site, make sure GPS is on, and click Recheck. If you're on site and it still fails, contact your supervisor.",
      },
      {
        title: "I forgot to clock in or out",
        body: "If the log exists but a time is wrong, use Contest time in Punch logs. If there's no log at all, use Request entry.",
      },
      {
        title: "My request has been pending for a long time",
        body: "Requests wait for the approver you selected. Follow up with them directly, or check the bell icon for updates.",
      },
      {
        title: "My hours or overtime look wrong",
        companyType: "DAYCARE",
        body: "Open the log in Punch logs and check Log Details (breaks, OT, cutoff status). If a time is wrong, contest it. For overtime, use the Request button on that log.",
      },
      {
        title: "My hours or overtime look wrong",
        companyType: "BNC",
        body: "Open the log in Punch logs and check Log Details (breaks, cutoff status). If a time is wrong, contest it before the cutoff is finalized. Overtime is reviewed by your admin at cutoff, so you don't need to request it. Ask your supervisor if approved overtime looks wrong.",
      },
    ],
  },
];

export default docsContent;
