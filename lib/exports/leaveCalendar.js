// lib/exports/leaveCalendar.js
import {
  BRANDING,
  fetchCurrentUser,
  extractUserInfo,
  drawBizBuddyLogo,
  formatUserForFilename,
  getTimestampForFilename,
  getFormattedTimestamp,
  jsPDF,
} from "./_shared.js";

// pending_secondary shares "Pending"'s color — the calendar's status filter
// already merges the two into one "Pending" checkbox, so the grid shouldn't
// draw a distinction the caller didn't offer.
const STATUS_COLORS = {
  pending: [251, 191, 36], // amber-400
  pending_secondary: [251, 191, 36],
  approved: [34, 197, 94], // green-500
  rejected: [248, 113, 113], // red-400
  cancelled: [163, 163, 163], // neutral-400
};

const STATUS_TEXT_COLORS = {
  pending: [55, 65, 81],
  pending_secondary: [55, 65, 81],
  approved: [255, 255, 255],
  rejected: [255, 255, 255],
  cancelled: [255, 255, 255],
};

const LEGEND = [
  { color: STATUS_COLORS.pending, label: "Pending" },
  { color: STATUS_COLORS.approved, label: "Approved" },
  { color: STATUS_COLORS.rejected, label: "Rejected" },
  { color: STATUS_COLORS.cancelled, label: "Cancelled" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse a date string to a local-midnight Date to avoid UTC shifts */
function toLocalDate(dateStr) {
  const s = String(dateStr).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Jhenelle Villanueva" -> "Jhenelle V." — kept short enough to fit a day cell */
function abbreviateName(name) {
  const parts = String(name || "Unknown").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Unknown";
  if (parts.length === 1) return parts[0].length > 14 ? `${parts[0].slice(0, 13)}…` : parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
  const abbrev = `${first} ${lastInitial}.`;
  return abbrev.length > 16 ? `${first.slice(0, 12)}… ${lastInitial}.` : abbrev;
}

/** Truncates text with an ellipsis until it measures within maxWidthMm at the doc's current font/size. */
function fitText(doc, text, maxWidthMm) {
  if (doc.getTextWidth(text) <= maxWidthMm) return text;
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}…`) > maxWidthMm) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * Builds a { dayNumber: [{ name, status }] } map, clipped to the given month.
 * `data` is expected pre-sorted (oldest submission first) by the caller, so
 * whoever submitted first ends up first in each day's list — same ordering
 * rule as the live Calendar view's day panel.
 */
function buildDayMap(data, monthStart, monthEnd) {
  const map = {};
  data.forEach((l) => {
    if (!l.startDate) return;
    const s = toLocalDate(l.startDate);
    const e = toLocalDate(l.endDate || l.startDate);
    const cur = new Date(Math.max(s.getTime(), monthStart.getTime()));
    const stop = new Date(Math.min(e.getTime(), monthEnd.getTime()));
    if (cur > stop) return;
    const req = l.requester || l.User;
    const name = req?.name || [req?.profile?.firstName, req?.profile?.lastName].filter(Boolean).join(" ") || req?.email || "Unknown";
    while (cur <= stop) {
      const day = cur.getDate();
      if (!map[day]) map[day] = [];
      map[day].push({ name, status: l.status });
      cur.setDate(cur.getDate() + 1);
    }
  });
  return map;
}

/** Builds the week grid for a month: array of 7-slot weeks, null = padding */
function buildWeeks(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const weeks = [];
  let week = new Array(firstDayOfWeek).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

/**
 * Exports a visual month-grid PDF of leave requests — a calendar layout
 * (day cells with colored name chips), not a table, for the leave-requests
 * Calendar view's "Generate PDF" button.
 * @param {Object} params
 * @param {Array} params.data - Leave records overlapping the month (caller applies status filtering)
 * @param {Date} params.month - First-of-month Date identifying which month to render
 * @param {Object} params.user - (Optional) admin generating the report; fetched if not provided
 * @param {string} params.filename - (Optional) custom filename
 * @returns {Object} Result object with success flag and filename
 */
export const exportLeaveCalendarPDF = async ({ data, month, user = null, filename = null }) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export");
  }

  try {
    const userData = user || await fetchCurrentUser();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    const userInfo = extractUserInfo(userData);
    const generatedAt = getFormattedTimestamp();
    const userForFile = formatUserForFilename(userData);
    const timestamp = getTimestampForFilename();
    const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // ===== HEADER SECTION =====
    let yPos = 15;
    await drawBizBuddyLogo(doc, margin, yPos);

    doc.setTextColor(...BRANDING.colors.primary);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("LEAVE CALENDAR", pageWidth / 2, yPos + 6, { align: "center" });

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(BRANDING.tagline, pageWidth / 2, yPos + 11, { align: "center" });

    doc.setTextColor(...BRANDING.colors.light);
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedAt}`, pageWidth - margin, yPos + 3, { align: "right" });

    yPos += 18;
    doc.setDrawColor(...BRANDING.colors.primary);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    // ===== REPORT INFORMATION SECTION (condensed — grid needs the vertical room) =====
    yPos += 6;
    doc.setFillColor(...BRANDING.colors.primaryLight);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 14, 2, 2, "F");

    const col2X = pageWidth / 2;
    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Company:", margin + 5, yPos + 5);
    doc.setFont("helvetica", "normal");
    doc.text(userInfo.companyName, margin + 28, yPos + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Month:", col2X, yPos + 5);
    doc.setFont("helvetica", "normal");
    doc.text(monthLabel, col2X + 18, yPos + 5);

    doc.setFont("helvetica", "bold");
    doc.text("Generated By:", margin + 5, yPos + 10);
    doc.setFont("helvetica", "normal");
    doc.text(`${userInfo.fullName} | ${userInfo.username}`, margin + 28, yPos + 10);

    doc.setFont("helvetica", "bold");
    doc.text("Total Records:", col2X, yPos + 10);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.length), col2X + 28, yPos + 10);

    yPos += 14 + 4;

    // ===== LEGEND =====
    let legendX = margin;
    doc.setFontSize(8);
    LEGEND.forEach(({ color, label }) => {
      doc.setFillColor(...color);
      doc.roundedRect(legendX, yPos - 2.8, 3, 3, 0.5, 0.5, "F");
      doc.setTextColor(...BRANDING.colors.dark);
      doc.setFont("helvetica", "normal");
      doc.text(label, legendX + 4.5, yPos);
      legendX += 4.5 + doc.getTextWidth(label) + 6;
    });
    yPos += 5;

    // ===== DAY-OF-WEEK HEADER ROW =====
    const cellWidth = (pageWidth - margin * 2) / 7;
    const dayHeaderHeight = 7;
    doc.setFillColor(...BRANDING.colors.primary);
    doc.rect(margin, yPos, pageWidth - margin * 2, dayHeaderHeight, "F");
    doc.setTextColor(...BRANDING.colors.white);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    DAY_LABELS.forEach((label, i) => {
      doc.text(label, margin + i * cellWidth + cellWidth / 2, yPos + dayHeaderHeight - 2.3, { align: "center" });
    });
    yPos += dayHeaderHeight;

    // ===== CALENDAR GRID =====
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const weeks = buildWeeks(year, monthIndex);
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const dayMap = buildDayMap(data, monthStart, monthEnd);

    const footerReserve = 18;
    const gridTop = yPos;
    const gridBottom = pageHeight - footerReserve;
    const rowHeight = (gridBottom - gridTop) / weeks.length;

    weeks.forEach((week, r) => {
      const cellY = gridTop + r * rowHeight;
      week.forEach((dayNum, c) => {
        const cellX = margin + c * cellWidth;

        if (dayNum == null) {
          doc.setFillColor(248, 250, 252);
          doc.rect(cellX, cellY, cellWidth, rowHeight, "F");
          doc.setDrawColor(...BRANDING.colors.light);
          doc.setLineWidth(0.2);
          doc.rect(cellX, cellY, cellWidth, rowHeight);
          return;
        }

        doc.setDrawColor(...BRANDING.colors.light);
        doc.setLineWidth(0.2);
        doc.rect(cellX, cellY, cellWidth, rowHeight);

        doc.setTextColor(...BRANDING.colors.dark);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(String(dayNum), cellX + 2, cellY + 4.5);

        const entries = dayMap[dayNum] || [];
        if (entries.length === 0) return;

        // Two-column chip grid once there's enough entries to need the density;
        // under 3, a single full-width column reads better. Fills left-to-right,
        // top-to-bottom, so reading order still matches submission order (oldest first).
        const numCols = entries.length < 3 ? 1 : 2;
        const colGap = 1;
        const chipWidth = (cellWidth - 3 - colGap) / numCols;
        const chipHeight = 3.4;
        const chipGap = 0.6;
        const chipStartY = cellY + 6;
        const availableHeight = rowHeight - 6 - 1;
        const maxRows = Math.max(0, Math.floor(availableHeight / (chipHeight + chipGap)));
        const maxChips = maxRows * numCols;
        if (maxChips === 0) return;

        const chipPos = (i) => {
          const col = i % numCols;
          const row = Math.floor(i / numCols);
          return {
            x: cellX + 1.5 + col * (chipWidth + colGap),
            y: chipStartY + row * (chipHeight + chipGap),
          };
        };

        const showCount = entries.length <= maxChips ? entries.length : Math.max(0, maxChips - 1);
        for (let i = 0; i < showCount; i++) {
          const entry = entries[i];
          const fill = STATUS_COLORS[entry.status] || STATUS_COLORS.cancelled;
          const textColor = STATUS_TEXT_COLORS[entry.status] || [255, 255, 255];
          const { x: chipX, y: chipY } = chipPos(i);
          doc.setFillColor(...fill);
          doc.roundedRect(chipX, chipY, chipWidth, chipHeight, 0.6, 0.6, "F");
          doc.setTextColor(...textColor);
          doc.setFontSize(6);
          doc.setFont("helvetica", "normal");
          doc.text(fitText(doc, abbreviateName(entry.name), chipWidth - 1.2), chipX + 0.7, chipY + chipHeight - 0.9);
        }

        if (entries.length > showCount) {
          const hiddenCount = entries.length - showCount;
          const { x: moreX, y: moreY } = chipPos(showCount);
          doc.setTextColor(...BRANDING.colors.light);
          doc.setFontSize(6);
          doc.setFont("helvetica", "italic");
          doc.text(`+${hiddenCount} more`, moreX + 0.7, moreY + chipHeight - 0.9);
        }
      });
    });

    // ===== FOOTER =====
    const currentYear = new Date().getFullYear();
    doc.setDrawColor(...BRANDING.colors.light);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`${BRANDING.companyName} | ${BRANDING.tagline}`, margin, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRANDING.colors.light);
    doc.text(`© ${currentYear}`, margin, pageHeight - 7);

    doc.setTextColor(...BRANDING.colors.dark);
    doc.setFontSize(7);
    doc.text(`Requestor: ${userInfo.fullName} | ${userInfo.email}`, pageWidth / 2, pageHeight - 9, { align: "center" });

    // ===== SAVE =====
    const finalFilename = filename || `BizBuddy_LeaveCalendar_${userForFile}_${timestamp}.pdf`;
    doc.save(finalFilename);

    return { success: true, filename: finalFilename };
  } catch (error) {
    console.error("❌ Leave calendar PDF export failed:", error);
    throw error;
  }
};
