// lib/reportDownload.js
//
// BB-119: reports are built by the server (one PDFKit template, company time zone).
// This fetches one and saves it in the browser. Errors come back as JSON { message };
// the filename comes from Content-Disposition, which the server exposes through CORS.

export async function downloadServerReport({ apiUrl, token, path, fallbackFilename = "report" }) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to generate report (${response.status})`);
  }

  let filename = fallbackFilename;
  const match = (response.headers.get("Content-Disposition") || "").match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  if (match?.[1]) filename = match[1].replace(/['"]/g, "");

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release a moment later; releasing at once can cancel the save in some browsers
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

  return filename;
}

// BB-129: open a server PDF in a new browser tab. The tab is opened first, while the
// click is still being handled, so pop-up blockers allow it; the PDF loads into it after.
export async function openServerReport({ apiUrl, token, path }) {
  const win = window.open("", "_blank");
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Failed to open report (${response.status})`);
    }
    const blob = await response.blob();
    const pdf = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
    const objectUrl = URL.createObjectURL(pdf);
    if (!win) {
      URL.revokeObjectURL(objectUrl);
      throw new Error("Your browser blocked the new tab. Allow pop-ups for this site, or use Download.");
    }
    win.location.href = objectUrl;
    // Long enough for the tab to load it
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  } catch (e) {
    win?.close();
    throw e;
  }
}
