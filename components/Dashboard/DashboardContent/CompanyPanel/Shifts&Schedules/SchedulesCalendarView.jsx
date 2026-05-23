"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  getDay,
} from "date-fns";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  User,
  Clock,
  X,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const fmtShiftTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

const shiftDuration = (startISO, endISO) => {
  if (!startISO || !endISO) return null;
  const h = (new Date(endISO) - new Date(startISO)) / 3_600_000;
  if (h <= 0) return null;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
};

const HOUR_PX = 56;

const toDecimalHour = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
};

export default function SchedulesCalendarView({ employees, shifts, token, API_URL }) {
  const [companyTimezone, setCompanyTimezone] = useState("UTC");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarShifts, setCalendarShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [saving, setSaving] = useState(false);

  // Right-click context menu: { x, y, date } | null
  const [contextMenu, setContextMenu] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [createForm, setCreateForm] = useState({
    shiftId: "",
    enableRecurrence: false,
    daysOfWeek: [],
    endDate: "",
  });

  // Edit / delete modal
  const [showEdit, setShowEdit] = useState(false);
  const [editShift, setEditShift] = useState(null);
  const [editShiftId, setEditShiftId] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExtend, setShowExtend] = useState(false);
  const [extendForm, setExtendForm] = useState({ daysOfWeek: [], endDate: "" });

  // Fetch company timezone once on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/company-settings/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        const tz = j.data?.timezone || j.data?.companyTimezone;
        if (tz) setCompanyTimezone(tz);
      })
      .catch(() => {});
  }, [token, API_URL]);

  // Today's date string in company timezone — used for the "today" highlight
  const todayStr = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: companyTimezone }),
    // Recompute when the timezone resolves; also re-check at component re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyTimezone]
  );

  // Close context menu when user clicks anywhere
  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const fetchShifts = useCallback(
    async (employeeId) => {
      if (!token || !employeeId) return;
      setLoadingShifts(true);
      try {
        const res = await fetch(`${API_URL}/api/usershifts/employee/${employeeId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) setCalendarShifts(data.data?.shifts || []);
        else toast.error(data.message || "Failed to load shifts");
      } catch {
        toast.error("Failed to load shifts");
      } finally {
        setLoadingShifts(false);
      }
    },
    [token, API_URL]
  );

  useEffect(() => {
    if (selectedEmployee) fetchShifts(selectedEmployee.id);
    else setCalendarShifts([]);
    setSelectedDate(null);
  }, [selectedEmployee, fetchShifts]);

  const shiftsByDate = useMemo(() => {
    const grouped = {};
    calendarShifts.forEach((s) => {
      if (!s.assignedDate) return;
      const key = s.assignedDate.slice(0, 10);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return grouped;
  }, [calendarShifts]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const startPadCount = getDay(monthStart);
    const startPad = Array.from({ length: startPadCount }, (_, i) => {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - (startPadCount - i));
      return d;
    });

    const totalCells = Math.ceil((startPadCount + days.length) / 7) * 7;
    const endPadCount = totalCells - startPadCount - days.length;
    const endPad = Array.from({ length: endPadCount }, (_, i) => {
      const d = new Date(monthEnd);
      d.setDate(d.getDate() + i + 1);
      return d;
    });

    return [...startPad, ...days, ...endPad];
  }, [calendarMonth]);

  const selectedDateShifts = useMemo(() => {
    if (!selectedDate) return [];
    return shiftsByDate[format(selectedDate, "yyyy-MM-dd")] || [];
  }, [selectedDate, shiftsByDate]);

  const timeline = useMemo(() => {
    if (!selectedDateShifts.length) return null;
    const startHours = selectedDateShifts.map((s) => toDecimalHour(s.shift?.startTime));
    const endHours = selectedDateShifts.map((s, i) => {
      const eH = toDecimalHour(s.shift?.endTime);
      return eH < startHours[i] ? eH + 24 : eH;
    });
    const minH = Math.max(0, Math.floor(Math.min(...startHours)) - 1);
    const maxH = Math.min(28, Math.ceil(Math.max(...endHours)) + 1);
    const markers = [];
    for (let h = minH; h <= maxH; h++) markers.push(h);
    return { minH, maxH, markers, totalHeight: (maxH - minH) * HOUR_PX + 24 };
  }, [selectedDateShifts]);

  const navigateMonth = (dir) => {
    setCalendarMonth((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  const openCreate = (date) => {
    setCreateDate(format(date, "yyyy-MM-dd"));
    setCreateForm({
      shiftId: "",
      enableRecurrence: false,
      daysOfWeek: [getDay(date)],
      endDate: "",
    });
    setShowCreate(true);
    setContextMenu(null);
  };

  const openEdit = (userShift) => {
    setEditShift(userShift);
    setEditShiftId(userShift.shiftId?.toString() || "");
    setShowDeleteConfirm(false);
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditShift(null);
    setShowDeleteConfirm(false);
    setShowExtend(false);
    setExtendForm({ daysOfWeek: [], endDate: "" });
  };

  const handleCellRightClick = (e, date) => {
    if (!selectedEmployee) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, date });
  };

  const handleCreate = async () => {
    if (!selectedEmployee) { toast.error("Select an employee"); return; }
    if (!createForm.shiftId) { toast.error("Select a shift"); return; }
    if (createForm.enableRecurrence && createForm.daysOfWeek.length === 0) {
      toast.error("Select at least one day of week"); return;
    }
    if (createForm.enableRecurrence && !createForm.endDate) {
      toast.error("Set an end date for recurrence"); return;
    }

    setSaving(true);
    try {
      const payload = createForm.enableRecurrence
        ? {
            shiftId: createForm.shiftId,
            startDate: createDate,
            endDate: createForm.endDate,
            daysOfWeek: createForm.daysOfWeek,
            assignmentType: "individual",
            targetIds: [selectedEmployee.id],
            replaceConflicts: false,
            skipConflicts: true,
          }
        : {
            shiftId: createForm.shiftId,
            startDate: createDate,
            endDate: createDate,
            daysOfWeek: [getDay(new Date(`${createDate}T00:00:00`))],
            assignmentType: "individual",
            targetIds: [selectedEmployee.id],
            replaceConflicts: false,
            skipConflicts: true,
          };

      const res = await fetch(`${API_URL}/api/shiftschedules/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Shift assigned!");
        setShowCreate(false);
        fetchShifts(selectedEmployee.id);
      } else if (res.status === 409) {
        toast.error("Conflict: a shift is already assigned on one or more of those dates.");
      } else {
        toast.error(data.message || "Failed to create");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editShift || !editShiftId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/usershifts/${editShift.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shiftId: editShiftId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Updated!");
        closeEdit();
        fetchShifts(selectedEmployee.id);
      } else {
        toast.error(data.message || "Failed to update");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editShift) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/usershifts/${editShift.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Shift removed!");
        closeEdit();
        fetchShifts(selectedEmployee.id);
      } else {
        toast.error(data.message || "Failed to delete");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleExtend = async () => {
    if (!editShift || !editShiftId) return;
    if (extendForm.daysOfWeek.length === 0) { toast.error("Select at least one day"); return; }
    if (!extendForm.endDate) { toast.error("Set an end date"); return; }

    setSaving(true);
    try {
      const startDate = editShift.assignedDate?.slice(0, 10) ?? "";
      const res = await fetch(`${API_URL}/api/shiftschedules/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shiftId: editShiftId,
          startDate,
          endDate: extendForm.endDate,
          daysOfWeek: extendForm.daysOfWeek,
          assignmentType: "individual",
          targetIds: [selectedEmployee.id],
          replaceConflicts: false,
          skipConflicts: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Shift extended!");
        closeEdit();
        fetchShifts(selectedEmployee.id);
      } else {
        toast.error(data.message || "Failed to extend");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Employee selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <User className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedEmployee?.id?.toString() || ""}
          disabled={loadingShifts}
          onValueChange={(val) => {
            const emp = employees.find((e) => e.id.toString() === val);
            setSelectedEmployee(emp || null);
          }}
        >
          <SelectTrigger className="w-72">
            {loadingShifts ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              </span>
            ) : (
              <SelectValue placeholder="Select an employee..." />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id.toString()}>
                {emp.profile?.firstName} {emp.profile?.lastName}
                <span className="ml-1 text-xs text-muted-foreground">({emp.email})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!selectedEmployee && !loadingShifts && (
          <span className="text-sm text-muted-foreground">
            Select an employee to view and manage their schedule
          </span>
        )}
      </div>

      {/* Calendar + Day Panel */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4 items-start">

      {/* Month calendar */}
      <div className="border rounded-lg overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => navigateMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[130px] text-center">
              {format(calendarMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => navigateMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline" size="sm" className="text-xs h-7"
            onClick={() => {
              const [y, m, d] = todayStr.split("-").map(Number);
              setCalendarMonth(new Date(y, m - 1, d));
            }}
          >
            Today
          </Button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b bg-muted/10">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="relative">
        {loadingShifts && (
          <div className="absolute inset-0 bg-background/70 z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background border rounded-full px-4 py-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
              Loading shifts...
            </div>
          </div>
        )}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayShifts = shiftsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, calendarMonth);
            const isTodayDate = format(day, "yyyy-MM-dd") === todayStr;
            const isSelected = selectedDate && format(day, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
            const canInteract = isCurrentMonth && !!selectedEmployee;

            return (
              <div
                key={idx}
                className={`
                  min-h-[90px] border-r border-b p-1.5 relative group
                  ${idx % 7 === 6 ? "border-r-0" : ""}
                  ${!isCurrentMonth ? "bg-muted/20" : "bg-background"}
                  ${canInteract ? "hover:bg-orange-50/50 dark:hover:bg-orange-950/10 cursor-pointer transition-colors" : ""}
                  ${isSelected && isCurrentMonth ? "bg-orange-50 dark:bg-orange-950/20 ring-1 ring-inset ring-orange-300 dark:ring-orange-700" : ""}
                `}
                onClick={canInteract ? () => setSelectedDate(day) : undefined}
                onContextMenu={canInteract ? (e) => handleCellRightClick(e, day) : undefined}
              >
                {/* Date number */}
                <div
                  className={`
                    text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1
                    ${isTodayDate && isCurrentMonth ? "bg-orange-500 text-white" : ""}
                    ${!isTodayDate && isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"}
                  `}
                >
                  {day.getDate()}
                </div>

                {/* Shift chips */}
                {isCurrentMonth && (
                  <>
                    {dayShifts.slice(0, 2).map((s) => {
                      const hasTime = s.shift?.startTime && s.shift?.endTime;
                      return (
                        <div
                          key={s.id}
                          title={`${s.shift?.shiftName}${hasTime ? ` · ${fmtShiftTime(s.shift.startTime)}–${fmtShiftTime(s.shift.endTime)}` : ""}`}
                          className="text-[10px] leading-tight px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 mb-0.5 flex items-center gap-1 min-w-0"
                        >
                          <Clock className="h-2.5 w-2.5 shrink-0" />
                          {hasTime ? (
                            <>
                              <span className="font-semibold truncate">
                                {fmtShiftTime(s.shift.startTime)}–{fmtShiftTime(s.shift.endTime)}
                              </span>
                              <span className="opacity-50 text-[9px] truncate shrink">
                                &nbsp;{s.shift?.shiftName}
                              </span>
                            </>
                          ) : (
                            <span className="truncate">{s.shift?.shiftName}</span>
                          )}
                        </div>
                      );
                    })}
                    {dayShifts.length > 2 && (
                      <p className="text-[10px] text-muted-foreground pl-1">
                        +{dayShifts.length - 2} more
                      </p>
                    )}
                  </>
                )}

                {/* Plus button on hover */}
                {canInteract && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedDate(day); openCreate(day); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title={`Add shift on ${format(day, "MMM d")}`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Day Panel */}
      {selectedDate ? (
        <div className="border rounded-lg overflow-hidden flex flex-col" style={{ minHeight: 280 }}>
          {/* Panel header */}
          <div className="px-3 py-2.5 border-b bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{format(selectedDate, "EEEE, MMMM d")}</p>
              <p className="text-xs text-muted-foreground">{format(selectedDate, "yyyy")}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selectedEmployee && (
                <Button
                  size="sm"
                  onClick={() => openCreate(selectedDate)}
                  className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1 px-2"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              )}
              <Button
                size="sm" variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedDate(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Timeline or empty state */}
          {selectedDateShifts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No shifts on this day</p>
              {selectedEmployee && (
                <Button
                  size="sm" variant="outline"
                  className="mt-3 text-xs h-7 gap-1"
                  onClick={() => openCreate(selectedDate)}
                >
                  <Plus className="h-3 w-3" />
                  Add shift
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 p-3">
              <div className="relative" style={{ height: timeline?.totalHeight ?? 0 }}>
                {/* Hour marker lines */}
                {timeline?.markers.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 flex items-start"
                    style={{ top: (h - timeline.minH) * HOUR_PX }}
                  >
                    <span className="text-[10px] text-muted-foreground w-10 text-right pr-2 leading-none select-none shrink-0 -translate-y-1.5">
                      {String(h % 24).padStart(2, "0")}:00
                    </span>
                    <div className="flex-1 border-t border-dashed border-muted-foreground/20 mt-0" />
                  </div>
                ))}

                {/* Shift blocks */}
                {selectedDateShifts.map((s) => {
                  const startH = toDecimalHour(s.shift?.startTime);
                  const rawEndH = toDecimalHour(s.shift?.endTime);
                  const endH = rawEndH < startH ? rawEndH + 24 : rawEndH;
                  const blockTop = (startH - (timeline?.minH ?? 0)) * HOUR_PX + 2;
                  const blockHeight = Math.max((endH - startH) * HOUR_PX - 4, 44);
                  const dur = shiftDuration(s.shift?.startTime, s.shift?.endTime);

                  return (
                    <div
                      key={s.id}
                      className="absolute left-11 right-0 rounded-md bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-2 overflow-hidden"
                      style={{ top: blockTop, height: blockHeight }}
                    >
                      <div className="flex justify-between items-start gap-1 h-full">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 leading-tight">
                            {fmtShiftTime(s.shift?.startTime)} – {fmtShiftTime(s.shift?.endTime)}
                          </p>
                          <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 truncate mt-0.5">
                            {s.shift?.shiftName}
                          </p>
                          {dur && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{dur}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                            className="w-5 h-5 rounded flex items-center justify-center text-orange-600 hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditShift(s);
                              setEditShiftId(s.shiftId?.toString() || "");
                              setShowDeleteConfirm(true);
                              setShowEdit(true);
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : selectedEmployee ? (
        <div className="border border-dashed rounded-lg hidden md:flex items-center justify-center min-h-[240px]">
          <p className="text-sm text-muted-foreground text-center px-6 leading-relaxed">
            Click any date to see<br />its shift breakdown
          </p>
        </div>
      ) : null}

      </div>{/* end grid */}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center gap-2"
            onClick={() => { setSelectedDate(contextMenu.date); openCreate(contextMenu.date); }}
          >
            <Plus className="h-4 w-4" />
            New shift
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground"
            onClick={() => {
              const [y, m, d] = todayStr.split("-").map(Number);
              setCalendarMonth(new Date(y, m - 1, d));
              setContextMenu(null);
            }}
          >
            Go to today
          </button>
        </div>
      )}

      {/* Create Shift Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
        <DialogContent className="max-w-sm border-t-4 border-t-orange-500">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-100 text-orange-500 dark:bg-orange-900/30">
                <Plus className="h-4 w-4" />
              </div>
              Assign Shift
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee && (
                <>
                  <strong>
                    {selectedEmployee.profile?.firstName} {selectedEmployee.profile?.lastName}
                  </strong>
                  {" · "}
                  {createDate}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>
                Shift <span className="text-orange-500">*</span>
              </Label>
              <Select
                value={createForm.shiftId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, shiftId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a shift" />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.startTime && s.endTime ? (
                        <>
                          <span className="font-mono font-semibold">
                            {fmtShiftTime(s.startTime)} – {fmtShiftTime(s.endTime)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">{s.shiftName}</span>
                        </>
                      ) : (
                        <span>{s.shiftName}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.shiftId && (() => {
                const sh = shifts.find((s) => s.id.toString() === createForm.shiftId);
                if (!sh?.startTime || !sh?.endTime) return null;
                const dur = shiftDuration(sh.startTime, sh.endTime);
                return (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                    <Clock className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="font-mono font-semibold">
                      {fmtShiftTime(sh.startTime)} – {fmtShiftTime(sh.endTime)}
                    </span>
                    {dur && <span className="ml-auto text-xs text-muted-foreground">{dur}</span>}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-recur"
                checked={createForm.enableRecurrence}
                onCheckedChange={(v) =>
                  setCreateForm((f) => ({ ...f, enableRecurrence: !!v }))
                }
              />
              <Label htmlFor="enable-recur" className="cursor-pointer font-normal text-sm">
                Repeat on multiple days
              </Label>
            </div>

            {createForm.enableRecurrence && (
              <div className="space-y-3 pl-4 border-l-2 border-orange-200 dark:border-orange-800">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Repeat on</Label>
                  <div className="flex gap-1 flex-wrap">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setCreateForm((f) => ({
                            ...f,
                            daysOfWeek: f.daysOfWeek.includes(d.value)
                              ? f.daysOfWeek.filter((x) => x !== d.value)
                              : [...f.daysOfWeek, d.value],
                          }))
                        }
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          createForm.daysOfWeek.includes(d.value)
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Until (end date)</Label>
                  <Input
                    type="date"
                    value={createForm.endDate}
                    min={createDate}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Assigning...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Shift
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / Delete / Extend — mobile-first bottom sheet */}
      <Sheet open={showEdit} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 flex flex-col border-t-0 focus:outline-none max-h-[85vh]"
        >
          {/* Accent line */}
          <div
            className={`h-1 w-full rounded-t-2xl shrink-0 transition-colors ${
              showDeleteConfirm ? "bg-red-500" : "bg-orange-500"
            }`}
          />

          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-4 shrink-0">
            <div className="flex items-center gap-3 pr-8">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                  showDeleteConfirm
                    ? "bg-red-50 border-red-200 text-red-500 dark:bg-red-900/30 dark:border-red-800"
                    : "bg-orange-50 border-orange-200 text-orange-500 dark:bg-orange-900/30 dark:border-orange-800"
                }`}
              >
                {showDeleteConfirm ? (
                  <Trash2 className="h-5 w-5" />
                ) : showExtend ? (
                  <CalendarRange className="h-5 w-5" />
                ) : (
                  <Pencil className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="font-semibold text-base leading-tight">
                  {showDeleteConfirm
                    ? "Remove Shift"
                    : showExtend
                    ? "Extend Shift"
                    : "Edit Shift Assignment"}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {editShift?.assignedDate?.slice(0, 10)}
                  {selectedEmployee &&
                    ` · ${selectedEmployee.profile?.firstName} ${selectedEmployee.profile?.lastName}`}
                </SheetDescription>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">

            {/* ── Edit state ── */}
            {!showDeleteConfirm && !showExtend && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Shift <span className="text-orange-500">*</span></Label>
                  <Select value={editShiftId} onValueChange={setEditShiftId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.startTime && s.endTime ? (
                            <>
                              <span className="font-mono font-semibold">
                                {fmtShiftTime(s.startTime)} – {fmtShiftTime(s.endTime)}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">{s.shiftName}</span>
                            </>
                          ) : (
                            <span>{s.shiftName}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editShiftId && (() => {
                    const sh = shifts.find((s) => s.id.toString() === editShiftId);
                    if (!sh?.startTime || !sh?.endTime) return null;
                    const dur = shiftDuration(sh.startTime, sh.endTime);
                    return (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                        <Clock className="h-4 w-4 shrink-0 text-orange-500" />
                        <span className="font-mono font-semibold">
                          {fmtShiftTime(sh.startTime)} – {fmtShiftTime(sh.endTime)}
                        </span>
                        {dur && <span className="ml-auto text-xs text-muted-foreground">{dur}</span>}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── Delete confirm state ── */}
            {showDeleteConfirm && (
              <div className="py-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Remove{" "}
                  <strong className="text-foreground">{editShift?.shift?.shiftName}</strong>{" "}
                  on{" "}
                  <strong className="text-foreground">{editShift?.assignedDate?.slice(0, 10)}</strong>
                  {"? "}
                  This only removes this single day&apos;s assignment.
                </p>
              </div>
            )}

            {/* ── Extend state ── */}
            {showExtend && !showDeleteConfirm && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Shift <span className="text-orange-500">*</span></Label>
                  <Select value={editShiftId} onValueChange={setEditShiftId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a shift" />
                    </SelectTrigger>
                    <SelectContent>
                      {shifts.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.startTime && s.endTime ? (
                            <>
                              <span className="font-mono font-semibold">
                                {fmtShiftTime(s.startTime)} – {fmtShiftTime(s.endTime)}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">{s.shiftName}</span>
                            </>
                          ) : (
                            <span>{s.shiftName}</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editShiftId && (() => {
                    const sh = shifts.find((s) => s.id.toString() === editShiftId);
                    if (!sh?.startTime || !sh?.endTime) return null;
                    const dur = shiftDuration(sh.startTime, sh.endTime);
                    return (
                      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm">
                        <Clock className="h-4 w-4 shrink-0 text-orange-500" />
                        <span className="font-mono font-semibold">
                          {fmtShiftTime(sh.startTime)} – {fmtShiftTime(sh.endTime)}
                        </span>
                        {dur && <span className="ml-auto text-xs text-muted-foreground">{dur}</span>}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Repeat on</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setExtendForm((f) => ({
                            ...f,
                            daysOfWeek: f.daysOfWeek.includes(d.value)
                              ? f.daysOfWeek.filter((x) => x !== d.value)
                              : [...f.daysOfWeek, d.value],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          extendForm.daysOfWeek.includes(d.value)
                            ? "bg-orange-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Until (end date)</Label>
                  <Input
                    type="date"
                    value={extendForm.endDate}
                    min={editShift?.assignedDate?.slice(0, 10) ?? ""}
                    onChange={(e) => setExtendForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="h-11 text-sm"
                  />
                </div>

                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2 leading-relaxed">
                  Starts from <strong>{editShift?.assignedDate?.slice(0, 10)}</strong>. Dates
                  that already have a shift assigned will be skipped.
                </p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-background shrink-0">

            {/* Edit state footer */}
            {!showDeleteConfirm && !showExtend && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1.5 shrink-0"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const dayNum = getDay(
                        new Date(`${editShift?.assignedDate?.slice(0, 10)}T00:00:00`)
                      );
                      setExtendForm({ daysOfWeek: [dayNum], endDate: "" });
                      setShowExtend(true);
                    }}
                  >
                    <CalendarRange className="h-4 w-4 mr-1.5" />
                    Extend
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleEdit}
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Saving...</>
                    ) : (
                      <><Pencil className="h-4 w-4 mr-1.5" />Save Changes</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Delete state footer */}
            {showDeleteConfirm && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                >
                  ← Back
                </Button>
                <Button
                  className="flex-1 h-12"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Removing...</>
                  ) : (
                    <><Trash2 className="h-4 w-4 mr-1.5" />Remove Shift</>
                  )}
                </Button>
              </div>
            )}

            {/* Extend state footer */}
            {showExtend && !showDeleteConfirm && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setShowExtend(false)}
                  disabled={saving}
                >
                  ← Back
                </Button>
                <Button
                  className="flex-1 h-12 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleExtend}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Extending...</>
                  ) : (
                    <><CalendarRange className="h-4 w-4 mr-1.5" />Extend Shift</>
                  )}
                </Button>
              </div>
            )}

          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
