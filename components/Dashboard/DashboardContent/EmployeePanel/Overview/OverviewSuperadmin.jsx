"use client";
// components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewSuperadmin.jsx
//
// BB-133: platform overview for superadmins. GET /api/analytics/super-dashboard.
// Restyled in the System Admin → Activity look. Removed: "Server Uptime" (the server returns a
// hard-coded 99.9) and the always-on "Platform Healthy" badge. Server (BB-133): superadmin-only
// route, days in UTC (companies are in different zones), net hours, serverUptime / avgResponseTime null. Known server issues, including
// this route also being open to admins and supervisors, are in docs/BB-133-overview-server-contract.md.

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useOverviewAnalytics, PeriodPicker, StatTile, TileGrid, ChartCard, SplitBar, RankedList, OverviewSkeleton,
  CHART, SERIES, AXIS, GRID, TOOLTIP, CURSOR_FILL, fmtAxisLabel, fmtHours, fmtNum, fmtMoney, fmtPct, rangeLabel,
} from "./OverviewShared";

const num = (v) => (typeof v === "string" ? parseFloat(v) : v) || 0;

function GrowthChart({ title, rows, color, loading, emptyText }) {
  return (
    <ChartCard title={title} loading={loading} empty={!rows.length} emptyText={emptyText}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} labelFormatter={fmtAxisLabel} formatter={(v) => [fmtNum(v), title]} />
          <Area type="monotone" dataKey="count" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default function OverviewSuperadmin() {
  const { data, loading, error, reload, period, setPeriod } = useOverviewAnalytics("/api/analytics/super-dashboard");

  if (!data) {
    return loading ? <OverviewSkeleton /> : (
      <Card><CardContent className="py-10 text-center space-y-2">
        <p className="text-sm text-destructive">{error || "Couldn't load the overview."}</p>
        <button type="button" className="text-sm underline text-muted-foreground" onClick={reload}>Try again</button>
      </CardContent></Card>
    );
  }

  const s = data.summary || {};
  const c = data.charts || {};
  const t = data.tables || {};
  const revenue = (c.revenueByPlan || []).map((r) => ({ ...r, revenue: num(r.revenue) }));
  const topActive = (t.topActiveCompanies || []).slice(0, 10);
  const maxActive = Math.max(0, ...topActive.map((r) => num(r.activeUsers)));

  return (
    <div className="space-y-6">
      <PeriodPicker period={period} onChange={setPeriod} label={rangeLabel(data.dateRange, "days in UTC")} disabled={loading} />

      <TileGrid>
        <StatTile loading={loading} label="Companies" value={fmtNum(num(s.totalCompanies))} hint={`+${fmtNum(num(s.newCompaniesCount))} this period`} />
        <StatTile loading={loading} label="Employees" value={fmtNum(num(s.totalEmployees))} hint={`+${fmtNum(num(s.newEmployeesCount))} this period`} />
        <StatTile loading={loading} label="Active users" value={fmtNum(num(s.activeUsersCount))} hint="Clocked in this period"
          info="Users with at least one clock-in in the selected period." />
        <StatTile loading={loading} label="Monthly recurring revenue" value={fmtMoney(num(s.mrr))}
          hint={`${fmtNum(num(s.totalActiveSubscriptions))} active subscriptions`} />
        <StatTile loading={loading} label="Hours tracked" value={fmtHours(num(s.totalHoursTracked))} hint={`${fmtHours(num(s.avgHoursPerUser))} average per user`} />
        <StatTile loading={loading} label="Leave requests" value={fmtNum(num(s.leaveRequestsCount))} hint="This period" />
        <StatTile loading={loading} label="Subscription plans" value={fmtNum(num(s.totalPlans))} hint="Plans offered" />
        <StatTile loading={loading} label="Engagement" value={fmtPct(s.engagementRate)} hint="Active users ÷ employees" />
      </TileGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscription mix</CardTitle>
            <p className="text-xs text-muted-foreground">Companies per plan</p>
          </CardHeader>
          <CardContent>
            <SplitBar
              items={(c.subscriptionMix || []).map((m, i) => ({ label: m.name, value: num(m.value), color: SERIES[i % SERIES.length] }))}
              emptyText="No subscriptions."
            />
          </CardContent>
        </Card>

        <ChartCard className="lg:col-span-2" title="Revenue by plan" loading={loading} empty={!revenue.length} emptyText="No revenue in this period.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="plan" tick={AXIS} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => fmtMoney(v)} width={64} />
              <Tooltip {...TOOLTIP} cursor={CURSOR_FILL} formatter={(v) => [fmtMoney(v), "Revenue"]} />
              <Bar dataKey="revenue" fill={CHART.c1} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthChart title="New companies" rows={c.newCompanies || []} color={CHART.c1} loading={loading} emptyText="No new companies in this period." />
        <GrowthChart title="New employees" rows={c.newEmployees || []} color={CHART.c2} loading={loading} emptyText="No new employees in this period." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top companies by hours</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedList rows={(c.topCompaniesByHours || []).slice(0, 8)} label="company" value="hours" format={fmtHours} color={CHART.c1}
              emptyText="No hours in this period." />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sessions by country</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedList rows={(c.sessionsByCountry || []).slice(0, 8)} label="country" value="count" color={CHART.c3}
              emptyText="No sessions in this period." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Most active companies</CardTitle>
            <p className="text-xs text-muted-foreground">Active users{data.dateRange?.label ? `, ${data.dateRange.label}` : ""}</p>
          </CardHeader>
          <CardContent>
            {topActive.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Active users</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topActive.map((r, i) => (
                    <TableRow key={`${r.company}-${i}`}>
                      <TableCell className="font-medium">{r.company}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                            <div className="h-full rounded-full bg-orange-500" style={{ width: `${maxActive ? (num(r.activeUsers) / maxActive) * 100 : 0}%` }} />
                          </div>
                          <span className="tabular-nums w-10 text-right">{fmtNum(num(r.activeUsers))}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recently joined</CardTitle>
          </CardHeader>
          <CardContent>
            {!(t.recentCompanies || []).length ? (
              <p className="text-sm text-muted-foreground">No new companies recently.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.recentCompanies.map((r, i) => (
                    <TableRow key={`${r.name}-${i}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.daysAgo === 0 ? "Today" : `${fmtNum(num(r.daysAgo))} day${num(r.daysAgo) === 1 ? "" : "s"} ago`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
