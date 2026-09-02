"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  Pencil, 
  Trash2,
  Plus,
  Filter,
  Users,
  CalendarDays,
  TrendingUp,
  RefreshCw,
  Search,
  Building,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  X,
  LayoutList,
  Upload,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import SchedulesCalendarView from "./SchedulesCalendarView";
import UploadWeeklySchedule from "./UploadWeeklySchedule";

export default function ModernCompanySchedules() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // useAuthStore() never exposed a `role` property (only `token` and a computed
  // `user` getter over the decoded JWT) — the old `const { role } = useAuthStore()`
  // was always undefined, so this page's own access-control redirect never actually
  // fired for anyone. Fetch the real role from /api/account/profile instead, same
  // fix already applied to PunchLogs.jsx (BB-080) and the pattern EmployeesPunchLogs.jsx
  // has used all along.
  const [currentUserRole, setCurrentUserRole] = useState("");

  const fetchCurrentUserRole = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/account/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setCurrentUserRole(j.data?.user?.role || "");
    } catch {}
  };

  useEffect(() => {
    if (currentUserRole && !["admin", "superadmin", "supervisor"].includes(currentUserRole.toLowerCase())) {
      window.location.href = "/dashboard";
    }
    if (!token) {
      toast.error("Session expired. Please log in again.");
      window.location.href = "/login";
    }
  }, [currentUserRole, token]);

  const DAY_DISPLAY = {
    0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"
  };

  const [schedules, setSchedules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [uploadScheduleModalOpen, setUploadScheduleModalOpen] = useState(false); // BB-081
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  
  // BUG 3 FIX: Use the exact field names the backend returns
  const [stats, setStats] = useState({ 
    totalSchedules: 0, 
    activeSchedules: 0, 
    assignedEmployees: 0, 
    avgDaysPerSchedule: 0,   // was: averageDaysPerSchedule — mismatched the API field name
  });
  
  const [scheduleForm, setScheduleForm] = useState({
    shiftId: "",
    daysOfWeek: [],
    startDate: "",
    endDate: "",
    assignmentType: "individual",
    targetIds: [],  // multi-select employee IDs for individual type (create)
    targetId: "",   // single ID for department type
  });

  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"

  const dayOptions = [
    { value: 1, label: "Mon", color: "bg-blue-500" },
    { value: 2, label: "Tue", color: "bg-green-500" },
    { value: 3, label: "Wed", color: "bg-yellow-500" },
    { value: 4, label: "Thu", color: "bg-purple-500" },
    { value: 5, label: "Fri", color: "bg-pink-500" },
    { value: 6, label: "Sat", color: "bg-orange-500" },
    { value: 0, label: "Sun", color: "bg-red-500" }
  ];

  const fetchStats = async () => {
    try {
      const statsRes = await fetch(`${API_URL}/api/company/me/schedule-stats`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [schRes, shiftRes, userRes, deptRes] = await Promise.all([
        fetch(`${API_URL}/api/shiftschedules`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/shifts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/employee?all=1`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/departments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      
      const [schData, shiftData, userData, deptData] = await Promise.all([
        schRes.json(), shiftRes.json(), userRes.json(), deptRes.json(),
      ]);
      
      if (schRes.ok) setSchedules(schData.data || []);
      else toast.error(schData.message || "Schedules error");
      
      if (shiftRes.ok) setShifts(shiftData.data || []);
      else toast.error(shiftData.message || "Shifts error");
      
      if (userRes.ok) setEmployees(userData.data || []);
      else toast.error(userData.message || "Users error");
      
      if (deptRes.ok) setDepartments(deptData.data || []);
      else toast.error(deptData.message || "Departments error");

      await fetchStats();
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setScheduleForm({
      shiftId: "", daysOfWeek: [], startDate: "", endDate: "",
      assignmentType: "individual", targetIds: [], targetId: "",
    });
    setConflictData(null);
    setEmployeeSearch("");
  };

  const fmtScheduleDate = (str) => {
    if (!str) return "—";
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const fmtShiftTime = (t) => {
    if (!t) return "—";
    try {
      return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" });
    } catch {
      return "";
    }
  };

  const shiftDuration = (start, end) => {
    if (!start || !end) return null;
    const h = (new Date(end) - new Date(start)) / 3_600_000;
    if (h <= 0) return null;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  };

  const handleDayToggle = (day) => {
    setScheduleForm(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  // BUG 2 FIX: handleCreateSchedule now accepts a named action instead of
  // a boolean so callers are explicit. Valid actions:
  //   "check"   — first attempt, return 409 if conflicts (default)
  //   "skip"    — create only non-conflicting dates (skipConflicts=true)
  //   "replace" — delete conflicting dates then create all (replaceConflicts=true)
  const handleCreateSchedule = async (action = "check") => {
    if (!scheduleForm.shiftId || scheduleForm.daysOfWeek.length === 0 || 
        !scheduleForm.startDate || !scheduleForm.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (scheduleForm.assignmentType === "individual" && scheduleForm.targetIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    if (scheduleForm.assignmentType === "department" && !scheduleForm.targetId) {
      toast.error("Please select a department");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        shiftId: scheduleForm.shiftId,
        daysOfWeek: scheduleForm.daysOfWeek,
        startDate: scheduleForm.startDate,
        endDate: scheduleForm.endDate,
        assignmentType: scheduleForm.assignmentType,
        ...(scheduleForm.assignmentType === "individual"
          ? { targetIds: scheduleForm.targetIds }
          : scheduleForm.assignmentType === "department"
          ? { targetId: scheduleForm.targetId }
          : { targetId: null }),
        replaceConflicts: action === "replace",
        skipConflicts:    action === "skip",
      };

      const response = await fetch(`${API_URL}/api/shiftschedules/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 409) {
        // Show the conflict dialog — do NOT call handleCreateSchedule again here
        setConflictData(data);
        setShowConflictWarning(true);
      } else if (response.ok) {
        toast.success(data.message || "Schedule created successfully!");
        setShowCreateModal(false);
        setShowConflictWarning(false);
        resetForm();
        await fetchAll();
      } else {
        toast.error(data.message || "Failed to create schedule");
      }
    } catch (error) {
      console.error("Create schedule error:", error);
      toast.error("An error occurred while creating the schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSchedule = async () => {
    if (!selectedSchedule) return;

    setSaving(true);
    try {
      const payload = {
        shiftId:        scheduleForm.shiftId,
        daysOfWeek:     scheduleForm.daysOfWeek,
        startDate:      scheduleForm.startDate,
        endDate:        scheduleForm.endDate,
        assignmentType: scheduleForm.assignmentType,
        targetId: scheduleForm.assignmentType === "all"
          ? null
          : scheduleForm.assignmentType === "individual"
          ? (scheduleForm.targetIds[0] ?? null)
          : scheduleForm.targetId,
      };

      const response = await fetch(`${API_URL}/api/shiftschedules/${selectedSchedule.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Schedule updated successfully!");
        setShowEditModal(false);
        setSelectedSchedule(null);
        resetForm();
        await fetchAll();
      } else {
        toast.error(data.message || "Failed to update schedule");
      }
    } catch (error) {
      console.error("Update schedule error:", error);
      toast.error("An error occurred while updating the schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!selectedSchedule) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/shiftschedules/${selectedSchedule.id}?deleteAssignments=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Schedule deleted successfully!");
        setShowDeleteModal(false);
        setSelectedSchedule(null);
        await fetchAll();
      } else {
        toast.error(data.message || "Failed to delete schedule");
      }
    } catch (error) {
      console.error("Delete schedule error:", error);
      toast.error("An error occurred while deleting the schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (schedule) => {
    setSelectedSchedule(schedule);
    const type = schedule.assignmentType || "individual";
    setScheduleForm({
      shiftId: schedule.shiftId.toString(),
      daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [],
      startDate: schedule.startDate,
      endDate: schedule.endDate || "",
      assignmentType: type,
      targetIds: type === "individual" && schedule.targetId ? [schedule.targetId] : [],
      targetId: type === "department" ? (schedule.targetId || "") : "",
    });
    setShowEditModal(true);
  };

  const handleDeleteClick = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDeleteModal(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success("Schedules refreshed");
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      const matchesSearch = searchQuery === "" ||
        schedule.shift?.shiftName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUser = filterUser === "all" || schedule.targetId === filterUser;
      const isActive = schedule.isActive && (!schedule.endDate || schedule.endDate >= new Date().toLocaleDateString("en-CA"));
      const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? isActive : !isActive);
      return matchesSearch && matchesUser && matchesStatus;
    });
  }, [schedules, searchQuery, filterUser, filterStatus]);

  useEffect(() => {
    fetchAll();
    fetchCurrentUserRole();
  }, []);

  if (loading) {
    return (
      <div className="max-w-full mx-auto p-4 lg:px-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-48" />
              </div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-full mx-auto p-4 lg:px-10 space-y-8">
        <Toaster position="top-center" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-8 w-8 text-orange-500" />
              Recurring Schedules
            </h1>
            <p className="text-muted-foreground">
              Create and manage recurring shift schedules for employees
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                className={`rounded-none h-9 ${viewMode === "list" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-4 w-4 mr-1.5" />
                List
              </Button>
              <Button
                size="sm"
                variant={viewMode === "calendar" ? "default" : "ghost"}
                className={`rounded-none h-9 ${viewMode === "calendar" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Calendar
              </Button>
            </div>

            {/* List-only actions */}
            {viewMode === "list" && (
              <>
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setUploadScheduleModalOpen(true)} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Weekly Schedule
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload Weekly Schedule</TooltipContent>
                </Tooltip>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Schedule
                </Button>
              </>
            )}
          </div>
        </div>

        {viewMode === "list" && (<>
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.totalSchedules}</div>
              <p className="text-xs text-muted-foreground">Active shift schedules</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeSchedules}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.assignedEmployees}</div>
              <p className="text-xs text-muted-foreground">Unique employees</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Days/Schedule</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {/* BUG 3 FIX: Read avgDaysPerSchedule (matches the API field name) */}
              <div className="text-2xl font-bold text-blue-600">{stats.avgDaysPerSchedule}</div>
              <p className="text-xs text-muted-foreground">Days per week</p>
            </CardContent>
          </Card>
        </div>

        {/* Table Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Table Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search shifts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Filter by Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignments</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.profile?.firstName} {emp.profile?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {[
                { value: "all",      label: "All" },
                { value: "active",   label: "Active" },
                { value: "inactive", label: "Inactive" },
              ].map(opt => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={filterStatus === opt.value ? "default" : "outline"}
                  className={
                    filterStatus === opt.value
                      ? opt.value === "active"
                        ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                        : opt.value === "inactive"
                        ? "bg-gray-500 hover:bg-gray-600 text-white border-gray-500"
                        : "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                      : ""
                  }
                  onClick={() => setFilterStatus(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Schedules Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Shift Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchedules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchQuery || filterUser !== "all" ? "No schedules match your filters" : "No schedules found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSchedules.map((schedule) => {
                      const days = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
                      const user = employees.find(emp => emp.id === schedule.targetId);
                      const department = departments.find(dept => dept.id === schedule.targetId);
                      const isActive = schedule.isActive && (!schedule.endDate || schedule.endDate >= new Date().toLocaleDateString("en-CA"));
                      
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                              </div>
                              <span className="font-medium">{schedule.shift?.shiftName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {days.sort((a, b) => a - b).map(day => (
                                <Badge key={day} variant="secondary" className="text-xs px-2 py-1">
                                  {DAY_DISPLAY[day]}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>{fmtScheduleDate(schedule.startDate)}</TableCell>
                          <TableCell>
                            {schedule.endDate ? fmtScheduleDate(schedule.endDate) : "Ongoing"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {schedule.assignmentType === 'all' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                    <Users className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  </div>
                                  <span className="text-sm font-medium text-green-600 dark:text-green-400">All Employees</span>
                                </div>
                              ) : schedule.assignmentType === 'department' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                    <Building className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                    {department?.name || "Department"}
                                  </span>
                                </div>
                              ) : user ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <span className="text-sm">
                                    {user.profile?.firstName} {user.profile?.lastName}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-gray-100 dark:bg-gray-900/30 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                                  </div>
                                  <span className="text-sm text-gray-500">Unassigned</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                                <CheckCircle className="h-3 w-3" />Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-gray-600">
                                <AlertCircle className="h-3 w-3" />Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => handleEditClick(schedule)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit schedule</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => handleDeleteClick(schedule)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete schedule</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        </>)}

        {viewMode === "calendar" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-500" />
                Calendar View
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SchedulesCalendarView
                employees={employees}
                shifts={shifts}
                token={token}
                API_URL={API_URL}
              />
            </CardContent>
          </Card>
        )}

        {/* Create / Edit Modal */}
        <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedSchedule(null);
            setEmployeeSearch("");
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                  {showEditModal ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                {showEditModal ? "Edit Schedule" : "Create Recurring Schedule"}
              </DialogTitle>
              <DialogDescription>
                {showEditModal ? "Update recurring shift schedule" : "Create a new recurring shift schedule"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Shift Selection */}
              <div className="space-y-2">
                <Label>Shift <span className="text-orange-500">*</span></Label>
                <Select
                  value={scheduleForm.shiftId}
                  onValueChange={(value) => setScheduleForm(prev => ({ ...prev, shiftId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map(shift => (
                      <SelectItem key={shift.id} value={shift.id.toString()}>
                        <span className="font-medium">{shift.shiftName}</span>
                        {shift.startTime && shift.endTime && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {fmtShiftTime(shift.startTime)} – {fmtShiftTime(shift.endTime)}
                            {shiftDuration(shift.startTime, shift.endTime) && ` · ${shiftDuration(shift.startTime, shift.endTime)}`}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Days Selection */}
              <div className="space-y-3">
                <Label>Days <span className="text-orange-500">*</span></Label>
                <div className="grid grid-cols-7 gap-2">
                  {dayOptions.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleDayToggle(day.value)}
                      className={`p-3 rounded-md text-sm font-medium transition-all ${
                        scheduleForm.daysOfWeek.includes(day.value)
                          ? `${day.color} text-white shadow-md`
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date <span className="text-orange-500">*</span></Label>
                  <Input
                    type="date"
                    value={scheduleForm.startDate}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date <span className="text-orange-500">*</span></Label>
                  <Input
                    type="date"
                    value={scheduleForm.endDate}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, endDate: e.target.value }))}
                    min={scheduleForm.startDate}
                  />
                </div>
              </div>

              {/* Assignment Type */}
              <div className="space-y-3">
                <Label>Assignment Type <span className="text-orange-500">*</span></Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                    <input
                      type="radio" name="assignmentType"
                      checked={scheduleForm.assignmentType === "individual"}
                      onChange={() => setScheduleForm(prev => ({ ...prev, assignmentType: "individual", targetIds: [], targetId: "" }))}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <User className="h-4 w-4" />
                    <span className="text-sm">Assign to specific employee(s)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                    <input
                      type="radio" name="assignmentType"
                      checked={scheduleForm.assignmentType === "department"}
                      onChange={() => setScheduleForm(prev => ({ ...prev, assignmentType: "department", targetIds: [], targetId: "" }))}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <Building className="h-4 w-4" />
                    <span className="text-sm">Assign to department</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted">
                    <input
                      type="radio" name="assignmentType"
                      checked={scheduleForm.assignmentType === "all"}
                      onChange={() => setScheduleForm(prev => ({ ...prev, assignmentType: "all", targetIds: [], targetId: "" }))}
                      className="text-orange-500 focus:ring-orange-500"
                    />
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Assign to all employees</span>
                  </label>
                </div>
              </div>

              {/* Conditional Target Selection */}
              {scheduleForm.assignmentType === "individual" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      {showEditModal ? "Assigned Employee" : "Select Employees"}{" "}
                      <span className="text-orange-500">*</span>
                    </Label>
                    {!showEditModal && (
                      <div className="flex items-center gap-2">
                        {scheduleForm.targetIds.length > 0 && (
                          <Badge className="bg-orange-500 text-white text-xs">
                            {scheduleForm.targetIds.length} selected
                          </Badge>
                        )}
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setScheduleForm(prev => ({ ...prev, targetIds: employees.map(e => e.id) }))}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setScheduleForm(prev => ({ ...prev, targetIds: [] }))}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </div>

                  {showEditModal ? (
                    /* Edit mode: single employee select */
                    <Select
                      value={scheduleForm.targetIds[0] ?? ""}
                      onValueChange={(value) => setScheduleForm(prev => ({ ...prev, targetIds: [value] }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.profile?.firstName} {emp.profile?.lastName}
                            <span className="ml-1 text-xs text-muted-foreground">({emp.email})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    /* Create mode: searchable multi-checkbox list */
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search employees..."
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="border rounded-md max-h-52 overflow-y-auto divide-y">
                        {employees
                          .filter(emp => {
                            const name = `${emp.profile?.firstName ?? ""} ${emp.profile?.lastName ?? ""} ${emp.email}`.toLowerCase();
                            return name.includes(employeeSearch.toLowerCase());
                          })
                          .map(emp => {
                            const checked = scheduleForm.targetIds.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setScheduleForm(prev => ({
                                      ...prev,
                                      targetIds: checked
                                        ? prev.targetIds.filter(id => id !== emp.id)
                                        : [...prev.targetIds, emp.id],
                                    }))
                                  }
                                  className="accent-orange-500 h-4 w-4 shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {emp.profile?.firstName} {emp.profile?.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                                </div>
                              </label>
                            );
                          })}
                        {employees.filter(emp => {
                          const name = `${emp.profile?.firstName ?? ""} ${emp.profile?.lastName ?? ""} ${emp.email}`.toLowerCase();
                          return name.includes(employeeSearch.toLowerCase());
                        }).length === 0 && (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            No employees found
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {scheduleForm.assignmentType === "department" && (
                <div className="space-y-2">
                  <Label>Select Department <span className="text-orange-500">*</span></Label>
                  <Select
                    value={scheduleForm.targetId}
                    onValueChange={(value) => setScheduleForm(prev => ({ ...prev, targetId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  This will create shift assignments for the selected days within the date range.
                  If conflicts are detected, you'll be able to choose how to handle them.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setSelectedSchedule(null);
                  setEmployeeSearch("");
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={showEditModal ? handleEditSchedule : () => handleCreateSchedule("check")}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {showEditModal ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    {showEditModal ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    {showEditModal ? "Update Schedule" : "Create Schedule"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Conflict Warning Dialog */}
        {/* BUG 2 FIX: Both resolution buttons now call handleCreateSchedule with the
            correct action string and do NOT re-trigger conflict detection.
            "Skip Conflicts" → action="skip"  → backend skipConflicts=true
            "Replace Existing" → action="replace" → backend replaceConflicts=true   */}
        <Dialog open={showConflictWarning} onOpenChange={setShowConflictWarning}>
          <DialogContent className="sm:max-w-lg">
            <div className="h-1 w-full bg-yellow-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Scheduling Conflicts Detected
              </DialogTitle>
            </DialogHeader>

            {conflictData && (
              <div className="space-y-4">
                <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                    {conflictData.totalConflicts || conflictData.conflicts?.length || 0} employee(s) already have shifts
                    assigned for some of the selected dates.
                  </AlertDescription>
                </Alert>

                <div className="max-h-48 overflow-y-auto space-y-2">
                  {conflictData.conflicts?.slice(0, 5).map((conflict, idx) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded">
                      <p className="font-medium">{conflict.userName || conflict.userEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {conflict.conflictCount || 1} conflict{(conflict.conflictCount || 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                  {conflictData.conflicts?.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ...and {conflictData.conflicts.length - 5} more
                    </p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  How would you like to proceed?
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConflictWarning(false);
                  setConflictData(null);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setShowConflictWarning(false);
                  // action="skip" → sends skipConflicts:true to backend
                  // Backend creates only dates that don't conflict
                  handleCreateSchedule("skip");
                }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Skip Conflicts
              </Button>
              <Button
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => {
                  setShowConflictWarning(false);
                  // action="replace" → sends replaceConflicts:true to backend
                  // Backend deletes conflicting UserShifts then creates all
                  handleCreateSchedule("replace");
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Replacing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Replace Existing
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-md">
            <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Delete Schedule
              </DialogTitle>
            </DialogHeader>
            
            {selectedSchedule && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this schedule? This will also delete all associated shift assignments.
                </p>
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <span className="font-medium">Deleting:</span> {selectedSchedule.shift?.shiftName}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedSchedule(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" disabled={saving} onClick={handleDeleteSchedule}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <UploadWeeklySchedule
          open={uploadScheduleModalOpen}
          onOpenChange={setUploadScheduleModalOpen}
          onImportComplete={fetchAll}
        />
      </div>
    </TooltipProvider>
  );
}