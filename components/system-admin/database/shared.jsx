// components/system-admin/database/shared.jsx
//
// BB-110: Database page helpers. The generic pieces live in ../shared.jsx.

"use client";

import { useSystemAdminSection } from "../shared";

export { SectionCard, SortHeader, formatBytes, formatNumber, relativeTime } from "../shared";

// GET /api/system-admin/database{path} as one page section
export function useDatabaseSection(path) {
  return useSystemAdminSection(`/api/system-admin/database${path}`);
}
