// lib/exports/contestLogs.js
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

// ==========================================
// CONTEST TIME LOGS EXPORT FUNCTIONS
// ==========================================

/**
 * Exports contest time logs data as CSV with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of contest log records to export
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportContestLogsCSV = async ({
  data,
  user = null,
  filename = null
}) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  try {
    // Fetch user data if not provided
    const userData = user || await fetchCurrentUser();

    const userInfo = extractUserInfo(userData);
    const generatedAt = getFormattedTimestamp();
    const userForFile = formatUserForFilename(userData);
    const timestamp = getTimestampForFilename();

    // ===== BUILD HEADER =====
    const headerRows = [
      [`${BRANDING.companyName.toUpperCase()} - CONTEST TIME LOGS REPORT`],
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

    // ===== ACCOUNTABILITY NOTICE =====
    const accountabilityRows = [
      ["ACCOUNTABILITY NOTICE"],
      ["This report contains time correction requests and should be handled with care."],
      ["The requester information above is recorded for audit and compliance purposes."],
      ["Unauthorized use or distribution of this report may violate company policies."],
      [""],
      [""],
    ];

    // ===== TABLE HEADER =====
    const tableHeaderRows = [
      ["CONTEST TIME LOGS DETAIL"],
      [""],
    ];

    const tableHeader = [
      "Contest ID",
      "Time Log ID",
      "Contest Date",
      "Original Clock In",
      "Original Clock Out",
      "Requested Clock In",
      "Requested Clock Out",
      "Status",
      "Reason",
      "Description",
      "Approver",
      "Submitted At",
      "Reviewed At",
    ];

    // ===== TABLE DATA ROWS =====
    const tableRows = data.map((log) => [
      log.id || "—",
      log.timeLogId || "—",
      log.requestedClockIn
        ? new Date(log.requestedClockIn).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—",
      log.currentClockIn
        ? new Date(log.currentClockIn).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.currentClockOut
        ? new Date(log.currentClockOut).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.requestedClockIn
        ? new Date(log.requestedClockIn).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.requestedClockOut
        ? new Date(log.requestedClockOut).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.status || "—",
      log.reason || "—",
      log.description || "—",
      log.approverName || "—",
      log.createdAt
        ? new Date(log.createdAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.reviewedAt
        ? new Date(log.reviewedAt).toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
    ]);

    // ===== FOOTER =====
    const footerRows = [
      [""],
      [""],
      ["REQUESTER ACCOUNTABILITY"],
      [`Requested by: ${userInfo.fullName} (${userInfo.email})`],
      [`Generated: ${generatedAt}`],
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
    const finalFilename = filename || `BizBuddy_ContestLogs_${userForFile}_${timestamp}.csv`;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Contest logs CSV export failed:", error);
    throw error;
  }
};

/**
 * Exports contest time logs data as professional PDF with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of contest log records to export
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportContestLogsPDF = async ({
  data,
  user = null,
  filename = null
}) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
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

    // ===== HEADER SECTION =====
    let yPos = 15;

    // Draw the BizBuddy logo
    await drawBizBuddyLogo(doc, 15, yPos);

    // Title
    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("CONTEST TIME LOGS REPORT", pageWidth / 2, yPos + 6, { align: "center" });

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Time Correction Requests Management", pageWidth / 2, yPos + 11, { align: "center" });

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

    // ===== REQUESTER INFO SECTION =====
    yPos += 6;
    doc.setFillColor(...BRANDING.colors.primaryLight);
    doc.roundedRect(15, yPos, pageWidth - 30, 24, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("REPORT REQUESTER INFORMATION", 20, yPos + 5);

    yPos += 9;
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Company:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.companyName, 50, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Requester:", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${userInfo.fullName} (${userInfo.username})`, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Email:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.email, 50, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("User ID:", pageWidth / 2 + 10, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.userId, pageWidth / 2 + 35, yPos);

    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Generated:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(generatedAt, 50, yPos);

    // ===== ACCOUNTABILITY NOTICE =====
    yPos += 8;
    doc.setFillColor(255, 243, 224); // Light orange background
    doc.roundedRect(15, yPos, pageWidth - 30, 15, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.accent);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("⚠ ACCOUNTABILITY NOTICE", 20, yPos + 4);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      "This report contains time correction requests. The requester information is recorded for audit and compliance purposes.",
      20,
      yPos + 8
    );
    doc.text(
      "Unauthorized use or distribution may violate company policies. Handle with appropriate confidentiality.",
      20,
      yPos + 11.5
    );

    // ===== TABLE SECTION =====
    yPos += 20;

    const tableHeaders = [
      "Contest ID",
      "Log ID",
      "Date",
      "Original In",
      "Original Out",
      "Requested In",
      "Requested Out",
      "Status",
      "Reason",
    ];

    const tableData = data.map((log) => [
      log.id || "—",
      log.timeLogId || "—",
      log.requestedClockIn
        ? new Date(log.requestedClockIn).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "—",
      log.currentClockIn
        ? new Date(log.currentClockIn).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.currentClockOut
        ? new Date(log.currentClockOut).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.requestedClockIn
        ? new Date(log.requestedClockIn).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.requestedClockOut
        ? new Date(log.requestedClockOut).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
      log.status || "—",
      (log.reason || "—").substring(0, 20) + (log.reason?.length > 20 ? "..." : ""),
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      margin: { left: 15, right: 15 },
      styles: {
        fontSize: 7,
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
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: "center" }, // Contest ID
        1: { cellWidth: 20, halign: "center" }, // Log ID
        2: { cellWidth: 22, halign: "center" }, // Date
        3: { cellWidth: 25, halign: "center" }, // Original In
        4: { cellWidth: 25, halign: "center" }, // Original Out
        5: { cellWidth: 25, halign: "center" }, // Requested In
        6: { cellWidth: 25, halign: "center" }, // Requested Out
        7: { cellWidth: 22, halign: "center" }, // Status
        8: { cellWidth: 35, halign: "left" },   // Reason
      },
      didDrawCell: (data) => {
        // Highlight status column based on value
        if (data.column.index === 7 && data.row.index >= 0) {
          const status = data.cell.text[0]?.toLowerCase();
          if (status === "approved") {
            doc.setTextColor(22, 163, 74); // Green
            doc.setFont("helvetica", "bold");
          } else if (status === "rejected") {
            doc.setTextColor(220, 38, 38); // Red
            doc.setFont("helvetica", "bold");
          } else if (status === "pending") {
            doc.setTextColor(234, 179, 8); // Yellow
            doc.setFont("helvetica", "bold");
          }
        }
      },
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
        `Generated: ${generatedAt}`,
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
    const finalFilename = filename || `BizBuddy_ContestLogs_${userForFile}_${timestamp}.pdf`;
    doc.save(finalFilename);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Contest logs PDF export failed:", error);
    throw error;
  }
};
