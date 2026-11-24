// BB-145 follow-up: served at /sitemap.xml. Public pages only: no /system-admin or /dashboard,
// and no /pricing (live plan prices are kept off the public site).
const SITE_URL = "https://mybizbuddy.co";

const PAGES = [
  { path: "", priority: 1, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "yearly" },
  { path: "/sign-in", priority: 0.5, changeFrequency: "yearly" },
  { path: "/sign-up", priority: 0.5, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/account-deletion", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap() {
  const lastModified = new Date();
  return PAGES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
