// components/Dashboard/DashboardContent/EmployeePanel/Documentation/companyDocsContent.js
//
// BB-097 — Static content for the Company Panel documentation tab.
// Written for supervisors and admins. Keep labels in sync with the real UI
// when Company Panel flows change.
//
// Section shape (in addition to the Employee docs shape):
//   groupId — sidebar group id in CompanyPanelItems (sidebar.jsx). Used to filter by role.
//   routeId — sidebar child id (e.g. "company/locations"). Used for the plan lock and the
//             "Open this page" link (/dashboard/<routeId>). null for general sections.
// Topic shape:
//   { title, companyType?, body?, steps?: string[], statuses?: { label, tone, meaning }[], tips?: string[] }
//   companyType: "DAYCARE" (PadPro) / "BNC" (B&C), see docsContent.js.

const companyDocsContent = [
  {
    id: "company-getting-started",
    groupId: null,
    routeId: null,
    title: "Getting Started",
    summary: "What the Company Panel is and who can use it.",
    topics: [
      {
        title: "Who sees the Company Panel",
        body: "The Company Panel appears in the sidebar under your Employee Panel when your role allows it. Supervisors see Organizations & People and Requests & Logs. Admins also see Shifts & Schedules, Locations and Settings. This guide only shows the parts you can use.",
      },
      {
        title: "Locked pages",
        body: "Some pages depend on your company's BizBuddy plan. Pages marked with a Basic or Pro lock aren't included in your current plan. Admins can upgrade from Settings → Subscription.",
      },
      {
        title: "Sidebar badges",
        body: "A red number next to a page means items are waiting for you (e.g. pending contest, leave or overtime requests, or locked cutoffs). An orange dot means something needs attention, such as employees without a schedule.",
      },
    ],
  },

  // ── Organizations & People ────────────────────────────────────────────────
  {
    id: "departments",
    groupId: "organizations&people",
    routeId: "company/departments",
    title: "Departments",
    summary: "Organize employees into departments, assign supervisors and set the lunch break policy.",
    topics: [
      {
        title: "Creating a department",
        steps: [
          "Go to Organizations & People → Departments and click New Department.",
          "Enter a Department Name and optionally choose a Supervisor.",
          "Under Lunch Break Policy, turn on Paid Lunch Breaks if employees in this department are paid during lunch.",
          "Click Create Department.",
        ],
        tips: [
          "Lunch policy changes apply immediately and affect future payroll calculations.",
          "Each department can have its own lunch break policy.",
        ],
      },
      {
        title: "Editing, deleting and viewing members",
        body: "Use the row actions to View Members, Edit or Delete a department. Deleting a department can't be undone. Use the search box or Filter by Supervisor to narrow the list, Toggle Columns to choose what's shown, and CSV or PDF to export.",
      },
    ],
  },
  {
    id: "employees",
    groupId: "organizations&people",
    routeId: "company/employees",
    title: "Employees",
    summary: "Add employees, update their details and import them in bulk.",
    topics: [
      {
        title: "Adding an employee",
        steps: [
          "Go to Organizations & People → Employees and click Add Employee.",
          "Fill in Basic Information: First Name, Last Name, Email and Password are required. Choose a Role (Employee, Supervisor or Admin) and a Department.",
          "Optionally fill in Employment Details such as Employee ID, Hire Date, Job Title, Employment Status, Work Location, Employment Type, Exempt Status, Probation End Date and Time Zone.",
          "Click Create Employee.",
        ],
        tips: [
          "If the department has active schedules, an Apply Department Schedules dialog lets you choose which ones to assign to the new employee.",
        ],
      },
      {
        title: "Editing an employee",
        body: "Use the Edit row action to update profile, address and employment details, change the Direct Supervisor, or change the Account status. Leave New Password blank to keep the current password. View Details shows the full record.",
        tips: [
          "Account status has its own row. Inactive accounts can't sign in or use BizBuddy until they're set back to Active.",
          "Saving an active employee as Inactive asks you to confirm (Deactivate this account?). Choose Deactivate account to save, or Cancel to keep them active.",
        ],
      },
      {
        title: "Driver schedule",
        companyType: "DAYCARE",
        body: "When editing an employee, turn on Driver Schedule under DayCare Settings for employees who follow a driver shift. Their punch type is then assigned automatically at shift boundaries.",
      },
      {
        title: "Importing employees from CSV",
        steps: [
          "Click Import Guide to see the required headers, then Download Sample CSV.",
          "The first row of the sample is a guide to the allowed values (it starts with #) and is never imported. You can delete it or leave it in; add your employees below it.",
          "Fill in the file. departmentId, employeeId, hireDate and the employment-detail columns are optional.",
          "Click Import CSV and choose your file.",
          "Review the CSV Import Summary. Any failed rows are listed with the reason.",
        ],
        tips: [
          "You can import up to 100 employees per file. Split larger lists into batches.",
          "Row numbers in the summary are the file's line numbers, with the header as line 1.",
        ],
      },
      {
        title: "Deleting an employee",
        body: "Use the Delete row action, then type the employee's full name to confirm. This permanently removes their account and login access, profile data and schedule assignments. Time logs are kept for payroll records.",
      },
    ],
  },
  {
    id: "employee-deletion",
    groupId: "organizations&people",
    routeId: "company/employee-deletion",
    title: "Employee Account Deletion",
    summary: "Review account deletion requests submitted by employees.",
    topics: [
      {
        title: "Reviewing a deletion request",
        steps: [
          "Go to Organizations & People → Employee Account Deletion.",
          "Use the filters to find pending requests, then click View details to see the reason.",
          "Click Review request, choose Approve or Reject, and enter Review Notes (required).",
          "Submit your decision.",
        ],
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Waiting for review." },
          { label: "Approved", tone: "info", meaning: "Approved and queued for deletion." },
          { label: "Rejected", tone: "danger", meaning: "Declined. The account stays active." },
          { label: "Completed", tone: "success", meaning: "The account has been deleted." },
        ],
      },
    ],
  },

  // ── Requests & Logs ───────────────────────────────────────────────────────
  {
    id: "employee-schedules",
    groupId: "punch-logs",
    routeId: "company/employee-schedules",
    title: "Employee Schedule",
    summary: "Check schedule coverage and view any employee's upcoming shifts.",
    topics: [
      {
        title: "Checking coverage",
        body: "The top cards show Total Employees, With Shifts, Without Shifts and Coverage. An orange dot in the sidebar means some employees have no shifts assigned.",
        steps: [
          "Go to Requests & Logs → Employee Schedule.",
          "Use Select Employee to pick someone and view their shifts, with date, start and end time, timezone and total hours.",
        ],
        tips: ["If shifts span more than one timezone, a Multiple timezones notice shows the local time for each one."],
      },
    ],
  },
  {
    id: "company-punch-logs",
    groupId: "punch-logs",
    routeId: "company/punch-logs",
    title: "Employees Punch Logs",
    summary: "Monitor attendance, correct punches, approve missing-entry requests and export reports.",
    topics: [
      {
        title: "Finding and inspecting logs",
        steps: [
          "Go to Requests & Logs → Employees Punch logs.",
          "In Filters & Controls, pick a cutoff period or date range, then filter by employee, department or status (Active / Completed).",
          "Click a log to see its details, such as breaks, schedule, grace periods, device, location and cutoff status.",
        ],
        tips: [
          "Times are shown in the company timezone.",
          "Click the book icon (Punch Log Rules Guide) at the top for the full rules behind flags such as Unscheduled Punch (G-1), Late Clock-Out (D-4), Missing Clock-Out (D-5) and Auto Clock-Out (G-6). The guide that opens is the one for your company.",
        ],
      },
      {
        title: "Driver / Aide punch types",
        companyType: "DAYCARE",
        body: "Punch logs show each record's punch type (Regular, Driver / Aide, Driver AM, Driver PM, Training), and you can filter by it. Driver/Aide hours are split into 1.25h AM + 5.5h Regular + the derived PM segment. Per-punch OT and its approval status are shown in the log details.",
      },
      {
        title: "Correcting a punch",
        companyType: "DAYCARE",
        body: "On a completed log that isn't approved in a cutoff yet, use the row actions to Edit Time In/Out, Edit Punch Type or Delete Punch Log. Deleting is permanent.",
      },
      {
        title: "Correcting a punch",
        companyType: "BNC",
        body: "On a completed log that isn't approved in a cutoff yet, use the row actions to Edit Time In/Out or Delete Punch Log. Deleting is permanent.",
      },
      {
        title: "Approving punch log requests",
        body: "When employees use Request entry for a forgotten punch, the request appears under Punch Log Requests Pending Approval at the top of the page.",
        steps: [
          "Expand Punch Log Requests Pending Approval.",
          "Click Approve to create the time log, or Reject and enter a reason.",
        ],
      },
      {
        title: "Importing punch logs",
        steps: [
          "Click the upload icon (Import Punch Logs).",
          "Under Download a template, pick the From and To dates (up to 31 days) and the employees: all active employees, one department or specific employees. Then click Download CSV Template.",
          "The template comes pre-filled with one row per employee per date, so you only type clockIn and clockOut. Leave both times empty for a day off; that row is skipped. For two punches on one day, copy the row and fill each one.",
          "Under Upload the filled-in file, click Choose CSV File, then Upload, and check the results per row.",
        ],
        tips: [
          "Imported punches are approved immediately. There's no separate approval step.",
          "The first row of the template is a guide to the allowed values. It starts with # and is never imported. You can delete it or leave it in.",
          "Times can be 08:00 or 8:00 AM. A clock-out earlier than the clock-in counts as the next day.",
          "Up to 500 rows with punches and 2,000 rows in total per file (5MB max). A template is limited to 2,000 rows (employees × days).",
          "Row numbers in the results are the file's line numbers: the header is line 1 and the guide row line 2, so the first employee is row 3.",
          "Supervisors can import for their team: their own department and their direct reports.",
        ],
      },
      {
        title: "Punch types in imports",
        companyType: "DAYCARE",
        body: "Import rows can use REGULAR, DRIVER_AIDE, DRIVER_AIDE_AM, DRIVER_AIDE_PM or TRAINING as the punch type. Leave it blank for REGULAR.",
      },
      {
        title: "Punch types in imports",
        companyType: "BNC",
        body: "Use REGULAR or TRAINING as the punch type, or leave it blank for REGULAR. Driver/Aide punch types aren't available for your company.",
      },
      {
        title: "Backtrack import",
        companyType: "DAYCARE",
        body: "Use the history icon (Import Backtrack Punch Logs) to backfill historical punches from a legacy CSV. BizBuddy detects the matching cutoff period, or helps you create one. Review the preview, select the rows to include and confirm.",
        tips: [
          "Approve backtracked records with Approve Raw in Cutoff Review. Approve Schedule would credit the full scheduled shift instead of the imported hours.",
        ],
      },
      {
        title: "Reports",
        body: "Use the download icon (Generate Report) to export logs for a cutoff period or custom date range. Use Yearly Total Hours Report to download an Excel summary for a year, grouped Monthly, Quarterly or Yearly, with optional columns such as Leave Hrs and OT Hrs.",
      },
    ],
  },
  {
    id: "contest-requests",
    groupId: "punch-logs",
    routeId: "company/contest-requests",
    title: "Employee Requests (Contests)",
    summary: "Review employees' requests to correct a clock-in or clock-out time.",
    topics: [
      {
        title: "Reviewing a contest",
        steps: [
          "Go to Requests & Logs → Employee Requests.",
          "Use Table Controls to filter by status, employee or cutoff period.",
          "Click a request to compare the Original Punch with the Requested Change and read the reason.",
          "Click Approve to apply the corrected times, or Reject to keep the original.",
        ],
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Waiting for review. The log hasn't changed." },
          { label: "Approved", tone: "success", meaning: "The corrected times were applied to the log." },
          { label: "Rejected", tone: "danger", meaning: "The original times stay as recorded." },
        ],
      },
    ],
  },
  {
    id: "leave-requests",
    groupId: "punch-logs",
    routeId: "company/leave-requests",
    title: "Employees Leave Requests",
    summary: "Approve, reject or escalate leave requests and see who's on leave.",
    topics: [
      {
        title: "Approving or rejecting a leave",
        steps: [
          "Go to Requests & Logs → Employees Leave Requests.",
          "Click a request to see the leave period, employee, approver, leave credits and pay outcome.",
          "Click Approve or Reject and add optional comments.",
        ],
        tips: [
          "Approve and Reject only appear on requests where you're an eligible approver.",
          "The Pay Outcome shows how many hours will be paid from the employee's balance and how many become unpaid automatically.",
        ],
      },
      {
        title: "Two-step approval",
        body: "If Two-Step Leave Approval is on (Settings → Leave Settings), the first approver can tick Require second approval and choose a second approver. The request moves to Pending Final Approval until that person signs off.",
        statuses: [
          { label: "Pending", tone: "warning", meaning: "Waiting for the first approver." },
          { label: "Pending final", tone: "info", meaning: "Escalated. Waiting for the second approver." },
          { label: "Approved", tone: "success", meaning: "Confirmed. Hours are deducted from the balance." },
          { label: "Rejected", tone: "danger", meaning: "Declined at either stage." },
          { label: "Cancelled", tone: "neutral", meaning: "Withdrawn and no longer active." },
        ],
      },
      {
        title: "Calendar view and exports",
        body: "Switch from the table to the Leave Calendar to see who's on leave each day. Use Generate PDF to export the list.",
      },
    ],
  },
  {
    id: "overtime-requests",
    groupId: "punch-logs",
    routeId: "company/overtime-requests",
    title: "Employees Overtime Requests",
    summary: "Review employee overtime requests.",
    topics: [
      {
        title: "Reviewing overtime",
        companyType: "BNC",
        body: "Your employees don't file overtime requests on individual punches. Overtime is calculated from total hours for the day, week or cutoff (your OT basis in Settings → Configurations) and approved as OT blocks in Cutoff Review. See Employee Cutoff → Overtime in Cutoff Review.",
      },
      {
        title: "Reviewing overtime",
        companyType: "DAYCARE",
        steps: [
          "Go to Requests & Logs → Employees Overtime Requests.",
          "Use the status tabs or search to find a request, then click it to open the details panel.",
          "Approve, or Reject with a comment (required when rejecting).",
        ],
        tips: [
          "Only employees submit OT requests. Supervisors and admins approve or reject them.",
          "Unapproved OT hours aren't credited. The session is capped at the scheduled end.",
        ],
      },
    ],
  },
  {
    id: "cutoff-periods",
    groupId: "punch-logs",
    routeId: "company/cutoff-periods",
    title: "Employee Cutoff",
    summary: "Set up payroll cutoff periods, review every record, and lock periods for payroll.",
    topics: [
      {
        title: "Setting up cutoff periods",
        steps: [
          "Go to Requests & Logs → Employee Cutoff.",
          "Click Configure, choose a Department and a Payment Frequency (Bi-Weekly, Bi-Monthly or Monthly), an anchor date and a Payment Offset.",
          "Under Generate Periods, choose Next 3 Months, a backfill, or a Custom Date Range to create periods.",
          "Use Manual Cutoff to create a single period by hand.",
        ],
      },
      {
        title: "Cutoff period lifecycle",
        body: "Use the row menu to Lock Period, Unlock Period, Mark Processed, or Delete an open period.",
        statuses: [
          { label: "Open", tone: "info", meaning: "Records are being reviewed and approved." },
          { label: "Locked", tone: "warning", meaning: "Finalized for payroll. No more changes unless unlocked." },
          { label: "Processed", tone: "success", meaning: "Payroll has been run for this period." },
        ],
      },
      {
        title: "Cutoff Review — approving records",
        companyType: "DAYCARE",
        steps: [
          "Click Review on a period to open Cutoff Review.",
          "For each employee and day, choose Approve Schedule (credit the scheduled shift) or Approve Raw (credit actual punched time). You can also Edit times (a reason is required for the audit log) or Exclude a record.",
          "Driver/Aide employees' days are grouped as a Driver Day, with one row per segment (Driver AM, Regular, Driver PM). Approve each segment the same way.",
          "Use Approve All Schedule or Approve All Raw to approve an employee's clean records in bulk.",
          "If a punch and an approved leave fall on the same day, resolve the Conflict with Honor Punch or Honor Leave.",
          "Use Reset to return an approved or excluded record to pending.",
        ],
        tips: [
          "Click Sync Records to pull in employees or punches added after the period was created.",
          "Filter by tags such as Late Arrivals, No Schedule, Has OT, Conflicts or Has Leave to work through issues faster.",
          "Backtrack-imported records must be approved with Approve Raw. Approve Schedule would credit the full scheduled shift instead of the imported hours.",
        ],
      },
      {
        title: "Cutoff Review — approving records",
        companyType: "BNC",
        steps: [
          "Click Review on a period to open Cutoff Review.",
          "For each employee and day, choose Approve Schedule or Approve Raw (credit actual punched time). For a regular punch, Approve Schedule asks you to pick which shift to snap the record to.",
          "You can also Edit times (a reason is required for the audit log) or Exclude a record. Records that are split into segments only offer Approve Raw, Edit and Exclude.",
          "Use Approve All Raw to approve an employee's clean records in bulk.",
          "If a punch and an approved leave fall on the same day, resolve the Conflict with Honor Punch or Honor Leave.",
          "Use Reset to return an approved or excluded record to pending.",
        ],
        tips: [
          "Click Sync Records to pull in employees or punches added after the period was created.",
          "Filter by tags such as Late Arrivals, No Schedule, Has OT, Conflicts or Has Leave to work through issues faster.",
        ],
      },
      {
        title: "Overtime in Cutoff Review",
        companyType: "DAYCARE",
        body: "Punches with overtime show a +OT tag. Employees request approval for that overtime from their Punch logs, and approvers handle it under Employees Overtime Requests. Unapproved OT isn't credited.",
        tips: ["If your OT basis is per cutoff (Settings → Configurations), overtime also appears as an OT block for the period. Approve OT or Exclude it there."],
      },
      {
        title: "Overtime in Cutoff Review",
        companyType: "BNC",
        body: "Overtime isn't tracked per punch. It shows as purple OT blocks, calculated from each employee's total hours for the day, week or cutoff (your OT basis in Settings → Configurations). Review each pending block and click Approve OT or Exclude.",
        tips: [
          "When the OT basis is per cutoff, expand the block to see the day-by-day breakdown.",
          "Employees on fixed hours get OT blocks for reference only. They can't be actioned.",
        ],
      },
      {
        title: "Training days",
        companyType: "DAYCARE",
        body: "Click Add Training Day to mark every employee's pending punches on a date as Training. This also excludes pending driver/aide segments for those employees on that day.",
      },
      {
        title: "Training days",
        companyType: "BNC",
        body: "Click Add Training Day to mark every employee's pending punches on a date as Training.",
      },
      {
        title: "Fixed hours",
        body: "Employees on fixed hours (set up in Settings → Configurations → Fixed Hours) get the department's set hours for the cutoff, whatever their clock-ins. Paid leave is included in that total. You can adjust an employee's fixed hours for the period from Cutoff Review.",
      },
      {
        title: "Finalizing a cutoff",
        body: "Click Finalize Cutoff once all punch logs are reviewed, all conflicts are resolved and all OT flags are handled. Finalizing locks the period for payroll.",
      },
    ],
  },

  // ── Shifts & Schedules ────────────────────────────────────────────────────
  {
    id: "shifts",
    groupId: "shifts&schedules",
    routeId: "company/shifts",
    title: "Company Shift Templates",
    summary: "Create reusable shift templates with times, pay rate and break rules.",
    topics: [
      {
        title: "Creating a shift template",
        steps: [
          "Go to Shifts & Schedules → Company Shift Templates and click Create New Shift Template.",
          "Enter a Shift Template Name (e.g. Morning Shift), a Start Time and an End Time in the company timezone.",
          "Set the Pay Rate Multiplier: 1.0 is the normal rate, 1.5 is time and a half, 2.0 is double time.",
          "Optionally configure Auto-Break Config (break duration, after how many hours, and whether it's deductible).",
          "Click Create Shift.",
        ],
        tips: ["Use the edit and delete icons on a template to change or remove it."],
      },
    ],
  },
  {
    id: "schedules",
    groupId: "shifts&schedules",
    routeId: "company/schedules",
    title: "Employees Schedule",
    summary: "Assign shift templates to employees on recurring days.",
    topics: [
      {
        title: "Creating a schedule",
        steps: [
          "Go to Shifts & Schedules → Employees Schedule and click Create Schedule.",
          "Choose a Shift, the Days of the week, and a Start Date and End Date.",
          "Choose the Assignment Type: specific employee(s), a department, or all employees.",
          "Save the schedule.",
        ],
        tips: [
          "If the new schedule overlaps existing shifts, Schedule Conflicts Detected lets you choose Keep Current or Create Custom for each conflict.",
          "Switch between List and Calendar views. In Calendar, click a day to see who's scheduled.",
        ],
      },
      {
        title: "Uploading a schedule",
        steps: [
          "Click Upload Schedule.",
          "Choose how you'll mark it: Existing shifts (pick the shifts this upload uses; each one becomes a column, and you can search the list) or Time blocks (30-min, and say whether it includes overnight shifts).",
          "Pick a start and end date (up to 14 days) and the target employees (all active employees, one department, or specific employees; supervisors choose from their team), then Download CSV Template. It comes pre-filled with one row per employee per date.",
          "Mark x (or 1 / yes) under each shift (or time block) the employee works. Leave a row blank for a day off. Drag the file back in (.csv, up to 5MB).",
          "Review the preview. Clean entries are created. Entries that overlap an existing assignment are set to Reject; switch any you want to Replace. Then Confirm. The button shows how many will be created and replaced.",
        ],
        tips: [
          "Upload with the same mode, shifts and dates you used for the template. Don't rename or reorder its columns.",
          "Replace removes the existing assignment and notifies the employee. It isn't allowed once the employee has punched that day or the date is in a locked cutoff.",
          "Rows that overlap another row in the same file, or can't be processed, aren't imported. Fix them in the file and upload it again.",
          "The first row of the template is a guide (it starts with #) and is never imported. You can delete it or leave it in.",
          "Supervisors can upload for their team: their own department and their direct reports.",
        ],
      },
    ],
  },

  // ── Locations ─────────────────────────────────────────────────────────────
  {
    id: "locations",
    groupId: "locations",
    routeId: "company/locations",
    title: "Employees Location Restriction",
    summary: "Create geofenced work sites so employees can only punch on site.",
    topics: [
      {
        title: "Creating a location",
        steps: [
          "Go to Locations → Employees Location Restriction and click Create Location.",
          "Enter a Location Name, then search for an address or click Use My Current Location.",
          "Set the Geofence Radius in meters.",
          "Click Create Location.",
        ],
      },
      {
        title: "Assigning employees",
        body: "Click a location's user count to manage who's assigned, then Add Employee. Assigning employees turns on location-based attendance for them at that site. Removing an employee removes their access to the location.",
        tips: ["Deleting a location removes access for everyone assigned to it immediately."],
      },
    ],
  },

  // Payroll pages live under Employee Panel → Payroll. groupId "payroll" draws the
  // bold Payroll heading; it is not a Company Panel sidebar group.
  {
    id: "payroll-management",
    groupId: "payroll",
    routeId: "employee/payroll",
    title: "Payroll Management",
    summary: "Load hours from a processed cutoff, compute pay, and save the payroll report.",
    topics: [
      {
        title: "Opening Payroll Management",
        body: "Go to Employee Panel → Payroll → Payroll Management. Admins, supervisors and superadmins can open it. The page has five tabs: Employee Sheet, Reports, Employee, Company and Check Printing. Employee Sheet and Reports are marked Beta.",
      },
      {
        title: "Running payroll on Employee Sheet",
        body: "Employee Sheet is the payroll workflow: load hours, compute salaries, then process the payroll report.",
        steps: [
          "Under Load hours, choose a Processed cutoff. From and To fill in from that cutoff.",
          "Click Load Hours. If the cutoff is not listed, it still needs a payroll export. Use Create Cutoff, or Review & process on a pending cutoff, then come back and load hours.",
          "Click Compute Salary. The sheet fills Gross Pay, deductions, taxes and Net Pay. Total Net Payroll shows once the compute finishes.",
          "Click Process Payroll Report. This saves the run. Open More for Save Payroll, Add Deduction Column, Export Excel or Refresh Data.",
        ],
        tips: [
          "Load Hours becomes Reload Hours after the first load. Compute Salary becomes Recompute Salary, and Process Payroll Report becomes Reprocess Payroll Report.",
          "Hours include active employees and supervisors. Overtime includes approved hours only.",
          "Salary employees are paid from annual pay divided by the number of periods in the year. Hourly employees are paid from their rate times the loaded punch hours.",
        ],
      },
      {
        title: "Employee payroll settings",
        steps: [
          "Open the Employee tab and select a person.",
          "Under Payroll Settings, set Marital Status, Pay Type (Hourly or Salary), the pay rate, and Driver Rate if they drive.",
          "Set PTO Hours Balance, Additional Fed Income Tax, Additional State Income Tax, and With CalSavers if it applies.",
          "Under Tax Exemptions, Yes means that tax is withheld at $0. Federal, Social Security, Medicare, SDI and PIT can each be exempt.",
          "Under Tax Rate Overrides, leave Federal Tax Rate and State Tax Rate on Auto to use the company brackets, or choose Custom and enter a flat percent.",
          "Click SAVE.",
        ],
        tips: ["Name, address and Active come from the employee profile and can't be edited here."],
      },
      {
        title: "Company payroll settings",
        steps: [
          "Open the Company tab.",
          "Company Information is read-only. Change the company profile under Settings → Profile.",
          "Under Payroll & Cutoff Settings, set Pay Frequency (Weekly, Bi-Weekly, Semi-Monthly or Monthly), Cutoff Start Day, Payment Day and PTO Enabled. Click Calculate Pay Period if you want the dates filled in, then UPDATE SETTINGS.",
          "Under Federal Income Tax Brackets and State Income Tax Brackets, add or edit brackets per filing status. Each bracket uses annual taxable income.",
          "Under Payroll Tax Rates, set Social Security (FICA), Medicare Tax and State Disability (SDI), then click SAVE TAX RATES. Employer taxes (not taken from the employee's net) are saved with Save rate.",
        ],
      },
      {
        title: "Reports",
        steps: [
          "Open the Reports tab. A red count means a saved run has not been opened yet.",
          "Payroll Detail is the working report. 941 Tax Liability and DE-9C are not available yet.",
          "Choose a Period type: Custom Range, Monthly, Quarterly or Yearly.",
          "Export the report, or open a run to View paycheck, Download a payslip, or Print check.",
        ],
        tips: [
          "Create Disbursement Batch on a saved run opens that payroll in Disbursement. If a batch already exists, the button is View Disbursement.",
          "Emailing a payslip waits until that employee's payment is recorded in Disbursement.",
        ],
      },
      {
        title: "Check printing",
        steps: [
          "Open the Check Printing tab.",
          "Under Select Template, choose the check layout.",
          "Under Fine-tune Settings, adjust positions and font sizes. Reset to Default restores the template.",
          "Click Generate Test PDF to preview a check.",
        ],
      },
    ],
  },
  {
    id: "disbursement",
    groupId: "payroll",
    routeId: "employee/disbursement",
    title: "Disbursement",
    summary: "Pay a finalized payroll: review who is paid by bank, record payments made outside BizBuddy, and keep a proof of payment.",
    topics: [
      {
        title: "Who can use Disbursement",
        body: "Open Employee Panel → Payroll → Disbursement. Admins, supervisors and superadmins can open it. Employees use Payroll → Payout account to connect the bank that receives their pay.",
        tips: [
          "Admins create a batch, set up company funding, choose how each person is paid, and record an outside payment.",
          "Supervisors can review a batch and approve it. The person who created the batch cannot approve it.",
          "The person who approved a batch cannot attach the payment proof. A different administrator does that.",
        ],
      },
      {
        title: "Starting a disbursement",
        steps: [
          "Go to Payroll → Disbursement.",
          "Under Start a disbursement, choose a locked, finalized payroll that does not already have an open batch.",
          "Click Create batch. BizBuddy opens that batch for review.",
        ],
        tips: [
          "If the list says No payroll is ready, finalize and lock a payroll first, or cancel the open batch for that period.",
          "Company funding opens the company payout account. View batches opens the full list.",
        ],
      },
      {
        title: "Reading the overview",
        body: "The cards at the top of Disbursement show payroll that is ready to pay, how many payroll runs are finalized, employees still awaiting payout setup, batches awaiting approval, batches ready for submission, completed batches, and failed or exception batches. A card you can act on opens that list. Employees awaiting payout setup opens company funding.",
      },
      {
        title: "Finding a batch",
        steps: [
          "Click View batches, or open a card on the overview.",
          "Filter by status, or search by payroll period, who created the batch, or its status.",
          "Click a row to open Review disbursement.",
        ],
      },
      {
        title: "Choosing how each person is paid",
        steps: [
          "On Review disbursement, find the employee under Recipients. Search by name, account or status, and click a column heading to sort.",
          "Under Payment, choose Automatic bank or Manual payment.",
          "For Automatic bank, Bank connected means a payout account is already linked. Otherwise click Set up payout account and enter their name, email and bank details.",
          "Manual payment is for a check, cash, or other payment made outside BizBuddy.",
        ],
        tips: [
          "Set up payout account stays unavailable until the company funding account is linked.",
          "A linked employee bank is not replaced by saving again.",
          "Blocking errors, shown in red, stop approval until they are resolved. Warnings, shown in amber, do not block approval by themselves.",
          "Approval history shows who created the batch, who approved it, and who recorded payment. Audit history lists each change, who made it, and when.",
        ],
      },
      {
        title: "Approving a batch",
        steps: [
          "When the batch is Ready for Review, click Approve Disbursement.",
          "Check the recipient count, total, currency and payroll period, then confirm.",
        ],
        tips: [
          "A different person from the creator must approve. Supervisors and admins can approve.",
          "Approving does not send money. Recipient amounts cannot be changed after approval.",
          "The creator sees Waiting for a second person to approve.",
        ],
      },
      {
        title: "Recording a payment made outside BizBuddy",
        body: "This is available once the batch is Ready for Disbursement, and only for employees set to Manual payment. The person who approved the batch cannot record it.",
        steps: [
          "Click Mark paid on one employee, or Mark all paid for every unpaid manual recipient.",
          "Choose Payment sent via: Check, Cash or Other.",
          "Attach Proof of payment: a PNG, JPEG, WebP or PDF, up to 5MB. You can drag the file in.",
          "Confirm. BizBuddy records the payment. It does not transfer money.",
        ],
        tips: [
          "Mark all paid uses one method and one proof file for every unpaid manual recipient.",
          "View proof on a recipient, or View payment proof on the batch, opens the file that was attached.",
          "Send payouts is on the review page, but automatic bank transfers are still under development. Clicking it asks you to contact BizBuddy. It does not move money.",
        ],
      },
      {
        title: "Cancelling a batch",
        steps: [
          "On a batch that is Ready for Review, Approved, or Ready for Disbursement, click Cancel.",
          "Confirm Cancel batch.",
        ],
        tips: [
          "Only an administrator can cancel.",
          "Cancelling does not move money. It lets a new disbursement be created from the same payroll run.",
        ],
      },
      {
        title: "Batch statuses",
        statuses: [
          { label: "Draft", tone: "warning", meaning: "Started, and not ready for review yet." },
          { label: "Ready for Review", tone: "warning", meaning: "Waiting for a second person to approve." },
          { label: "Approved", tone: "info", meaning: "Approved. Money has not been sent." },
          { label: "Ready for Disbursement", tone: "info", meaning: "Approved and ready to record payment." },
          { label: "Processing", tone: "warning", meaning: "A payout is in progress." },
          { label: "Completed", tone: "success", meaning: "Payout recorded or confirmed." },
          { label: "Failed", tone: "danger", meaning: "The payout did not complete." },
          { label: "Needs Review", tone: "danger", meaning: "Something needs a person to look at it before it can continue." },
          { label: "Cancelled", tone: "neutral", meaning: "Closed without paying. The payroll run can be used for a new batch." },
        ],
      },
      {
        title: "Recipient statuses",
        statuses: [
          { label: "Pending", tone: "neutral", meaning: "Not paid yet." },
          { label: "Ready", tone: "info", meaning: "Ready to be paid." },
          { label: "Automated transfer ready", tone: "info", meaning: "Their payout account is linked for an automatic bank payment." },
          { label: "Warning", tone: "warning", meaning: "Something to check. A warning does not block approval by itself." },
          { label: "Blocked", tone: "danger", meaning: "This person cannot be paid until the blocking issue is fixed." },
          { label: "Failed", tone: "danger", meaning: "Their payment did not complete." },
          { label: "Paid", tone: "success", meaning: "Payment recorded. The method and who recorded it show under Payment." },
        ],
      },
      {
        title: "Company funding",
        body: "The company bank account funds payroll. Employees do not use this account to receive pay. Only an administrator can set it up. Open it with Company funding on the Disbursement page.",
        steps: [
          "Choose a Funding provider: Moov or Stripe. This cannot be changed once the account is linked.",
          "Enter the Legal name and Email. For Moov, also choose a Business type. Saving accepts Moov's terms.",
          "Enter the Account holder name, Holder type (Business or Individual), Account type, Routing number and Account number.",
          "Click Save payout account.",
        ],
        tips: [
          "Bank numbers are sent once. Saving again does not replace a bank that is already linked.",
          "If the page says money movement is not enabled yet, a payment provider has not been configured.",
          "For Moov, Bank verification may ask for a code from two small deposits on the company bank statement. Enter that code and click Submit code. BizBuddy does not create the code.",
          "For Moov, Enable tax service for this company turns the tax service on or off.",
        ],
      },
    ],
  },
];

export default companyDocsContent;
