// lib/exports/employees.js
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
// EMPLOYEES EXPORT FUNCTIONS
// ==========================================

/**
 * Exports employees data as CSV with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of employee records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportEmployeesCSV = async ({
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

    // Calculate summary statistics
    const totalEmployees = data.length;
    const activeEmployees = data.filter(e =>
      e.employmentStatus === "full_time" || e.employmentStatus === "part_time"
    ).length;
    const roleBreakdown = data.reduce((acc, e) => {
      acc[e.role] = (acc[e.role] || 0) + 1;
      return acc;
    }, {});

    // ===== BUILD HEADER =====
    const headerRows = [
      [`${BRANDING.companyName.toUpperCase()} - COMPANY EMPLOYEES REPORT`],
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

    // ===== SUMMARY STATISTICS =====
    const summaryRows = [
      ["SUMMARY STATISTICS"],
      [""],
      ["Total Employees:", totalEmployees],
      ["Active Employees:", activeEmployees],
      [""],
      ["BY ROLE"],
      ...Object.entries(roleBreakdown).map(([role, count]) => [
        `${role.charAt(0).toUpperCase() + role.slice(1)}:`,
        count
      ]),
      [""],
      [""],
    ];

    // ===== ACCOUNTABILITY NOTICE =====
    const accountabilityRows = [
      ["ACCOUNTABILITY NOTICE"],
      ["This report contains employee data and should be handled with care."],
      ["The requester information above is recorded for audit and compliance purposes."],
      ["Unauthorized use or distribution of this report may violate company policies."],
      [""],
      [""],
    ];

    // ===== TABLE HEADER =====
    const tableHeaderRows = [
      ["EMPLOYEES DETAIL"],
      [""],
    ];

    // Filter columns to only visible ones
    const tableHeader = visibleColumns.map(col => columnMap[col] || col);

    // ===== TABLE DATA ROWS =====
    const tableRows = data.map((record) => {
      return visibleColumns.map((col) => {
        const value = record[col];

        // Format dates
        if (col === "hireDate" || col === "probationEndDate") {
          return value
            ? new Date(value).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";
        }

        if (col === "createdAt" || col === "updatedAt") {
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

        // Handle special columns
        if (col === "name") {
          return record.fullName || "—";
        }

        if (col === "department") {
          return record.departmentName || "—";
        }

        if (col === "supervisor") {
          return record.supervisorEmail || "—";
        }

        if (col === "employeeId") {
          return record.employmentDetail?.employeeId || "—";
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
      ...summaryRows.map((row) => row.map(wrapCSV)),
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
    const finalFilename = filename || `BizBuddy_Employees_${userForFile}_${timestamp}.csv`;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Employees CSV export failed:", error);
    throw error;
  }
};

/**
 * Exports employees data as professional PDF with requester accountability
 * @param {Object} params - Export parameters
 * @param {Array} params.data - Array of employee records to export
 * @param {Array} params.visibleColumns - Array of column keys to include in export
 * @param {Object} params.columnMap - Map of column keys to display labels
 * @param {Object} params.user - (Optional) User object, if not provided, will fetch from API
 * @param {string} params.filename - (Optional) Custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportEmployeesPDF = async ({
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

    // Calculate summary statistics
    const totalEmployees = data.length;
    const activeEmployees = data.filter(e =>
      e.employmentStatus === "full_time" || e.employmentStatus === "part_time"
    ).length;
    const roleBreakdown = data.reduce((acc, e) => {
      acc[e.role] = (acc[e.role] || 0) + 1;
      return acc;
    }, {});

    // ===== HEADER SECTION =====
    let yPos = 15;

    // Draw the BizBuddy logo
    await drawBizBuddyLogo(doc, 15, yPos);

    // Title
    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("COMPANY EMPLOYEES REPORT", pageWidth / 2, yPos + 6, { align: "center" });

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

    // ===== SUMMARY STATISTICS BOX =====
    yPos += 8;

    doc.setFillColor(240, 249, 255); // Light blue background
    doc.roundedRect(15, yPos, pageWidth - 30, 20, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("SUMMARY STATISTICS", 20, yPos + 5);

    yPos += 10;
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(8);

    const col1X = 20;
    const col2X = pageWidth / 3;
    const col3X = (pageWidth / 3) * 2;

    // Total & Active
    doc.setFont("helvetica", "bold");
    doc.text("Total Employees:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(totalEmployees.toString(), col1X + 35, yPos);

    doc.setFont("helvetica", "bold");
    doc.text("Active Employees:", col2X, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(activeEmployees.toString(), col2X + 35, yPos);

    // Role breakdown
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("By Role:", col1X, yPos);
    doc.setFont("helvetica", "normal");
    const roleText = Object.entries(roleBreakdown)
      .map(([role, count]) => `${role.charAt(0).toUpperCase() + role.slice(1)} (${count})`)
      .join(", ");
    doc.text(roleText, col1X + 20, yPos);

    // ===== ACCOUNTABILITY NOTICE =====
    yPos += 10;
    doc.setFillColor(255, 243, 224); // Light orange background
    doc.roundedRect(15, yPos, pageWidth - 30, 15, 2, 2, "F");

    doc.setTextColor(...BRANDING.colors.accent);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ACCOUNTABILITY NOTICE", 20, yPos + 4);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      "This report contains employee data. The requester information is recorded for audit and compliance purposes.",
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

    // Filter columns to only visible ones
    const tableHeaders = visibleColumns.map(col => columnMap[col] || col);

    const tableData = data.map((record) => {
      return visibleColumns.map((col) => {
        // Format dates
        if (col === "hireDate" || col === "probationEndDate") {
          return record[col]
            ? new Date(record[col]).toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : "—";
        }

        if (col === "createdAt" || col === "updatedAt") {
          return record[col]
            ? new Date(record[col]).toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : "—";
        }

        // Handle special columns
        if (col === "name") {
          return record.fullName || "—";
        }

        if (col === "department") {
          return record.departmentName || "—";
        }

        if (col === "supervisor") {
          return record.supervisorEmail || "—";
        }

        if (col === "employeeId") {
          return record.employmentDetail?.employeeId || "—";
        }

        // Return value or placeholder
        return record[col] ?? "—";
      });
    });

    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: yPos,
      margin: { left: 15, right: 15, bottom: 25 },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: BRANDING.colors.dark,
        minCellHeight: 7, // Minimum cell height
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
        // Auto-width based on content
      },
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      tableLineWidth: 0.1,
      tableLineColor: [200, 200, 200],
      // Adjust page break threshold to prevent orphan rows
      pageBreak: 'auto',
      // Ensure at least 3 rows per page (except last page)
      didDrawPage: function(data) {
        // This just ensures proper spacing, no complex logic needed
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
    const finalFilename = filename || `BizBuddy_Employees_${userForFile}_${timestamp}.pdf`;
    doc.save(finalFilename);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Employees PDF export failed:", error);
    throw error;
  }
};
