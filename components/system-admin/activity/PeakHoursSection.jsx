// components/system-admin/activity/PeakHoursSection.jsx
//
// BB-112: requests per hour of day, one heatmap row per company, in that
// company's own time zone. GET /activity/peak-hours.

"use client";

import { useMemo } from "react";
import { SectionCard, formatNumber } from "../shared";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

const hourLabel = (h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

// Sequential single hue: the theme's chart-1 at increasing opacity
const cellColor = (ratio) => (ratio > 0 ? `hsl(var(--chart-1) / ${0.12 + ratio * 0.88})` : "hsl(var(--muted))");

export default function PeakHoursSection({ section }) {
  const companies = useMemo(() => {
    const byCompany = new Map();
    for (const r of section.data?.rows || []) {
      const c = byCompany.get(r.companyId) || {
        companyId: r.companyId,
        companyName: r.companyName,
        timeZone: r.timeZone,
        hours: {},
        total: 0,
        max: 0,
      };
      c.hours[r.hour] = r;
      c.total += r.requests;
      c.max = Math.max(c.max, r.requests);
      byCompany.set(r.companyId, c);
    }
    return [...byCompany.values()].sort((a, b) => b.total - a.total);
  }, [section.data]);

  return (
    <SectionCard
      title="Peak hours"
      description="Requests per hour of day, in each company's own time zone. Darker means busier for that company."
      section={section}
    >
      {companies.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px] space-y-1.5">
            {/* Hour axis */}
            <div className="grid grid-cols-[200px_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px] text-muted-foreground">
              <span />
              {HOURS.map((h) => (
                <span key={h} className="text-center">
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </span>
              ))}
            </div>

            {companies.map((c) => (
              <div key={c.companyId} className="grid grid-cols-[200px_repeat(24,minmax(0,1fr))] items-center gap-0.5">
                <div className="min-w-0 pr-3">
                  <p className="truncate text-sm text-foreground">{c.companyName || c.companyId}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.timeZone}</p>
                </div>
                {HOURS.map((h) => {
                  const cell = c.hours[h];
                  const requests = cell?.requests || 0;
                  return (
                    <div
                      key={h}
                      className="h-6 rounded-sm"
                      style={{ backgroundColor: cellColor(c.max ? requests / c.max : 0) }}
                      title={`${c.companyName} · ${hourLabel(h)} (${c.timeZone}): ${formatNumber(requests)} requests, ${formatNumber(
                        cell?.users || 0
                      )} users`}
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 pt-2 text-[11px] text-muted-foreground">
              Fewer
              {[0.15, 0.4, 0.7, 1].map((r) => (
                <span key={r} className="h-3 w-5 rounded-sm" style={{ backgroundColor: cellColor(r) }} />
              ))}
              More
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
