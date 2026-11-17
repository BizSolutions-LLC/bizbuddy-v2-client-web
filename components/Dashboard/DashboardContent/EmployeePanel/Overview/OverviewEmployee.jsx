"use client";
// components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewEmployee.jsx
//
// BB-133: the signed-in person's own overview. GET /api/analytics/employee.
// Server rules (corrected numbers): company time zone, range ends today, net hours, late after
// grace, early out before grace, absences exclude leave and holidays, approved OT from cutoff review.
// New fields are read first; the old names are kept as fallbacks while both exist.

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useOverviewAnalytics, PeriodPicker, StatTile, TileGrid, ChartCard, AttendanceStrip, OverviewSkeleton,
  CHART, AXIS, GRID, TOOLTIP, CURSOR_FILL, fmtAxisLabel, fmtHours, fmtNum, fmtClock, fmtMinutesOfDay, minutesOf, rangeLabel,
} from "./OverviewShared";

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export default function OverviewEmployee() {
  const { data, loading, error, reload, period, setPeriod } = useOverviewAnalytics("/api/analytics/employee");

  if (!data) {
    return loading ? <OverviewSkeleton /> : (
      <Card><CardContent className="py-10 text-center space-y-2">
        <p className="text-sm text-destructive">{error || "Couldn't load the overview."}</p>
        <button type="button" className="text-sm underline text-muted-foreground" onClick={reload}>Try again</button>
      </CardContent></Card>
    );
  }

  const t = data.totals || {};
  const avg = data.averages || {};
  const p = data.patterns || {};
  // series.daily (new) includes absent / leave / holiday days; charts.dailyHours (old) only worked days.
  const days = data.series?.daily || (data.charts?.dailyHours || []).map((d) => ({ ...d, status: "unscheduled" }));
  const hasSeries = Boolean(data.series?.daily);

  const hoursWorked = t.hoursWorked ?? t.totalHours;
  const daysWorked = t.daysWorked ?? days.filter((d) => d.hours > 0).length;
  const beyond = t.hoursBeyondSchedule ?? t.overtime;
  const usualIn = p.usualClockInLabel || fmtClock(p.usualClockIn) || "—";
  const usualOut = p.usualClockOutLabel || fmtClock(p.usualClockOut) || "—";

  // Stacked bars: regular + approved OT (approved OT is part of the worked hours).
  const hoursBars = days.map((d) => {
    const ot = Math.min(n(d.overtime), n(d.hours));
    return { date: d.date, regular: +(n(d.hours) - ot).toFixed(2), overtime: +ot.toFixed(2) };
  });
  const anyHours = hoursBars.some((d) => d.regular + d.overtime > 0);
  const anyOt = hoursBars.some((d) => d.overtime > 0);
  const clockIns = days.filter((d) => d.firstIn).map((d) => ({ date: d.date, minutes: minutesOf(d.firstIn) }));
  const usualInMin = minutesOf(p.usualClockIn);
  const who = [data.profile?.firstName && `${data.profile.firstName} ${data.profile.lastName || ""}`.trim(), data.profile?.department]
    .filter((v) => v && v !== "—").join(" · ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker period={period} onChange={setPeriod} label={rangeLabel(data.dateRange)} disabled={loading} />
        {who && <p className="text-sm text-muted-foreground">{who}</p>}
      </div>

      <TileGrid>
        <StatTile loading={loading} label="Hours worked" value={fmtHours(hoursWorked)}
          hint={t.scheduledDays != null ? `${fmtNum(daysWorked)} days worked · ${fmtNum(t.scheduledDays)} scheduled` : `${fmtNum(daysWorked)} days worked`}
          info="Net hours (breaks and lunch deducted), the same as Punch logs. A punch still open counts 0." />
        <StatTile loading={loading} label="Approved overtime" value={fmtHours(t.approvedOvertime)}
          hint={t.overtimeDays != null ? `${fmtNum(t.overtimeDays)} day${t.overtimeDays === 1 ? "" : "s"} · approved in cutoff review` : "Approved in cutoff review"}
          info="Overtime approved in the cutoff review, the same number as Punch logs and payroll. The current period may show 0 until its cutoff is reviewed." />
        <StatTile loading={loading} label="Beyond schedule" value={fmtHours(beyond)}
          hint="Worked minus scheduled hours"
          info="Hours worked beyond your scheduled hours, on scheduled days only. Not the same as approved overtime." />
        <StatTile loading={loading} label="Average per day" value={fmtHours(avg.hoursPerDayWorked ?? avg.hoursPerDay)}
          hint="On days you worked" />
        <StatTile loading={loading} label="Late clock-ins" value={fmtNum(t.lateIns)} hint="After shift start + grace" />
        <StatTile loading={loading} label="Early clock-outs" value={t.earlyOuts != null ? fmtNum(t.earlyOuts) : "—"} hint="Before shift end − grace" />
        <StatTile loading={loading} label="Absences" value={fmtNum(t.absences)}
          hint={t.leaveDays ? `${fmtNum(t.leaveDays)} leave day${t.leaveDays === 1 ? "" : "s"} not counted` : "Leave and holidays not counted"} />
        <StatTile loading={loading} label="Usual hours" value={`${usualIn} – ${usualOut}`} hint="Typical first clock-in and last clock-out" />
      </TileGrid>

      {daysWorked === 0 && !loading && (
        <p className="text-sm text-muted-foreground border-l-2 border-orange-500 pl-3">
          No time logged in this period yet. Once you clock in, your daily hours and attendance show here.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Daily hours"
          description={anyOt ? "Regular hours and approved overtime" : "Net hours per day"}
          loading={loading}
          empty={!anyHours}
          emptyText="No hours logged in this period."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hoursBars} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP} cursor={CURSOR_FILL} labelFormatter={fmtAxisLabel} formatter={(v, name) => [fmtHours(v), name]} />
              {anyOt && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              <Bar dataKey="regular" name="Regular" stackId="h" fill={CHART.c1} maxBarSize={32} radius={anyOt ? [0, 0, 0, 0] : [4, 4, 0, 0]} />
              {anyOt && <Bar dataKey="overtime" name="Approved overtime" stackId="h" fill={CHART.c5} maxBarSize={32} radius={[4, 4, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendance</CardTitle>
            <p className="text-xs text-muted-foreground">One square per day. Hover for details.</p>
          </CardHeader>
          <CardContent>
            {hasSeries ? <AttendanceStrip days={days} /> : (
              <p className="text-sm text-muted-foreground">Available once the server update is live.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {hasSeries && (
        <ChartCard
          title="Clock-in time"
          description={usualInMin != null ? `First clock-in each day. Usual: ${usualIn}` : "First clock-in each day"}
          loading={loading}
          empty={clockIns.length < 2}
          emptyText="Needs at least two days with a clock-in."
          height="h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={clockIns} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis dataKey="minutes" reversed domain={["dataMin - 30", "dataMax + 30"]} tickFormatter={fmtMinutesOfDay}
                tick={AXIS} axisLine={false} tickLine={false} width={56} />
              <Tooltip {...TOOLTIP} labelFormatter={fmtAxisLabel} formatter={(v) => [fmtMinutesOfDay(v), "Clock-in"]} />
              <Line type="monotone" dataKey="minutes" stroke={CHART.c2} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
