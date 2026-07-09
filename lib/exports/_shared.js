// utils/exportUtils.js
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import useAuthStore from "@/store/useAuthStore";
import { jwtDecode } from "jwt-decode";

const BRANDING = {
  companyName: "BizBuddy",
  tagline: "Time Keeping Application",
  logoUrl: "https://mybizbuddy.co/logo.png",
  colors: {
    primary: [249, 115, 22], // Orange #f97316
    primaryLight: [255, 237, 213], // Light Orange #ffedd5
    accent: [220, 38, 38], // Red accent from logo
    dark: [55, 65, 81], // Dark gray #374151
    light: [156, 163, 175], // Light gray #9ca3af
    white: [255, 255, 255],
  },
};

let cachedUserData = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Fetches current user data using userId and companyId from JWT
 * @returns {Promise<Object>} Complete user data object
 */
const fetchCurrentUser = async () => {
  // Check if cache is still valid
  const now = Date.now();
  try {
    // Get token from Zustand store
    const authState = useAuthStore.getState();
    const token = authState.token;

    let decoded;
    try {
      decoded = jwtDecode(token);
      // console.log("✅ JWT decoded:", decoded);
    } catch (decodeError) {
      // console.error("❌ JWT decode error:", decodeError);
      return getFallbackUserData();
    }

    if (!decoded.userId || !decoded.companyId) {
      // console.warn("⚠️ No userId or companyId in JWT");
      return getFallbackUserData();
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL;

    // Simple API call with userId and companyId
    const response = await fetch(
      `${API_URL}/api/account/user-export-data?userId=${decoded.userId}&companyId=${decoded.companyId}`
    );

    if (!response.ok) {
      console.warn(`⚠️ API call failed with status ${response.status}`);
      return getFallbackUserData();
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      console.warn("⚠️ Invalid API response");
      return getFallbackUserData();
    }

    // Cache the user data
    cachedUserData = result.data;
    lastFetchTime = now;

    return cachedUserData;
  } catch (error) {
    console.error("❌ Error fetching user data:", error.message);
    return getFallbackUserData();
  }
};

/**
 * Returns fallback user data when API call fails
 * Tries to extract from Zustand auth store first
 * @returns {Object} Minimal user data structure
 */
const getFallbackUserData = () => {
    const { user } = useAuthStore.getState();

  if (user) {
    const fullName =
      user.fullName ||
      (user.profile?.firstName && user.profile?.lastName
        ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
        : null) ||
      (user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`.trim()
        : null) ||
      user.username ||
      user.email?.split("@")[0] ||
      "Employee";

    return {
      id: user.id || "",
      username: user.username || user.email?.split("@")[0] || "employee",
      email: user.email || "",
      fullName: fullName,
      profile: {
        firstName: user.profile?.firstName || user.firstName || "",
        lastName: user.profile?.lastName || user.lastName || "",
      },
      company: {
        name: user.company?.name || "Company",
      },
    };
  }

  console.warn("⚠️ No user data in auth store - using minimal fallback");
  return {
    id: "",
    username: "employee",
    email: "",
    fullName: "Employee",
    profile: {
      firstName: "",
      lastName: "",
    },
    company: {
      name: "Company",
    },
  };
};

/**
 * Clears the cached user data (useful after profile updates)
 */
export const clearUserCache = () => {
  cachedUserData = null;
  lastFetchTime = null;
};

// ==========================================
// USER IDENTIFICATION UTILITIES
// ==========================================

/**
 * Extracts user information from various possible object structures
 * @param {Object} user - User object (can be from /me endpoint or fallback)
 * @returns {Object} Normalized user info
 */
const extractUserInfo = (user) => {
  if (!user) {
    console.warn("extractUserInfo: No user object provided");
    return {
      firstName: "",
      lastName: "",
      fullName: "Unknown User",
      username: "",
      email: "",
      userId: "",
      companyName: "Company",
    };
  }

  const firstName =
    user.profile?.firstName ||
    user.firstName ||
    user.Profile?.firstName ||
    user.first_name ||
    "";

  const lastName =
    user.profile?.lastName ||
    user.lastName ||
    user.Profile?.lastName ||
    user.last_name ||
    "";

  const fullName = user.fullName || `${firstName} ${lastName}`.trim();

  const username =
    user.username ||
    user.userName ||
    user.Username ||
    user.profile?.username ||
    user.Profile?.username ||
    user.user_name ||
    "";

  const email =
    user.email ||
    user.Email ||
    user.profile?.email ||
    user.Profile?.email ||
    user.emailAddress ||
    "";

  const userId =
    user.id ||
    user.userId ||
    user.ID ||
    user.user_id ||
    user.profile?.id ||
    "";

  const companyName =
    user.company?.name ||
    user.Company?.name ||
    user.companyName ||
    user.company_name ||
    "Company";

  let displayName = "Unknown User";
  if (fullName && fullName !== "") {
    displayName = fullName;
  } else if (username && username !== "") {
    displayName = username;
  } else if (email && email !== "") {
    displayName = email.split("@")[0];
  }

  const userInfo = {
    firstName,
    lastName,
    fullName: displayName,
    username: username || email.split("@")[0] || "user",
    email: email || "N/A",
    userId: userId || "N/A",
    companyName,
  };

  return userInfo;
};

/**
 * Formats a user's name for file naming (removes spaces, special chars)
 */
export const formatUserForFilename = (user) => {
  const userInfo = extractUserInfo(user);

  let identifier = userInfo.fullName;
  if (!identifier || identifier === "Unknown User") {
    identifier = userInfo.username || "User";
  }

  const cleaned = identifier
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return cleaned || "User";
};

/**
 * Generates a timestamp string for filenames
 */
export const getTimestampForFilename = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}_${hours}-${minutes}`;
};

/**
 * Formats timestamp for display in reports
 */
export const getFormattedTimestamp = () => {
  return new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
};

/**
 * Calculate summary statistics from punch logs data
 */
const calculateSummaryStats = (data) => {
  const totalHours = data
    .reduce((sum, log) => sum + (parseFloat(log.duration) || 0), 0)
    .toFixed(2);

  const totalOT = data
    .reduce((sum, log) => sum + (parseFloat(log.otHours) || 0), 0)
    .toFixed(2);

  const totalCoffeeBreak = data
    .reduce((sum, log) => sum + (parseFloat(log.coffeeMins) || 0), 0)
    .toFixed(2);

  const totalLunchBreak = data
    .reduce((sum, log) => sum + (parseFloat(log.lunchMins) || 0), 0)
    .toFixed(2);

  const totalLateHours = data
    .reduce((sum, log) => sum + (parseFloat(log.lateHours) || 0), 0)
    .toFixed(2);

  const activeCount = data.filter((log) => log.status).length;
  const completedCount = data.filter((log) => !log.status).length;

  return {
    totalRecords: data.length,
    totalHours,
    totalOT,
    totalCoffeeBreak,
    totalLunchBreak,
    totalLateHours,
    activeCount,
    completedCount,
  };
};

/**
 * Helper to wrap CSV values with quotes and escape internal quotes
 */
const wrapCSV = (value) => {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
};

// ==========================================
// PDF LOGO UTILITIES
// ==========================================

/**
 * Loads the BizBuddy logo image and converts it to base64
 */
const loadLogoImage = async () => {
  try {
    const response = await fetch(BRANDING.logoUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('⚠️ Failed to load BizBuddy logo:', error.message);
    return null;
  }
};

/**
 * Draws the BizBuddy logo on the PDF
 */
const drawBizBuddyLogo = async (doc, x, y, width = 35, height = 14) => {
  try {
    const logoBase64 = await loadLogoImage();
    if (logoBase64) {
      // Add the actual logo image
      doc.addImage(logoBase64, 'PNG', x, y, width, height);
    } else {
      // Fallback to manual drawing if image fails to load
      doc.setFillColor(...BRANDING.colors.primary);
      doc.roundedRect(x, y, width, height, 2, 2, "F");

      doc.setTextColor(...BRANDING.colors.white);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("BIZ", x + 5, y + 5.5);
      doc.text("BUDDY", x + 2, y + 9.5);

      doc.setDrawColor(...BRANDING.colors.accent);
      doc.setLineWidth(0.8);
      doc.line(x + 13, y + 3, x + 13, y + 9);
      doc.line(x + 18, y + 3, x + 18, y + 9);
    }
  } catch (error) {
    console.error('❌ Error drawing logo:', error);
  }
};

export {
  BRANDING,
  fetchCurrentUser,
  extractUserInfo,
  calculateSummaryStats,
  wrapCSV,
  loadLogoImage,
  drawBizBuddyLogo,
  jsPDF,
  autoTable,
};
