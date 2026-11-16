// lib/cutoffCalendarPreview.js
// BB-121 (parked): the Calendar Type cutoff pages are a view-only preview until the server owns
// the pay math (see docs/BB-121-client-computation-audit.md). Every action that changes data is
// disabled on the Calendar pages; real work continues in the List view.
// Set to false to turn the Calendar pages' actions back on.
export const CALENDAR_PREVIEW_ONLY = true;

export const PREVIEW_TIP = "Preview — use the List view to make changes";

/** Same page, List view, for this visit only (the List/Calendar switches honour ?view=list). */
export const listViewHref = () => {
  if (typeof window === "undefined") return "?view=list";
  const url = new URL(window.location.href);
  url.searchParams.set("view", "list");
  return `${url.pathname}${url.search}`;
};
