// lib/companySetupApi.js
// BB-115 — "Set up your business" guide. Every call applies to the caller's own company
// (admin / superadmin only, 403 otherwise) and returns the updated checklist as { data }.

const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/company-setup/checklist`;

async function call(token, path = "", method = "GET") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `Setup guide request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json.data;
}

const step = (key) => `/steps/${encodeURIComponent(key)}`;

export const getChecklist  = (token)      => call(token);
export const skipStep      = (token, key) => call(token, `${step(key)}/skip`, "POST");
export const unskipStep    = (token, key) => call(token, `${step(key)}/skip`, "DELETE");
export const reviewStep    = (token, key) => call(token, `${step(key)}/review`, "POST");
export const unreviewStep  = (token, key) => call(token, `${step(key)}/review`, "DELETE");
export const dismissGuide  = (token)      => call(token, "/dismiss", "POST");
export const reopenGuide   = (token)      => call(token, "/reopen", "POST");
