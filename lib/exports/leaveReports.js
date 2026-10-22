// lib/exports/leaveReports.js
// BB-098 — Leave reports from GET /api/reports/leave (docs/server-request-BB-098-leave-report.md
// + the server's reply). The server returns JSON per report type; this file turns it into
// one table spec, then writes that spec as CSV or PDF.
import {
  BRANDING,
  fetchCurrentUser,
  extractUserInfo,
  wrapCSV,
  drawBizBuddyLogo,
  formatUserForFilename,
  getTimestampForFilename,
  getFormattedTimestamp,
  jsPDF,
  autoTable,
} from "./_shared.js";

// Labels are mirrored in LeaveReportDialog (kept separate so jsPDF loads lazily).
const LEAVE_REPORT_TYPES = {
  summary:    { label: "Balance Summary",       title: "LEAVE BALANCE SUMMARY" },
  activity:   { label: "Activity by Period",    title: "LEAVE ACTIVITY REPORT" },
  expiration: { label: "Fiscal-Year Expiration", title: "LEAVE CREDIT EXPIRATION REPORT" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GROUP_LABELS = { month: "Monthly", quarter: "Quarterly", year: "Yearly" };
const STATE_LABELS = { active: "Active", expiring_soon: "Expiring soon", expired: "Expired" };

const hrs = (n) => (n == null || n === "" ? "—" : Number(n).toFixed(2));

// "YYYY-MM-DD" → "Oct 21, 2026" without a UTC shift.
const fmtYmd = (ymd) => {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtIso = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

const employeeCells = (e = {}) => [e.employeeId || "—", e.name || e.email || "—", e.department || "—"];
const EMPLOYEE_COLUMNS = [
  { header: "Employee ID" },
  { header: "Employee" },
  { header: "Department" },
];

function settingsLine(s = {}) {
  if (!s.leaveCreditsInitializedAt) return "Leave credit setup hasn't been applied yet — no fiscal-year credits exist.";
  const start = `${MONTHS[(s.leaveYearStartMonth || 1) - 1]} ${s.leaveYearStartDay || 1}`;
  return [
    `${s.leaveGrantHours ?? "—"}h per fiscal year (${s.leaveGrantMode === "monthly_accrual" ? "monthly accrual" : "yearly lump sum"})`,
    `fiscal year starts ${start}`,
    s.leaveExpirationEnabled ? `${s.leaveCreditLifetimeYears}-year lifetime` : "expiration off",
    s.leaveExpiryReminderDays ? `${s.leaveExpiryReminderDays}-day reminder` : null,
  ].filter(Boolean).join(" · ");
}

// ── Table specs per report type ──────────────────────────────────────────────
// Each returns { columns: [{ header, align }], body: string[][], foot?: string[], info: [label, value][], notes: string[] }

function summaryTable(d, { includeGranted }) {
  const rows = d.rows || [];
  // One column per fiscal year across all rows, newest first — same as the Leave Credits matrix.
  const byYear = new Map();
  rows.forEach((r) => (r.creditLots || []).forEach((l) => { if (!byYear.has(l.fiscalYear)) byYear.set(l.fiscalYear, l.label); }));
  const years = [...byYear].sort((a, b) => b[0] - a[0]);

  const columns = [
    ...EMPLOYEE_COLUMNS,
    { header: "Leave Type" },
    { header: "Credited", align: "right" },
    ...(includeGranted ? [{ header: "Granted", align: "right" }] : []),
    { header: "Used", align: "right" },
    { header: "Adjusted", align: "right" },
    { header: "Expired", align: "right" },
    { header: "Available", align: "right" },
    ...years.map(([, label]) => ({ header: `${label} Left`, align: "right" })),
  ];
  const body = rows.map((r) => [
    ...employeeCells(r.employee),
    r.leaveType || "—",
    hrs(r.creditedHours),
    ...(includeGranted ? [hrs(r.grantedHours)] : []),
    hrs(r.usedHours),
    hrs(r.adjustedHours),
    hrs(r.expiredHours),
    hrs(r.availableHours),
    ...years.map(([fy]) => {
      const lot = (r.creditLots || []).find((l) => l.fiscalYear === fy);
      if (!lot) return "—";
      return lot.expiredAt ? `${hrs(lot.remainingHours)} (expired)` : hrs(lot.remainingHours);
    }),
  ]);
  const t = d.totals || {};
  const foot = [
    "Total", "", "", "",
    hrs(t.creditedHours),
    ...(includeGranted ? [hrs(t.grantedHours)] : []),
    hrs(t.usedHours), hrs(t.adjustedHours), hrs(t.expiredHours), hrs(t.availableHours),
    ...years.map(() => ""),
  ];
  return {
    columns, body, foot,
    info: [["Balances As Of", fmtYmd(d.filters?.to)]],
    notes: [
      "Credited = automatic grants plus positive admin adjustments. Balances set up before leave credits were turned on were added as adjustments, so they count here.",
      years.length ? `Fiscal-year columns show credits as of ${fmtYmd(d.creditLotsAsOf)} (today), not the as-of date.` : null,
    ].filter(Boolean),
  };
}

function activityTable(d, { includeGranted }) {
  const rows = d.rows || [];
  const columns = [
    ...EMPLOYEE_COLUMNS,
    { header: "Leave Type" },
    { header: "Period" },
    { header: "Opening", align: "right" },
    { header: "Credited", align: "right" },
    ...(includeGranted ? [{ header: "Granted", align: "right" }] : []),
    { header: "Used", align: "right" },
    { header: "Unpaid", align: "right" },
    { header: "Adjusted", align: "right" },
    { header: "Expired", align: "right" },
    { header: "Closing", align: "right" },
  ];
  const body = rows.map((r) => [
    ...employeeCells(r.employee),
    r.leaveType || "—",
    r.period?.label || r.period?.key || "—",
    hrs(r.openingHours),
    hrs(r.creditedHours),
    ...(includeGranted ? [hrs(r.grantedHours)] : []),
    hrs(r.usedHours),
    hrs(r.unpaidHours),
    hrs(r.adjustedHours),
    hrs(r.expiredHours),
    hrs(r.closingHours),
  ]);
  const all = d.totals?.all || {};
  const foot = [
    "Total", "", "", "", "", "",
    hrs(all.creditedHours),
    ...(includeGranted ? [hrs(all.grantedHours)] : []),
    hrs(all.usedHours), hrs(all.unpaidHours), hrs(all.adjustedHours), hrs(all.expiredHours),
    "",
  ];
  const f = d.filters || {};
  return {
    columns, body, foot,
    info: [
      ["Date Range", `${fmtYmd(f.from)} – ${fmtYmd(f.to)}`],
      ["Grouping", `${GROUP_LABELS[f.groupBy] || f.groupBy || "—"} (${f.basis === "calendar" ? "calendar" : "fiscal"} year)`],
    ],
    notes: [
      "Credited, used, adjusted and expired hours are counted on the date the balance changed (for a leave, its approval date). Unpaid hours are counted on the leave day itself, so they can fall in a different period from the leave's used hours.",
      "The first and last periods can be partial — they're cut to the selected date range.",
    ],
  };
}

function expirationTable(d) {
  const rows = d.rows || [];
  const columns = [
    ...EMPLOYEE_COLUMNS,
    { header: "Leave Type" },
    { header: "Fiscal Year" },
    { header: "Granted", align: "right" },
    { header: "Used", align: "right" },
    { header: "Expired", align: "right" },
    { header: "Remaining", align: "right" },
    { header: "Expires On", align: "center" },
    { header: "State", align: "center" },
    { header: "Reminder Sent", align: "center" },
  ];
  const body = rows.map((r) => [
    ...employeeCells(r.employee),
    r.leaveType || "—",
    r.label || (r.fiscalYear != null ? `FY${r.fiscalYear}` : "—"),
    hrs(r.grantedHours),
    hrs(r.usedHours),
    hrs(r.expiredHours),
    hrs(r.remainingHours),
    fmtYmd(r.expiresOn),
    STATE_LABELS[r.state] || r.state || "—",
    fmtIso(r.reminderSentAt),
  ]);
  const t = d.totals || {};
  const f = d.filters || {};
  return {
    columns, body,
    info: [
      ["State As Of", fmtYmd(f.to)],
      ["Expiring Soon", `within ${f.expiringWithinDays ?? "—"} days`],
    ],
    notes: [
      `Active: ${t.active?.count ?? 0} lot(s), ${hrs(t.active?.remainingHours ?? 0)}h left · `
        + `Expiring soon: ${t.expiring_soon?.count ?? 0} lot(s), ${hrs(t.expiring_soon?.remainingHours ?? 0)}h left · `
        + `Expired: ${t.expired?.count ?? 0} lot(s), ${hrs(t.expired?.expiredHours ?? 0)}h expired.`,
    ],
  };
}

const TABLE_BUILDERS = { summary: summaryTable, activity: activityTable, expiration: expirationTable };

// ── Writers ──────────────────────────────────────────────────────────────────

function writeCSV({ d, spec, title, userInfo, generatedAt, filename }) {
  const lines = [
    [`${BRANDING.companyName.toUpperCase()} - ${title}`],
    [BRANDING.tagline],
    [],
    ["Company:", d.company?.name || userInfo.companyName],
    ...spec.info,
    ["Leave Credits:", settingsLine(d.settings)],
    ["Generated By:", `${userInfo.fullName} | ${userInfo.username}`],
    ["Generated At:", generatedAt],
    ["Total Records:", String(spec.body.length)],
    [],
    spec.columns.map((c) => c.header),
    ...spec.body,
    ...(spec.foot ? [spec.foot] : []),
    [],
    ...spec.notes.map((n) => [`Note: ${n}`]),
  ];
  const csv = lines.map((row) => row.map(wrapCSV).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function writePDF({ d, spec, title, userInfo, generatedAt, filename }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ===== HEADER SECTION =====
  let yPos = 15;
  await drawBizBuddyLogo(doc, 15, yPos);

  doc.setTextColor(...BRANDING.colors.primary);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, yPos + 6, { align: "center" });

  doc.setTextColor(...BRANDING.colors.dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(BRANDING.tagline, pageWidth / 2, yPos + 11, { align: "center" });

  doc.setTextColor(...BRANDING.colors.light);
  doc.setFontSize(8);
  doc.text(`Generated: ${generatedAt}`, pageWidth - 15, yPos + 3, { align: "right" });

  yPos += 18;
  doc.setDrawColor(...BRANDING.colors.primary);
  doc.setLineWidth(0.8);
  doc.line(15, yPos, pageWidth - 15, yPos);

  // ===== REPORT INFORMATION SECTION =====
  const info = [
    ["Company:", d.company?.name || userInfo.companyName],
    ["Generated By:", `${userInfo.fullName} | ${userInfo.username}`],
    ...spec.info.map(([k, v]) => [`${k}:`, v]),
    ["Total Records:", String(spec.body.length)],
  ];
  const infoRows = Math.ceil(info.length / 2);
  yPos += 6;
  doc.setFillColor(...BRANDING.colors.primaryLight);
  doc.roundedRect(15, yPos, pageWidth - 30, 14 + infoRows * 5, 2, 2, "F");

  doc.setTextColor(...BRANDING.colors.primary);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("REPORT INFORMATION", 20, yPos + 5);

  const col2X = pageWidth / 2;
  doc.setTextColor(...BRANDING.colors.dark);
  doc.setFontSize(9);
  info.forEach(([k, v], i) => {
    const x = i % 2 === 0 ? 20 : col2X;
    const y = yPos + 10 + Math.floor(i / 2) * 5;
    doc.setFont("helvetica", "bold");
    doc.text(k, x, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), x + 30, y);
  });
  doc.setFont("helvetica", "bold");
  doc.text("Leave Credits:", 20, yPos + 10 + infoRows * 5);
  doc.setFont("helvetica", "normal");
  doc.text(settingsLine(d.settings), 50, yPos + 10 + infoRows * 5);

  // ===== TABLE SECTION =====
  yPos += 22 + infoRows * 5;
  const columnStyles = {};
  spec.columns.forEach((c, i) => { columnStyles[i] = { halign: c.align || "left" }; });
  autoTable(doc, {
    head: [spec.columns.map((c) => c.header)],
    body: spec.body,
    foot: spec.foot ? [spec.foot] : undefined,
    startY: yPos,
    margin: { left: 15, right: 15, bottom: 20 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      textColor: BRANDING.colors.dark,
    },
    headStyles: {
      fillColor: BRANDING.colors.primary,
      textColor: BRANDING.colors.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: BRANDING.colors.primaryLight,
      textColor: BRANDING.colors.dark,
      fontStyle: "bold",
    },
    showFoot: "lastPage",
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
  });

  // ===== NOTES =====
  let notesY = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...BRANDING.colors.light);
  spec.notes.forEach((n) => {
    const wrapped = doc.splitTextToSize(`Note: ${n}`, pageWidth - 30);
    if (notesY + wrapped.length * 3.5 > pageHeight - 20) { doc.addPage(); notesY = 20; }
    doc.text(wrapped, 15, notesY);
    notesY += wrapped.length * 3.5 + 1.5;
  });

  // ===== FOOTER ON ALL PAGES =====
  const pageCount = doc.internal.getNumberOfPages();
  const currentYear = new Date().getFullYear();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setDrawColor(...BRANDING.colors.light);
    doc.setLineWidth(0.3);
    doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`${BRANDING.companyName} | ${BRANDING.tagline}`, 15, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRANDING.colors.light);
    doc.text(`© ${currentYear}`, 15, pageHeight - 7);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(7);
    doc.text(`Requestor: ${userInfo.fullName} | ${userInfo.email}`, pageWidth / 2, pageHeight - 9, { align: "center" });

    doc.setTextColor(...BRANDING.colors.light);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 9, { align: "right" });
  }

  doc.save(filename);
}

/**
 * Writes one leave report as CSV or PDF.
 * @param {Object} params
 * @param {Object} params.report - `data` from GET /api/reports/leave
 * @param {"csv"|"pdf"} params.format
 * @param {boolean} params.includeGranted - add a Granted column next to Credited (summary/activity)
 * @param {Object} params.user - (Optional) admin generating the report; fetched if not provided
 * @returns {Object} Result object with success flag and filename
 */
export const exportLeaveReport = async ({ report, format, includeGranted = false, user = null }) => {
  const builder = TABLE_BUILDERS[report?.type];
  if (!builder) throw new Error(`Unsupported report type: ${report?.type}`);
  if (!report.rows || report.rows.length === 0) throw new Error("No data to export");

  try {
    const userData = user || await fetchCurrentUser();
    const userInfo = extractUserInfo(userData);
    const generatedAt = getFormattedTimestamp();
    const spec = builder(report, { includeGranted });
    const title = LEAVE_REPORT_TYPES[report.type].title;
    const typeForFile = LEAVE_REPORT_TYPES[report.type].label.replace(/[^a-zA-Z]+/g, "");
    const filename = `BizBuddy_LeaveReport_${typeForFile}_${formatUserForFilename(userData)}_${getTimestampForFilename()}.${format}`;

    if (format === "pdf") await writePDF({ d: report, spec, title, userInfo, generatedAt, filename });
    else writeCSV({ d: report, spec, title, userInfo, generatedAt, filename });

    return { success: true, filename };
  } catch (error) {
    console.error("❌ Leave report export failed:", error);
    throw error;
  }
};
