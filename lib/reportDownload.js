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
