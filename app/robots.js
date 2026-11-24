// BB-145 follow-up: served at /robots.txt. Keeps crawlers on the public site only.
const SITE_URL = "https://mybizbuddy.co";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/system-admin", "/dashboard", "/payment", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
