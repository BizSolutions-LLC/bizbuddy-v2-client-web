"use client";
// components/Dashboard/DashboardContent/EmployeePanel/Overview/OverviewAdmin.jsx
//
// BB-133: company overview (admins) or team overview (supervisors: their department + direct
// reports, data.scope === "team"). GET /api/analytics/admin-dashboard.
// Corrected server numbers: company time zone, range ends today, rates are shares of decided
// scheduled person-days, approved OT from cutoff review next to hours beyond schedule.
// New fields are read first; old names stay as fallbacks while both exist.

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useOverviewAnalytics, PeriodPicker, StatTile, TileGrid, ChartCard, SplitBar, RankedList, OverviewSkeleton,
  CHART, SERIES, AXIS, GRID, TOOLTIP, CURSOR_FILL, fmtAxisLabel, fmtHours, fmtNum, fmtPct, rangeLabel,
} from "./OverviewShared";

const num = (v) => (typeof v === "string" ? parseFloat(v) : v) || 0;

export default function OverviewAdmin() {
  const { data, loading, error, reload, period, setPeriod } = useOverviewAnalytics("/api/analytics/admin-dashboard");

  if (!data) {
    return loading ? <OverviewSkeleton /> : (
      <Card><CardContent className="py-10 text-center space-y-2">
        <p className="text-sm text-destructive">{error || "Couldn't load the overview."}</p>
        <button type="button" className="text-sm underline text-muted-foreground" onClick={reload}>Try again</button>
      </CardContent></Card>
    );
  }

  const team = data.scope === "team";
  const s = data.summary || {};
  const c = data.charts || {};
  const att = c.attendanceMetrics || {};
  const lateRate = num(att.lateRate ?? s.lateRate);
  const earlyRate = num(att.earlyRate ?? s.earlyLeaveRate);
  const reliability = num(att.reliabilityRate ?? s.reliabilityRate);
  const activeStaff = c.activeStaff || [];
  const hours = c.hoursComparison || [];
  const daily = c.attendanceDaily || [];
  const beyond = num(s.hoursBeyondSchedule ?? s.totalOvertimeHours);
  const approved = s.approvedOvertimeHours;
  const hasApproved = approved != null;
  const otTrend = (c.overtimeTrend || []).map((r) => ({
    period: r.period,
    approved: num(r.approvedHours),
    beyond: num(r.beyondScheduleHours ?? r.hours),
  }));
  const otDept = (c.overtimeByDepartment || []).map((r) => ({
    dept: r.dept,
    approved: num(r.approvedHours),
    beyond: num(r.beyondScheduleHours ?? r.hours),
  })).map((r) => ({ ...r, rank: hasApproved ? r.approved : r.beyond }))
    .sort((a, b) => b.rank - a.rank || b.beyond - a.beyond);
  const depts = c.departmentBreakdown || [];
  const people = team ? "team members" : "employees";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodPicker period={period} onChange={setPeriod} label={rangeLabel(data.dateRange)} disabled={loading} />
        {team && <p className="text-sm text-muted-foreground">Your department and direct reports</p>}
      </div>

      <TileGrid>
        <StatTile loading={loading} label="Active staff" value={fmtNum(num(s.activeStaff))}
          hint={`of ${fmtNum(num(s.totalEmployees))} ${people}`}
          info="People with at least one clock-in in the selected period." />
        <StatTile loading={loading} label="Hours worked" value={fmtHours(num(s.totalHoursWorked))}
          hint="Net hours, breaks deducted" />
        {hasApproved ? (
          <StatTile loading={loading} label="Approved overtime" value={fmtHours(num(approved))}
            hint={`${fmtHours(beyond)} beyond schedule`}
            info="Overtime approved in cutoff review (same as payroll). The current period may show 0 until its cutoff is reviewed. Beyond schedule = worked minus scheduled hours." />
        ) : (
          <StatTile loading={loading} label="Beyond schedule" value={fmtHours(beyond)} hint="Worked minus scheduled hours" />
        )}
        <StatTile loading={loading} label="Absences" value={s.absences != null ? fmtNum(num(s.absences)) : "—"}
          hint={s.scheduledShifts != null ? `of ${fmtNum(num(s.scheduledShifts))} scheduled days` : "Leave and holidays not counted"}
          info="Scheduled days already over with no punch. Approved leave and company holidays never count." />
        <StatTile loading={loading} label="Coverage" value={fmtPct(s.coverageRate)} hint="Scheduled days with a punch" />
        <StatTile loading={loading} label="Reliability" value={fmtPct(reliability)} hint="On time and not early"
          info="Share of scheduled days started on time (within grace) and not ended early." />
        <StatTile loading={loading} label="Late rate" value={fmtPct(lateRate)} hint="After shift start + grace" />
        <StatTile loading={loading} label="Early leave rate" value={fmtPct(earlyRate)} hint="Before shift end − grace" />
      </TileGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        {daily.length > 0 ? (
          <ChartCard title="Daily attendance" description="Scheduled days, each counted once" loading={loading}
            empty={!daily.some((d) => num(d.onTime) + num(d.late) + num(d.earlyOut) + num(d.absent) > 0)}
            emptyText="No scheduled days in this period.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP} cursor={CURSOR_FILL} labelFormatter={fmtAxisLabel} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="onTime" name="On time" stackId="a" fill={CHART.c2} maxBarSize={28} />
                <Bar dataKey="late" name="Late" stackId="a" fill={CHART.c4} maxBarSize={28} />
                <Bar dataKey="earlyOut" name="Early out" stackId="a" fill={CHART.c5} maxBarSize={28} />
                <Bar dataKey="absent" name="Absent" stackId="a" fill={CHART.danger} maxBarSize={28} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shift attendance</CardTitle>
              <p className="text-xs text-muted-foreground">Share of scheduled shifts</p>
            </CardHeader>
            <CardContent>
              <SplitBar
                items={[
                  { label: "On time, full shift", value: reliability, color: CHART.c2 },
                  { label: "Late clock-in", value: lateRate, color: CHART.c4 },
                  { label: "Early clock-out", value: earlyRate, color: CHART.c5 },
                ]}
                format={(v) => fmtPct(v)}
                emptyText="No scheduled shifts in this period."
              />
            </CardContent>
          </Card>
        )}

        <ChartCard title="Scheduled vs actual hours" loading={loading} empty={!hours.length} emptyText="No hours in this period.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP} cursor={CURSOR_FILL} labelFormatter={fmtAxisLabel} formatter={(v, nm) => [fmtHours(v), nm]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="scheduled" name="Scheduled" fill={CHART.c3} radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="actual" name="Actual" fill={CHART.c1} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Overtime" description={hasApproved ? "Approved in cutoff review vs hours beyond schedule" : "Hours beyond schedule"}
          loading={loading} empty={!otTrend.some((r) => r.approved + r.beyond > 0)} emptyText="No overtime in this period.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={otTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="period" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP} cursor={CURSOR_FILL} labelFormatter={fmtAxisLabel} formatter={(v, nm) => [fmtHours(v), nm]} />
              {hasApproved && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {hasApproved && <Bar dataKey="approved" name="Approved" fill={CHART.c1} radius={[4, 4, 0, 0]} maxBarSize={20} />}
              <Bar dataKey="beyond" name="Beyond schedule" fill={CHART.c5} radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active staff" description="People who clocked in" loading={loading} empty={!activeStaff.length} emptyText="No clock-ins in this period.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeStaff} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tickFormatter={fmtAxisLabel} tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP} labelFormatter={fmtAxisLabel} formatter={(v) => [fmtNum(v), "Active staff"]} />
              <Line type="monotone" dataKey="count" stroke={CHART.c2} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Overtime by department</CardTitle>
            <p className="text-xs text-muted-foreground">{hasApproved ? "Approved hours; beyond schedule in grey" : "Hours beyond schedule"}</p>
          </CardHeader>
          <CardContent>
            <RankedList rows={otDept.filter((r) => r.approved + r.beyond > 0)} showZero
              label="dept" value="rank" color={CHART.c5}
              format={fmtHours}
              detail={hasApproved ? (r) => `${fmtHours(r.beyond)} beyond` : undefined}
              emptyText="No overtime in this period." />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leave requests</CardTitle>
            <p className="text-xs text-muted-foreground">
              By status{s.leaveApprovalRate != null ? ` · ${fmtPct(s.leaveApprovalRate)} approved` : ""}
            </p>
          </CardHeader>
          <CardContent>
            <SplitBar
              items={(c.leaveDistribution || []).map((d, i) => ({ label: d.name, value: num(d.value), color: SERIES[(i + 1) % SERIES.length] }))}
              emptyText="No leave requests in this period."
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leave by type</CardTitle>
            <p className="text-xs text-muted-foreground">Approved leave days</p>
          </CardHeader>
          <CardContent>
            <RankedList rows={c.leaveByType} label="type" value="days" color={CHART.c3}
              format={(v) => `${fmtNum(v, 1)} day${v === 1 ? "" : "s"}`} emptyText="No leave in this period." />
          </CardContent>
        </Card>
      </div>

      {depts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Total hours</TableHead>
                    <TableHead className="text-right">Avg hours / person</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depts.map((d, i) => (
                    <TableRow key={`${d.department}-${i}`}>
                      <TableCell className="font-medium">{d.department}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(num(d.employees))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(num(d.activeEmployees))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtHours(num(d.totalHours))}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtHours(num(d.avgHoursPerEmployee))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
