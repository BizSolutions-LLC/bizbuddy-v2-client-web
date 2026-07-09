// lib/exports/deletionRequests.js
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
// DELETION REQUESTS EXPORT FUNCTIONS
// ==========================================

/**
 * Exports deletion requests data as CSV with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of deletion request records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportDeletionRequestsCSV = async ({
  data,
  visibleColumns,
  columnMap,
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

    // ===== BUILD HEADER =====
    const headerRows = [
      [`${BRANDING.companyName.toUpperCase()} - EMPLOYEE ACCOUNT DELETION REQUESTS`],
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
      ["This report contains sensitive employee data and should be handled with care."],
      ["The requester information above is recorded for audit and compliance purposes."],
      ["Unauthorized use or distribution of this report may violate company policies."],
      [""],
      [""],
    ];

    // ===== TABLE HEADER =====
    const tableHeaderRows = [
      ["DELETION REQUESTS DETAIL"],
      [""],
    ];

    // Filter columns to only visible ones (excluding 'actions')
    const exportColumns = visibleColumns.filter(col => col !== "actions");
    const tableHeader = exportColumns.map(col => columnMap[col] || col);

    // ===== TABLE DATA ROWS =====
    const tableRows = data.map((record) => {
      return exportColumns.map((col) => {
        const value = record[col];

        // Format dates
        if (col.includes("At") || col.includes("Date")) {
          return value
            ? new Date(value).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—";
        }

        // Return value or placeholder
        return value ?? "—";
      });
    });

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
    const finalFilename = filename || `BizBuddy_DeletionRequests_${userForFile}_${timestamp}.csv`;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Deletion requests CSV export failed:", error);
    throw error;
  }
};

/**
 * Exports deletion requests data as professional PDF with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of deletion request records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportDeletionRequestsPDF = async ({
  data,
  visibleColumns,
  columnMap,
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

    // ===== HEADER SECTION =====
    let yPos = 15;

    // Draw the BizBuddy logo
    await drawBizBuddyLogo(doc, 15, yPos);

    // Title
    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE ACCOUNT DELETION REQUESTS", pageWidth / 2, yPos + 6, { align: "center" });

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Human Resources Management System", pageWidth / 2, yPos + 11, { align: "center" });

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
      "This report contains sensitive employee data. The requester information is recorded for audit and compliance purposes.",
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

    // Filter columns to only visible ones (excluding 'actions')
    const exportColumns = visibleColumns.filter(col => col !== "actions");
    const tableHeaders = exportColumns.map(col => columnMap[col] || col);

    const tableData = data.map((record) => {
      return exportColumns.map((col) => {
        const value = record[col];

        // Format dates
        if (col.includes("At") || col.includes("Date")) {
          return value
            ? new Date(value).toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—";
        }

        // Return value or placeholder
        return value ?? "—";
      });
    });

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
        // Auto-width for all columns
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
    const finalFilename = filename || `BizBuddy_DeletionRequests_${userForFile}_${timestamp}.pdf`;
    doc.save(finalFilename);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Deletion requests PDF export failed:", error);
    throw error;
  }
};
