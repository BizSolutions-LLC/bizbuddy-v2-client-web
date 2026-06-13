// lib/exports/employeePunchLogs.js
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

const fmtLastFirst = (map, userId, fallback = "") => {
  const n = map?.[userId];
  if (!n) return fallback || "—";
  if (!n.lastName && !n.firstName) return fallback || "—";
  if (!n.lastName)  return n.firstName;
  if (!n.firstName) return n.lastName;
  return `${n.lastName}, ${n.firstName}`;
};

// ==========================================
// PUNCH LOGS EXPORT FUNCTIONS
// ==========================================

/**
 * Exports punch logs data as CSV with requester accountability and timezone support
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of punch log records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.filters - Active filters object
 * @param {string} params.userTimezone - User's timezone
 * @param {string} params.companyTimezone - Company HQ timezone
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportEmployeePunchLogsCSV = async ({
  data,
  visibleColumns,
  columnMap,
  filters = {},
  userTimezone = "UTC",
  companyTimezone = "UTC",
  isDayCare = false,
  bncOtBlocks = [],
  bncDailyOtThreshold = 8,
  employeeNameMap = {},
  user = null,
  filename = null
}) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  if (!visibleColumns || visibleColumns.length === 0) {
    throw new Error("No columns selected for export");
  }

  if (!columnMap) {
    throw new Error("Column map is required for export");
  }

  try {
    // Fetch user data if not provided
    const userData = user || await fetchCurrentUser();

    const userInfo = extractUserInfo(userData);
    const generatedAt = getFormattedTimestamp();
    const userForFile = formatUserForFilename(userData);
    const timestamp = getTimestampForFilename();

    // BNC: build approved OT block lookup by "userId|YYYY-MM-DD"
    const approvedOtByKey = new Map();
    if (!isDayCare) {
      (bncOtBlocks || [])
        .filter(b => b.status === "approved")
        .forEach(b => approvedOtByKey.set(`${b.userId}|${b.date}`, b));
    }
    const bncApprovedOtTotal = !isDayCare
      ? [...approvedOtByKey.values()].reduce((s, b) => s + (parseFloat(b.otHours) || 0), 0)
      : 0;

    // Calculate summary statistics
    const totalRecords = data.length;
    const activeRecords = data.filter(d => d.status === 'active').length;
    const completedRecords = data.filter(d => d.status === 'completed').length;
    const scheduledRecords = data.filter(d => d.isScheduled).length;
    const totalDurationHours = data.reduce((sum, d) => sum + (parseFloat(d.duration) || 0), 0).toFixed(2);
    const totalPeriodHours   = data.reduce((sum, d) => sum + (parseFloat(d.periodHours) || 0), 0).toFixed(2);
    const totalOvertimeHours = (data.reduce((sum, d) => sum + (parseFloat(d.otHours) || 0), 0) + bncApprovedOtTotal).toFixed(2);

    // Employee-level aggregations — employeeOrder tracks first appearance in `data` (mirrors table sort)
    const employeeStats = {};
    const employeeOrder = [];
    data.forEach(log => {
      if (!employeeStats[log.userId]) {
        employeeStats[log.userId] = {
          name: fmtLastFirst(employeeNameMap, log.userId, log.employeeName),
          totalHours: 0,
          periodHours: 0,
          totalOT: 0,
          daysWorked: new Set(),
        };
        employeeOrder.push(log.userId);
      }
      employeeStats[log.userId].totalHours  += parseFloat(log.duration)    || 0;
      employeeStats[log.userId].periodHours += parseFloat(log.periodHours) || 0;
      employeeStats[log.userId].totalOT     += parseFloat(log.otHours)     || 0;
      if (log.timeIn) {
        employeeStats[log.userId].daysWorked.add(log.timeIn.slice(0, 10));
      }
    });
    // BNC: fold approved OT block hours into per-employee totals
    if (!isDayCare) {
      approvedOtByKey.forEach((b) => {
        if (employeeStats[b.userId]) {
          employeeStats[b.userId].totalOT += parseFloat(b.otHours) || 0;
        }
      });
    }

    const getTimezoneName = (tz) => {
      const parts = tz.split('/');
      return parts[parts.length - 1].replace(/_/g, ' ');
    };

    const showDualTimezone = userTimezone !== companyTimezone;

    // ===== BUILD HEADER =====
    const headerRows = [
      [`${BRANDING.companyName.toUpperCase()} - EMPLOYEE PUNCH LOGS REPORT`],
      [BRANDING.tagline],
      [""],
    ];

    // ===== REQUESTER INFORMATION SECTION =====
    const requesterRows = [
      ["REPORT REQUESTER INFORMATION"],
      [""],
      ["Company:", userInfo.companyName],
      ["Requester Name:", userInfo.fullName],
      ["Username:", userInfo.username],
      ["Email:", userInfo.email],
      ["User ID:", userInfo.userId],
      ["Report Generated:", generatedAt],
      [""],
      [""],
    ];

    // ===== ACTIVE FILTERS SECTION =====
    const filterRows = [
      ["ACTIVE FILTERS"],
      [""],
    ];

    let hasActiveFilters = false;
    if (filters.departmentId && filters.departmentId !== 'all') {
      filterRows.push(["Department Filter:", filters.departmentId]);
      hasActiveFilters = true;
    }
    if (filters.from) {
      filterRows.push(["Date From:", new Date(filters.from).toLocaleDateString()]);
      hasActiveFilters = true;
    }
    if (filters.to) {
      filterRows.push(["Date To:", new Date(filters.to).toLocaleDateString()]);
      hasActiveFilters = true;
    }
    if (filters.status && filters.status !== 'all') {
      filterRows.push(["Status Filter:", filters.status]);
      hasActiveFilters = true;
    }
    if (filters.employeeIds && filters.employeeIds.length > 0 && !filters.employeeIds.includes('all')) {
      filterRows.push(["Employee Filter:", `${filters.employeeIds.length} selected`]);
      hasActiveFilters = true;
    }

    if (!hasActiveFilters) {
      filterRows.push(["No active filters - showing all records"]);
    }

    filterRows.push([""], [""]);

    // ===== TIMEZONE INFORMATION =====
    const timezoneRows = [
      ["TIMEZONE INFORMATION"],
      [""],
      ["Your Timezone:", `${userTimezone} (${getTimezoneName(userTimezone)})`],
      ["Company HQ Timezone:", `${companyTimezone} (${getTimezoneName(companyTimezone)})`],
    ];

    if (showDualTimezone) {
      timezoneRows.push(["Note:", "Times shown in both your timezone and company HQ timezone"]);
    } else {
      timezoneRows.push(["Note:", "Your timezone matches company HQ timezone"]);
    }

    timezoneRows.push([""], [""]);

    // ===== SUMMARY STATISTICS =====
    const summaryRows = [
      ["SUMMARY STATISTICS"],
      [""],
      ["Total Records:", totalRecords],
      ["Active Sessions:", activeRecords],
      ["Completed Sessions:", completedRecords],
      ["Scheduled Sessions:", scheduledRecords],
      ["Total Duration Hours:", `${totalDurationHours} hrs`, "(actual computed hours)"],
      ["Total Period Hours:", `${totalPeriodHours} hrs`, "(scheduled hours)"],
      ["Total Overtime Hours:", `${totalOvertimeHours} hrs`],
      [""],
      [""],
    ];

    // ===== EMPLOYEE SUMMARY =====
    const employeeSummaryRows = [
      ["EMPLOYEE SUMMARY"],
      [""],
      ["Employee Name", "Duration Hours", "Period Hours", "Overtime Hours", "Days Worked", "Avg Hours/Day"],
    ];

    let grandDuration = 0, grandPeriod = 0, grandOT = 0;
    employeeOrder.map(id => employeeStats[id]).forEach(emp => {
      const avgHours = emp.daysWorked.size > 0
        ? (emp.totalHours / emp.daysWorked.size).toFixed(2)
        : "0.00";
      employeeSummaryRows.push([
        emp.name,
        emp.totalHours.toFixed(2),
        emp.periodHours.toFixed(2),
        emp.totalOT.toFixed(2),
        emp.daysWorked.size.toString(),
        avgHours
      ]);
      grandDuration += emp.totalHours;
      grandPeriod   += emp.periodHours;
      grandOT       += emp.totalOT;
    });

    employeeSummaryRows.push([
      "TOTAL",
      grandDuration.toFixed(2),
      grandPeriod.toFixed(2),
      grandOT.toFixed(2),
      "",
      ""
    ]);

    employeeSummaryRows.push([""], [""]);

    // ===== ACCOUNTABILITY NOTICE =====
    const accountabilityRows = [
      ["ACCOUNTABILITY NOTICE"],
      ["This report contains time tracking data and should be handled with care."],
      ["The requester information above is recorded for audit and compliance purposes."],
      ["Unauthorized use or distribution of this report may violate company policies."],
      [""],
      [""],
    ];

    // ===== TABLE HEADER =====
    const tableHeaderRows = [
      ["PUNCH LOGS DETAIL"],
      [""],
    ];

    // Filter columns to only visible ones (excluding 'actions'); ot/lunch window are BNC-only
    const exportColumns = [
      ...visibleColumns.filter(col => col !== "actions"),
      ...(!isDayCare ? ["ot", "lunchStart", "lunchEnd"] : []),
    ];

    // Build table headers - add timezone suffix if dual timezone
    const tableHeader = exportColumns.map(col => {
      const label = columnMap[col] || col;
      if (showDualTimezone && (col === "dateTimeIn" || col === "dateTimeOut")) {
        return `${label} (Your TZ / HQ TZ)`;
      }
      if (col === "ot" && !isDayCare) return "OT (Daily)";
      if (col === "lunchStart") return "Lunch Start";
      if (col === "lunchEnd")   return "Lunch End";
      return label;
    });

    // Helper function to format time with timezone
    const formatTimeWithTZ = (datetime, tz) => {
      if (!datetime) return "—";
      return new Date(datetime).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: tz
      });
    };

    const formatBreakTime = (d, tz) =>
      d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }) : "—";

    // ===== TABLE DATA ROWS =====
    // Single-cell builder — "ot" for BNC is handled by the caller using firstInGroup logic
    const buildCsvCell = (record, col) => {
      switch (col) {
        case "id":          return record.id || "—";
        case "schedule":    return record.isScheduled ? "Scheduled" : "Unscheduled";
        case "locationRestricted": return record.isLocRestricted ? "Required" : "None";
        case "employee":    return fmtLastFirst(employeeNameMap, record.userId, record.employeeName);
        case "dateTimeIn":
          if (showDualTimezone) return `${formatTimeWithTZ(record.timeIn, userTimezone)} / ${formatTimeWithTZ(record.timeIn, companyTimezone)}`;
          return formatTimeWithTZ(record.timeIn, userTimezone);
        case "dateTimeOut":
          if (showDualTimezone) return `${formatTimeWithTZ(record.timeOut, userTimezone)} / ${formatTimeWithTZ(record.timeOut, companyTimezone)}`;
          return formatTimeWithTZ(record.timeOut, userTimezone);
        case "duration":    return `${record.duration || "0.00"} hrs`;
        case "coffee":      return `${record.coffeeMins || "0.00"} hrs`;
        case "lunch":       return `${record.lunchMins || "0.00"} hrs`;
        case "ot":          return `${record.otHours || "0.00"} hrs`; // DAYCARE per-punch path
        case "otStatus":    return record.otStatus || "—";
        case "late":        return `${record.lateHours || "0.00"} hrs`;
        case "period":      return `${record.periodHours || "0.00"} hrs`;
        case "status":      return record.status === "active" ? "Active" : "Completed";
        case "deviceIn":    return record.fullDevIn || "—";
        case "deviceOut":   return record.fullDevOut || "—";
        case "locationIn":  return record.locIn?.txt || "—";
        case "locationOut": return record.locOut?.txt || "—";
        case "lunchStart":
          if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
            return "Auto-deducted";
          return formatBreakTime(record.lunchBreak?.start, companyTimezone);
        case "lunchEnd":
          if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
            return "Auto-deducted";
          return formatBreakTime(record.lunchBreak?.end, companyTimezone);
        case "punchType": {
          const labels = { REGULAR: "Regular", DRIVER_AIDE: "Driver/Aide", DRIVER_AIDE_AM: "Driver AM", DRIVER_AIDE_PM: "Driver PM", TRAINING: "Training" };
          return labels[record.punchType] ?? record.punchType ?? "—";
        }
        case "cutoffApproval": {
          const ca = record.cutoffApproval;
          if (!ca) return "Not in cutoff";
          return ca.status ? ca.status.charAt(0).toUpperCase() + ca.status.slice(1) : "—";
        }
        default: return record[col] ?? "—";
      }
    };

    // BNC: track first punch per employee+date — that row shows the daily OT value; others show "—"
    const csvGroupSeen = new Set();
    const tableRows = data.map((record) => {
      const dk = record.timeIn
        ? new Date(record.timeIn).toLocaleDateString("en-CA", { timeZone: companyTimezone }) : "";
      const k = `${record.userId}|${dk}`;
      const isFirstInGroup = !isDayCare && !csvGroupSeen.has(k);
      if (isFirstInGroup) csvGroupSeen.add(k);

      return exportColumns.map((col) => {
        if (col === "ot" && !isDayCare) {
          if (isFirstInGroup) {
            const block = approvedOtByKey.get(k);
            return block ? `${parseFloat(block.otHours).toFixed(2)} hrs` : "—";
          }
          return "—";
        }
        return buildCsvCell(record, col);
      });
    });

    // ===== FOOTER =====
    const footerRows = [
      [""],
      [""],
      ["REQUESTER ACCOUNTABILITY"],
      [`Requested by: ${userInfo.fullName} (${userInfo.email})`],
      [`Generated: ${generatedAt}`],
      [`Timezone: ${userTimezone}`],
      [""],
      [`${BRANDING.companyName} | ${BRANDING.tagline}`],
      [`© ${new Date().getFullYear()} | All Rights Reserved`],
      [""],
      ["This report is confidential and intended for authorized personnel only."],
    ];

    // ===== COMBINE ALL ROWS =====
    const allRows = [
      ...headerRows.map((row) => row.map(wrapCSV)),
      ...requesterRows.map((row) => row.map(wrapCSV)),
      ...filterRows.map((row) => row.map(wrapCSV)),
      ...timezoneRows.map((row) => row.map(wrapCSV)),
      ...summaryRows.map((row) => row.map(wrapCSV)),
      ...employeeSummaryRows.map((row) => row.map(wrapCSV)),
      ...accountabilityRows.map((row) => row.map(wrapCSV)),
      ...tableHeaderRows.map((row) => row.map(wrapCSV)),
      tableHeader.map(wrapCSV),
      ...tableRows.map((row) => row.map(wrapCSV)),
      ...footerRows.map((row) => row.map(wrapCSV)),
    ];

    const csvContent = allRows.map((row) => row.join(",")).join("\r\n");

    // ===== CREATE AND DOWNLOAD =====
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Enhanced filename with filter context
    let finalFilename = filename;
    if (!finalFilename) {
      finalFilename = `BizBuddy_PunchLogs_${userForFile}_${timestamp}`;
      if (filters.from && filters.to) {
        finalFilename += `_${filters.from.replace(/-/g, '')}-${filters.to.replace(/-/g, '')}`;
      }
      finalFilename += `_${totalRecords}records.csv`;
    }

    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Punch logs CSV export failed:", error);
    throw error;
  }
};

/**
 * Exports punch logs data as professional PDF with requester accountability and timezone support
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of punch log records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.filters - Active filters object
 * @param {string} params.userTimezone - User's timezone
 * @param {string} params.companyTimezone - Company HQ timezone
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportEmployeePunchLogsPDF = async ({
  data,
  visibleColumns,
  columnMap,
  filters = {},
  userTimezone = "UTC",
  companyTimezone = "UTC",
  isDayCare = false,
  bncOtBlocks = [],
  bncDailyOtThreshold = 8,
  employeeNameMap = {},
  user = null,
  filename = null
}) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  if (!visibleColumns || visibleColumns.length === 0) {
    throw new Error("No columns selected for export");
  }

  if (!columnMap) {
    throw new Error("Column map is required for export");
  }

  try {
    // Fetch user data if not provided
    const userData = user || await fetchCurrentUser();

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const userInfo = extractUserInfo(userData);
    const generatedAt = getFormattedTimestamp();
    const userForFile = formatUserForFilename(userData);
    const timestamp = getTimestampForFilename();

    // Calculate summary statistics
    const totalRecords = data.length;
    const activeRecords = data.filter(d => d.status === 'active').length;
    const completedRecords = data.filter(d => d.status === 'completed').length;
    const scheduledRecords = data.filter(d => d.isScheduled).length;
    const totalDurationHours = data.reduce((sum, d) => sum + (parseFloat(d.duration) || 0), 0).toFixed(2);
    const totalPeriodHours   = data.reduce((sum, d) => sum + (parseFloat(d.periodHours) || 0), 0).toFixed(2);
    // BNC: build approved OT block lookup by "userId|YYYY-MM-DD"
    const approvedOtByKeyPdf = new Map();
    if (!isDayCare) {
      (bncOtBlocks || [])
        .filter(b => b.status === "approved")
        .forEach(b => approvedOtByKeyPdf.set(`${b.userId}|${b.date}`, b));
    }
    const bncApprovedOtTotalPdf = !isDayCare
      ? [...approvedOtByKeyPdf.values()].reduce((s, b) => s + (parseFloat(b.otHours) || 0), 0)
      : 0;

    const totalOvertimeHours = (data.reduce((sum, d) => sum + (parseFloat(d.otHours) || 0), 0) + bncApprovedOtTotalPdf).toFixed(2);

    // Employee-level aggregations — employeeOrder tracks first appearance in `data` (mirrors table sort)
    const employeeStats = {};
    const employeeOrder = [];
    data.forEach(log => {
      if (!employeeStats[log.userId]) {
        employeeStats[log.userId] = {
          name: fmtLastFirst(employeeNameMap, log.userId, log.employeeName),
          totalHours: 0,
          periodHours: 0,
          totalOT: 0,
          daysWorked: new Set(),
        };
        employeeOrder.push(log.userId);
      }
      employeeStats[log.userId].totalHours  += parseFloat(log.duration)    || 0;
      employeeStats[log.userId].periodHours += parseFloat(log.periodHours) || 0;
      employeeStats[log.userId].totalOT     += parseFloat(log.otHours)     || 0;
      if (log.timeIn) {
        employeeStats[log.userId].daysWorked.add(log.timeIn.slice(0, 10));
      }
    });
    // BNC: fold approved OT block hours into per-employee totals
    if (!isDayCare) {
      approvedOtByKeyPdf.forEach((b) => {
        if (employeeStats[b.userId]) {
          employeeStats[b.userId].totalOT += parseFloat(b.otHours) || 0;
        }
      });
    }

    const getTimezoneName = (tz) => {
      const parts = tz.split('/');
      return parts[parts.length - 1].replace(/_/g, ' ');
    };

    const showDualTimezone = userTimezone !== companyTimezone;

    // ===== HEADER SECTION =====
    let yPos = 15;

    // Draw the BizBuddy logo
    await drawBizBuddyLogo(doc, 15, yPos);

    // Title
    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE PUNCH LOGS REPORT", pageWidth / 2, yPos + 6, { align: "center" });

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Time Tracking & Attendance Management", pageWidth / 2, yPos + 11, { align: "center" });

    // Requester info in top-right
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("REQUESTER:", pageWidth - 15, yPos + 2, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.fullName, pageWidth - 15, yPos + 5, { align: "right" });
    doc.text(userInfo.email, pageWidth - 15, yPos + 8, { align: "right" });

    yPos += 18;
    doc.setDrawColor(...BRANDING.colors.primary);
    doc.setLineWidth(0.8);
    doc.line(15, yPos, pageWidth - 15, yPos);

    // ===== REQUESTER INFO & FILTERS SECTION =====
    yPos += 6;
    doc.setFillColor(...BRANDING.colors.primaryLight);
    doc.roundedRect(15, yPos, pageWidth - 30, 32, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT INFORMATION", 20, yPos + 5);

    yPos += 9;
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(8);

    // Left column
    doc.setFont("helvetica", "bold");
    doc.text("Company:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.companyName, 45, yPos);

    // Right column - Active Filters
    doc.setFont("helvetica", "bold");
    doc.text("Active Filters:", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");

    let filterText = "";
    if (filters.from && filters.to) {
      filterText = `${new Date(filters.from).toLocaleDateString()} - ${new Date(filters.to).toLocaleDateString()}`;
    } else if (filters.from) {
      filterText = `From ${new Date(filters.from).toLocaleDateString()}`;
    } else if (filters.to) {
      filterText = `Until ${new Date(filters.to).toLocaleDateString()}`;
    } else {
      filterText = "All dates";
    }
    doc.text(filterText, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Requester:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${userInfo.fullName} (${userInfo.username})`, 45, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Status:", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(filters.status === 'all' ? 'All statuses' : filters.status || 'All', pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Email:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.email, 45, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Records:", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${totalRecords} total`, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Generated:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(generatedAt, 45, yPos);

    // Timezone info
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Timezone:", 20, yPos);
    doc.setFont("helvetica", "normal");
    if (showDualTimezone) {
      doc.text(`${getTimezoneName(userTimezone)} / ${getTimezoneName(companyTimezone)} (HQ)`, 45, yPos);
    } else {
      doc.text(getTimezoneName(userTimezone), 45, yPos);
    }

    // ===== SUMMARY STATISTICS BOX =====
    yPos += 10;

    doc.setFillColor(240, 249, 255); // Light blue background
    doc.roundedRect(15, yPos, pageWidth - 30, 25, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY STATISTICS", 20, yPos + 5);

    yPos += 10;
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(8);

    const col1X = 20;
    const col2X = pageWidth / 4;
    const col3X = pageWidth / 2;
    const col4X = (pageWidth / 4) * 3;

    // Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Total Records:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(totalRecords.toString(), col1X + 30, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Active:", col2X, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(37, 99, 235); // Blue
    doc.text(activeRecords.toString(), col2X + 20, yPos);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFont("helvetica", "bold");
    doc.text("Completed:", col3X, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74); // Green
    doc.text(completedRecords.toString(), col3X + 25, yPos);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFont("helvetica", "bold");
    doc.text("Scheduled:", col4X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(scheduledRecords.toString(), col4X + 25, yPos);

    // Row 2
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Duration Hours:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRANDING.colors.primary);
    doc.text(`${totalDurationHours}h`, col1X + 30, yPos);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFont("helvetica", "bold");
    doc.text("Period Hours:", col2X, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // Slate/muted
    doc.text(`${totalPeriodHours}h`, col2X + 25, yPos);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFont("helvetica", "bold");
    doc.text("Overtime:", col3X, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(245, 158, 11); // Amber
    doc.text(`${totalOvertimeHours}h`, col3X + 22, yPos);

    doc.setTextColor(...BRANDING.colors.dark);

    // Row 3 — legend
    yPos += 4;
    doc.setFontSize(6);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("Duration = actual computed hours  ·  Period = scheduled hours", col1X, yPos);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRANDING.colors.dark);

    // ===== EMPLOYEE SUMMARY TABLE =====
    yPos += 10;

    const employeeSummaryHeader = ["Employee", "Duration Hrs", "Period Hrs", "Overtime", "Days", "Avg/Day"];
    let pdfGrandDuration = 0, pdfGrandPeriod = 0, pdfGrandOT = 0;
    const employeeSummaryBody = employeeOrder.map(id => employeeStats[id]).map(emp => {
      const avgHours = emp.daysWorked.size > 0
        ? (emp.totalHours / emp.daysWorked.size).toFixed(1)
        : "0.0";
      pdfGrandDuration += emp.totalHours;
      pdfGrandPeriod   += emp.periodHours;
      pdfGrandOT       += emp.totalOT;
      return [
        emp.name,
        emp.totalHours.toFixed(2),
        emp.periodHours.toFixed(2),
        emp.totalOT.toFixed(2),
        emp.daysWorked.size.toString(),
        avgHours
      ];
    });

    autoTable(doc, {
      head: [employeeSummaryHeader],
      body: employeeSummaryBody,
      foot: [[
        "TOTAL",
        pdfGrandDuration.toFixed(2),
        pdfGrandPeriod.toFixed(2),
        pdfGrandOT.toFixed(2),
        "",
        ""
      ]],
      startY: yPos,
      margin: { left: 15, right: 15, bottom: 30 },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: BRANDING.colors.dark,
      },
      headStyles: {
        fillColor: [37, 99, 235], // Blue
        textColor: BRANDING.colors.white,
        fontStyle: "bold",
        fontSize: 7,
      },
      footStyles: {
        fillColor: [30, 64, 175],
        textColor: BRANDING.colors.white,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'right' },
      },
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1,
    });

    const afterSummaryY = doc.lastAutoTable?.finalY || yPos;
    yPos = afterSummaryY + 10;

    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Add spacing before main table
    yPos += 5;

    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    // Select appropriate columns for PDF (limit for space); ot/lunch window are BNC-only
    const pdfColumns = [
      ...visibleColumns.filter(col => col !== "actions" && col !== "id").slice(0, 8),
      ...(!isDayCare ? ["ot", "lunchStart", "lunchEnd"] : []),
    ];

    const tableHeaders = pdfColumns.map(col => {
      const label = columnMap[col] || col;
      // Shorten labels for PDF
      if (col === "dateTimeIn") return showDualTimezone ? "Time In (Your/HQ)" : "Time In";
      if (col === "dateTimeOut") return showDualTimezone ? "Time Out (Your/HQ)" : "Time Out";
      if (col === "employee") return "Employee";
      if (col === "duration") return "Dur.";
      if (col === "period") return "Period";
      if (col === "coffee") return "Coffee";
      if (col === "lunch") return "Lunch";
      if (col === "ot") return isDayCare ? "OT" : "OT (Daily)";
      if (col === "otStatus") return "OT Status";
      if (col === "late") return "Late";
      if (col === "status") return "Status";
      if (col === "lunchStart") return "Lunch Start";
      if (col === "lunchEnd")   return "Lunch End";
      return label;
    });

    const formatTimeShort = (datetime, tz) => {
      if (!datetime) return "—";
      return new Date(datetime).toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz
      });
    };

    const fmtBreakTimePDF = (d, tz) =>
      d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz }) : "—";

    // Single-cell builder — "ot" for BNC handled by the caller with rowspan logic
    const buildPdfCell = (record, col) => {
      switch (col) {
        case "employee": return fmtLastFirst(employeeNameMap, record.userId, record.employeeName);
        case "dateTimeIn":
          if (showDualTimezone) return `${formatTimeShort(record.timeIn, userTimezone)}\n${formatTimeShort(record.timeIn, companyTimezone)}`;
          return formatTimeShort(record.timeIn, userTimezone);
        case "dateTimeOut":
          if (showDualTimezone) return `${formatTimeShort(record.timeOut, userTimezone)}\n${formatTimeShort(record.timeOut, companyTimezone)}`;
          return formatTimeShort(record.timeOut, userTimezone);
        case "duration":
        case "coffee":
        case "lunch":
        case "ot":
        case "late":
        case "period": {
          const value = record[col === "duration" ? "duration" :
                               col === "coffee" ? "coffeeMins" :
                               col === "lunch" ? "lunchMins" :
                               col === "ot" ? "otHours" :
                               col === "late" ? "lateHours" :
                               "periodHours"] || "0.00";
          return `${value}h`;
        }
        case "status":   return record.status === "active" ? "Active" : "Done";
        case "schedule": return record.isScheduled ? "Yes" : "No";
        case "otStatus": return record.otStatus || "—";
        case "lunchStart":
          if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
            return "Auto";
          return fmtBreakTimePDF(record.lunchBreak?.start, companyTimezone);
        case "lunchEnd":
          if (!record.lunchBreak?.start && (record.lunchDeductionMinutes ?? 0) > 0)
            return "Auto";
          return fmtBreakTimePDF(record.lunchBreak?.end, companyTimezone);
        case "punchType": {
          const labels = { REGULAR: "Regular", DRIVER_AIDE: "Driver/Aide", DRIVER_AIDE_AM: "Driver AM", DRIVER_AIDE_PM: "Driver PM", TRAINING: "Training" };
          return labels[record.punchType] ?? record.punchType ?? "—";
        }
        case "cutoffApproval": {
          const ca = record.cutoffApproval;
          if (!ca) return "—";
          return ca.status ? ca.status.charAt(0).toUpperCase() + ca.status.slice(1) : "—";
        }
        default: return record[col] ?? "—";
      }
    };

    // BNC: pre-compute punch counts per employee+date for rowspan
    const pdfGroupMeta = new Map();
    if (!isDayCare) {
      data.forEach((record) => {
        const dk = record.timeIn
          ? new Date(record.timeIn).toLocaleDateString("en-CA", { timeZone: companyTimezone }) : "";
        const k = `${record.userId}|${dk}`;
        if (!pdfGroupMeta.has(k)) pdfGroupMeta.set(k, { count: 0, firstSeen: false });
        pdfGroupMeta.get(k).count++;
      });
    }

    // Build table rows — BNC OT column uses rowSpan on first punch of each day; others show "__SKIP__"
    const tableData = data.map((record) => {
      const dk = record.timeIn
        ? new Date(record.timeIn).toLocaleDateString("en-CA", { timeZone: companyTimezone }) : "";
      const k = `${record.userId}|${dk}`;
      const meta = pdfGroupMeta.get(k);
      const isFirst = meta && !meta.firstSeen;
      if (isFirst) meta.firstSeen = true;

      return pdfColumns.map((col) => {
        if (col === "ot" && !isDayCare) {
          if (isFirst) {
            const block = approvedOtByKeyPdf.get(k);
            const otHrs = block ? parseFloat(block.otHours).toFixed(2) : null;
            return {
              content: otHrs ? `${otHrs}h` : "—",
              ...(otHrs && meta.count > 1 ? { rowSpan: meta.count } : {}),
              styles: otHrs ? {
                fillColor: [245, 243, 255], textColor: [109, 40, 217],
                fontStyle: "bold", valign: "middle", halign: "center",
              } : {},
            };
          }
          return "__SKIP__";
        }
        return buildPdfCell(record, col);
      }).filter(c => c !== "__SKIP__");
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      margin: { left: 15, right: 15, bottom: 25 },
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: BRANDING.colors.dark,
        minCellHeight: showDualTimezone ? 8 : 5,
      },
      headStyles: {
        fillColor: BRANDING.colors.primary,
        textColor: BRANDING.colors.white,
        fontStyle: "bold",
        halign: "center",
        fontSize: 6,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
    });

    // ===== FOOTER ON ALL PAGES =====
    const pageCount = doc.internal.getNumberOfPages();
    const currentYear = new Date().getFullYear();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      doc.setDrawColor(...BRANDING.colors.light);
      doc.setLineWidth(0.3);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

      // Left: BizBuddy branding
      doc.setTextColor(...BRANDING.colors.dark);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${BRANDING.companyName} | ${BRANDING.tagline}`, 15, pageHeight - 16);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRANDING.colors.light);
      doc.text(`© ${currentYear}`, 15, pageHeight - 12);

      // Center: Requester accountability
      doc.setTextColor(...BRANDING.colors.accent);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(
        `REQUESTED BY: ${userInfo.fullName} | ${userInfo.email}`,
        pageWidth / 2,
        pageHeight - 15,
        { align: "center" }
      );

      doc.setTextColor(...BRANDING.colors.dark);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Generated: ${generatedAt} | TZ: ${getTimezoneName(userTimezone)}`,
        pageWidth / 2,
        pageHeight - 11,
        { align: "center" }
      );

      // Right: Page number
      doc.setTextColor(...BRANDING.colors.light);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 14, {
        align: "right",
      });
    }

    // ===== SAVE THE PDF =====
    let finalFilename = filename;
    if (!finalFilename) {
      finalFilename = `BizBuddy_PunchLogs_${userForFile}_${timestamp}`;
      if (filters.from && filters.to) {
        finalFilename += `_${filters.from.replace(/-/g, '')}-${filters.to.replace(/-/g, '')}`;
      }
      finalFilename += `_${totalRecords}records.pdf`;
    }

    doc.save(finalFilename);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Punch logs PDF export failed:", error);
    throw error;
  }
};

// ==========================================
// GRID / PAYROLL CSV EXPORT (v2 template)
// ==========================================

/**
 * Exports employee punch logs as a DayCare payroll grid CSV.
 * Layout: rows = employees, columns = dates with AM / Regular / PM hour breakdown.
 * Matches the punchLogs_v2.csv template format.
 *
 * @param {Object} params
 * @param {Array}  params.data            - Enriched punch log records (multi-employee)
 * @param {string} params.companyTimezone - Timezone for date parsing (default UTC)
 * @param {Object} params.user            - (Optional) Requester user; fetched if omitted
 * @param {string} params.filename        - (Optional) Custom filename
 */
export const exportEmployeePunchLogsCSV_v2 = async ({
  data,
  companyTimezone = "UTC",
  employeeNameMap = {},
  approvedLeaves = [],
  defaultShiftHours = 8,
  fromDate = null,
  toDate = null,
  user = null,
  filename = null,
}) => {
  if (!data || data.length === 0) throw new Error("No data to export");

  try {
    const userData    = user || await fetchCurrentUser();
    const userForFile = formatUserForFilename(userData);
    const timestamp   = getTimestampForFilename();

    // ── Collect all unique dates (YYYY-MM-DD) across all logs ───────────────
    const dateSet = new Set();
    for (const log of data) {
      const date = log.timeIn
        ? new Date(log.timeIn).toLocaleDateString("en-CA", { timeZone: companyTimezone }) // YYYY-MM-DD
        : null;
      if (date) dateSet.add(date);
    }
    const dates = [...dateSet].sort();

    // ── Sick leave lookup: userId → total SL hours within the report date range ──
    const slHoursByUser = {};
    const rangeStart = fromDate || (dates.length ? dates[0]                : null);
    const rangeEnd   = toDate   || (dates.length ? dates[dates.length - 1] : null);
    if (rangeStart && rangeEnd) {
      for (const leave of approvedLeaves) {
        if (!leave.leaveType?.toLowerCase().includes("sick")) continue;
        const userId = leave.userId || leave.requester?.id || leave.User?.id;
        if (!userId) continue;
        const leaveStart = leave.startDate?.slice(0, 10);
        const leaveEnd   = leave.endDate?.slice(0, 10);
        if (!leaveStart || !leaveEnd) continue;
        const overlapStart = leaveStart > rangeStart ? leaveStart : rangeStart;
        const overlapEnd   = leaveEnd   < rangeEnd   ? leaveEnd   : rangeEnd;
        if (overlapStart > overlapEnd) continue;
        const totalLeaveDays = Math.round((new Date(leaveEnd) - new Date(leaveStart)) / 86400000) + 1;
        const days = Math.round((new Date(overlapEnd) - new Date(overlapStart)) / 86400000) + 1;
        if (days <= 0) continue;
        // Prefer server-computed requestedHours (schedule-based); scale proportionally to the overlap window.
        // requestedHours covers the full leave (e.g. 11h for a 2-day request) — if only 1 day falls in
        // the report range, we take (1/2) × 11 = 5.5h instead of the full 11h.
        const leaveHours = leave.requestedHours != null
          ? parseFloat(leave.requestedHours) * (days / totalLeaveDays)
          : days * defaultShiftHours;
        slHoursByUser[userId] = (slHoursByUser[userId] || 0) + leaveHours;
      }
    }

    // ── Group logs by employee, then by date ─────────────────────────────────
    // employeeMap: { userId → { name, type, byDate: { date → log } } }
    const employeeMap = new Map();
    for (const log of data) {
      const date = log.timeIn
        ? new Date(log.timeIn).toLocaleDateString("en-CA", { timeZone: companyTimezone })
        : null;
      if (!date) continue;

      if (!employeeMap.has(log.userId)) {
        employeeMap.set(log.userId, {
          name:       fmtLastFirst(employeeNameMap, log.userId, log.employeeName),
          code:       log.employeeCode  ?? log.userId,
          role:       log.employeeRole  || "—",
          punchTypes: new Set(),
          byDate:     {},
        });
      }
      const entry = employeeMap.get(log.userId);
      entry.punchTypes.add(log.punchType || "REGULAR");
      entry.byDate[date] = log; // one log per employee per day expected
    }

    // Sort employees alphabetically by Last, First using employeeNameMap when available
    const sortedEmployees = [...employeeMap.entries()].sort((a, b) => {
      const aN = employeeNameMap[a[0]] ?? {};
      const bN = employeeNameMap[b[0]] ?? {};
      const aLast  = (aN.lastName  || "").toLowerCase();
      const bLast  = (bN.lastName  || "").toLowerCase();
      const aFirst = (aN.firstName || "").toLowerCase();
      const bFirst = (bN.firstName || "").toLowerCase();
      if (aLast !== bLast) return aLast.localeCompare(bLast);
      if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
      return (a[1].name || "").localeCompare(b[1].name || "");
    });

    // ── Row 1: date number header — date centered above AM/Regular/PM ──
    const dateRow = ["", "", "", ""];
    for (const date of dates) {
      const dayNum = new Date(date + "T00:00:00").getDate();
      dateRow.push("", dayNum, "");  // blank AM, date above Regular, blank PM
    }
    dateRow.push("Total Hours", "", "", "Driving Hrs", "TR", "SL", "Total", "", "TR - Training");

    // ── Row 2: column label header ────────────────────────────────────────────
    const colRow = ["", "ID", "Name of Employee", "Role"];
    for (let i = 0; i < dates.length; i++) {
      colRow.push("Driver Aide AM", "Regular", "Driver Aide PM");
    }
    colRow.push("Driver Aide AM", "Regular", "Driver Aide PM", "AM + PM", "", "", "", "", "SL - Sick Leave");

    // ── Employee data rows ────────────────────────────────────────────────────
    const dataRows = [];
    const grandTotals = { am: 0, reg: 0, pm: 0, driving: 0, tr: 0, sl: 0 };

    for (const [userId, entry] of sortedEmployees) {
      let totalAM = 0, totalReg = 0, totalPM = 0, totalTR = 0;
      const row = ["", entry.code, entry.name, entry.role];

      for (const date of dates) {
        const log = entry.byDate[date];
        if (!log) {
          row.push("", "", "");
          continue;
        }
        const isTraining = log.punchType === "TRAINING";
        const isAnyDA = ["DRIVER_AIDE", "DRIVER_AIDE_AM", "DRIVER_AIDE_PM"].includes(log.punchType);
        const amH  = isAnyDA && log.daAMHours      != null ? parseFloat(log.daAMHours)      : 0;
        const regH = isAnyDA && log.daRegularHours  != null
          ? parseFloat(log.daRegularHours)
          : isTraining ? 0 : parseFloat(log.duration) || 0;
        const pmH  = isAnyDA && log.daPMHours      != null ? parseFloat(log.daPMHours)      : 0;
        const trH  = isTraining ? parseFloat(log.duration) || 0 : 0;
        totalAM  += amH;
        totalReg += regH;
        totalPM  += pmH;
        totalTR  += trH;
        // Training hours displayed under Regular column per day (no per-day TR slot in grid)
        const cellReg = isTraining ? trH : regH;
        row.push(
          amH      > 0 ? amH.toFixed(2)      : "",
          cellReg  > 0 ? cellReg.toFixed(2)  : "",
          pmH      > 0 ? pmH.toFixed(2)      : ""
        );
      }

      const slHours     = slHoursByUser[userId] || 0;
      const totalDriving = totalAM + totalPM;
      const rowTotal    = totalAM + totalReg + totalPM + totalTR;
      row.push(
        totalAM      > 0 ? totalAM.toFixed(2)      : "",
        totalReg     > 0 ? totalReg.toFixed(2)     : "",
        totalPM      > 0 ? totalPM.toFixed(2)      : "",
        totalDriving > 0 ? totalDriving.toFixed(2) : "",
        totalTR      > 0 ? totalTR.toFixed(2)      : "",
        slHours      > 0 ? slHours.toFixed(2)      : "",
        rowTotal     > 0 ? rowTotal.toFixed(2)     : ""
      );

      dataRows.push(row);
      grandTotals.am      += totalAM;
      grandTotals.reg     += totalReg;
      grandTotals.pm      += totalPM;
      grandTotals.driving += totalDriving;
      grandTotals.tr      += totalTR;
      grandTotals.sl      += slHours;
    }

    // ── Total row ─────────────────────────────────────────────────────────────
    const totalRow = ["Total", "", "", ""];
    for (let i = 0; i < dates.length; i++) totalRow.push("", "", "");
    const grandTotal = grandTotals.am + grandTotals.reg + grandTotals.pm + grandTotals.tr;
    totalRow.push(
      grandTotals.am      > 0 ? grandTotals.am.toFixed(2)      : "",
      grandTotals.reg     > 0 ? grandTotals.reg.toFixed(2)     : "",
      grandTotals.pm      > 0 ? grandTotals.pm.toFixed(2)      : "",
      grandTotals.driving > 0 ? grandTotals.driving.toFixed(2) : "",
      grandTotals.tr      > 0 ? grandTotals.tr.toFixed(2)      : "",
      grandTotals.sl      > 0 ? grandTotals.sl.toFixed(2)      : "",
      grandTotal > 0 ? grandTotal.toFixed(2) : ""
    );

    // ── Remarks section ───────────────────────────────────────────────────────
    const remarksRows = [
      [""],
      [""],
      ["", "", "Remarks", "Color"],
      ["", "", "Aide",          "Blue"],
      ["", "", "Driver",        "Red"],
      ["", "", "Program Hours", "Black"],
      ["", "", "Absent",        "Orange"],
      ["", "", "Holiday",       "Yellow"],
    ];

    // ── Assemble & download ───────────────────────────────────────────────────
    const allRows = [dateRow, colRow, ...dataRows, totalRow, ...remarksRows];
    const csvContent = allRows.map((row) => row.map(wrapCSV).join(",")).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href  = url;
    const finalFilename = filename || `BizBuddy_EmployeePunchLogs_Grid_${userForFile}_${timestamp}.csv`;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Employee grid CSV export failed:", error);
    throw error;
  }
};
