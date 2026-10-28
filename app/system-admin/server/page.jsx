// app/system-admin/server/page.jsx
//
// BB-112: Live Server — the API server's health and its most recent log output.
// Watch-only. Both panels poll while the tab is visible; a 429 holds them for a
// minute.

"use client";

import { usePageVisible, useRateLimitPause } from "@/components/system-admin/shared";
import HealthCard from "@/components/system-admin/server/HealthCard";
import LogPanel from "@/components/system-admin/server/LogPanel";

export default function LiveServerPage() {
  const visible = usePageVisible();
  const [rateLimited, pauseForRateLimit] = useRateLimitPause();
  const active = visible && !rateLimited;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">Live Server</h1>
        <p className="max-w-3xl text-sm text-neutral-600">
          Watch-only. Shows the server&apos;s most recent output and health. Passwords, PINs, codes and tokens are
          hidden. Lines are kept in memory only and clear on every restart or deploy. Build, deploy and crash logs are
          still in Render. Opening this page is recorded.
        </p>
      </div>

      {rateLimited && (
        <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">Refreshing too often, paused for a minute.</p>
      )}

      <HealthCard active={active} onRateLimited={pauseForRateLimit} />
      <LogPanel active={active} onRateLimited={pauseForRateLimit} />
    </div>
  );
}
