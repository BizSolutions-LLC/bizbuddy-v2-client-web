// components/system-admin/activity/OverviewSection.jsx
//
// BB-112: active-user tiles, web vs app split, active users per day (line) and
// sign-ins per day, succeeded vs failed (stacked bars). GET /activity/overview.

"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCard, formatNumber, formatDay } from "../shared";

// Theme tokens (palette validated for the light surface the admin pages use)
const COLORS = {
  activeUsers: "hsl(var(--chart-1))",
  succeeded: "hsl(var(--chart-2))",
  failed: "hsl(var(--destructive))",
  web: "hsl(var(--chart-1))",
  app: "hsl(var(--chart-2))",
  other: "hsl(var(--muted-foreground))",
};

const CLIENT_LABELS = { web: "Web", app: "App", other: "Other" };

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const GRID = "hsl(var(--border))";
const TOOLTIP = {
  contentStyle: { borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 },
  labelFormatter: formatDay,
};

export default function OverviewSection({ section }) {
  const { data, loading, error } = section;
  const actives = data?.activeUsers;

  const tiles = [
    { label: "Active today", value: actives?.last24h, hint: "Last 24 hours" },
    { label: "Active this week", value: actives?.last7Days, hint: "Last 7 days" },
    { label: "Active this month", value: actives?.last30Days, hint: "Last 30 days" },
  ];

  return (
    <div className="space-y-6">
      {/* Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{error ? "—" : formatNumber(t.value)}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
        <ClientSplit clients={data?.clients} loading={loading && !data} error={error} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Active users per day" section={section} skeletonRows={6}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.dailyActiveUsers || []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="Active users"
                  stroke={COLORS.activeUsers}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Sign-ins per day" section={section} skeletonRows={6}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.signIns || []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tickFormatter={formatDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} cursor={{ fill: "hsl(var(--muted))" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="succeeded" name="Succeeded" stackId="signins" fill={COLORS.succeeded} />
                <Bar dataKey="failed" name="Failed" stackId="signins" fill={COLORS.failed} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// Web vs app as one split bar, with a labelled legend
function ClientSplit({ clients, loading, error }) {
  const rows = (clients || []).filter((c) => c.users > 0);
  const total = rows.reduce((n, c) => n + c.users, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Web vs app</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <Skeleton className="h-8 w-full" />
        ) : error || total === 0 ? (
          <div className="text-2xl font-bold text-foreground">—</div>
        ) : (
          <>
            <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
              {rows.map((c) => (
                <div
                  key={c.client}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(c.users / total) * 100}%`, backgroundColor: COLORS[c.client] || COLORS.other }}
                  title={`${CLIENT_LABELS[c.client] || c.client}: ${formatNumber(c.users)} users`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {rows.map((c) => (
                <span key={c.client} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[c.client] || COLORS.other }} />
                  {CLIENT_LABELS[c.client] || c.client} {Math.round((c.users / total) * 100)}%
                </span>
              ))}
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">Share of active users</p>
      </CardContent>
    </Card>
  );
}
