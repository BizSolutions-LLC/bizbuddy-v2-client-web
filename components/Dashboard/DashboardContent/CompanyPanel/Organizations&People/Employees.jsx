"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Trash2,
  Edit,
  Users,
  AlertCircle,
  UserPlus,
  Building,
  User,
  UserCog,
  Download,
  UploadCloud,
  Info,
  FileText,
  Eye,
  EyeOff,
  Badge as BadgeIcon,
  Briefcase,
  MapPin,
  Calendar,
  Clock,
  UserCheck,
  Loader2,
  CalendarDays,
  CheckSquare,
  Square,
  Car,
} from "lucide-react";
import Papa from "papaparse";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import ColumnSelector from "@/components/common/ColumnSelector";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { DeleteEmployeeModal } from "./DeleteEmployeeModal";

const val = (v) => (v?.trim() ? v.trim() : undefined);

const headerMap = {
  id: "Employee ID",
  employeeId: "Company Employee ID",
  name: "Name",
  email: "Email",
  role: "Role",
  department: "Department",
  hireDate: "Hire Date",
  jobTitle: "Job Title",
  employmentStatus: "Employment Status",
  exemptStatus: "Exempt Status",
  employmentType: "Employment Type",
  workLocation: "Work Location",
  probationEndDate: "Probation End Date",
  timeZone: "Time Zone",
  supervisor: "Supervisor Email",
  createdAt: "Created At",
  updatedAt: "Updated At",
};

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const CSV_TEMPLATE = `firstName,lastName,email,password,role,departmentId,employeeId,hireDate,jobTitle,employmentStatus,exemptStatus,employmentType,workLocation,probationEndDate,timeZone
John,Doe,john.doe@example.com,Pa55word!,employee,,EMP001,2025-06-19,Engineer,full_time,exempt,employee_W2,onsite,2025-12-19,America/Los_Angeles
Jane,Smith,jane.smith@example.com,S3cret12,supervisor,,EMP002,2025-06-20,Designer,part_time,non_exempt,contractor_1099,remote,,Asia/Manila
`;

const DAYCARE_COMPANY_IDS = (process.env.NEXT_PUBLIC_DAYCARE_COMPANY_IDS || "")
  .split(",").map((id) => id.trim()).filter(Boolean);

export default function ModernEmployees() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [companyId, setCompanyId] = useState(null);
  const isDayCare = companyId ? DAYCARE_COMPANY_IDS.includes(companyId) : false;

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState({ total: 0, success: 0, failed: [], processed: 0 });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);

  // Details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const blankEmployment = {
    jobTitle: "",
    employmentStatus: "none",
    exemptStatus: "none",
    employmentType: "none",
    workLocation: "none",
    probationEndDate: "",
    timeZone: "",
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "employee",
    departmentId: "none",
    employeeId: "",
    hireDate: "",
    ...blankEmployment,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const [pageSize, setPageSize] = useState(10);
  const [showAllRows, setShowAllRows] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "employee",
    status: "active",
    departmentId: "none",
    employeeId: "",
    hireDate: "",
    jobTitle: "",
    employmentStatus: "none",
    exemptStatus: "none",
    employmentType: "none",
    workLocation: "none",
    probationEndDate: "",
    timeZone: "",
    isDriver: false,
  });
  const [editLoading, setEditLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [editOriginalDeptId, setEditOriginalDeptId] = useState(null);
  const [scheduleInheritModal, setScheduleInheritModal] = useState({
    open: false,
    employeeId: null,
    employeeName: "",
    departmentName: "",
    schedules: [],
    selectedIds: [],
    applying: false,
  });

  const columnOptions = [
    { value: "id", label: "Employee ID" },
    { value: "employeeId", label: "Company Employee ID" },
    { value: "name", label: "Name" },
    { value: "email", label: "Email" },
    { value: "role", label: "Role" },
    { value: "department", label: "Department" },
    { value: "hireDate", label: "Hire Date" },
    { value: "jobTitle", label: "Job Title" },
    { value: "employmentStatus", label: "Employment Status" },
    { value: "exemptStatus", label: "Exempt Status" },
    { value: "employmentType", label: "Employment Type" },
    { value: "workLocation", label: "Work Location" },
    { value: "probationEndDate", label: "Probation End Date" },
    { value: "timeZone", label: "Time Zone" },
    { value: "supervisor", label: "Supervisor Email" },
    { value: "createdAt", label: "Created At" },
    { value: "updatedAt", label: "Updated At" },
  ];
  
  const [visibleCols, setVisibleCols] = useState([
    "employeeId",
    "name", 
    "email", 
    "role", 
    "department", 
    "hireDate",
    "jobTitle"
  ]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter(e => e.employmentDetail?.employmentStatus === "full_time" || e.employmentDetail?.employmentStatus === "part_time").length;
    const departments = [...new Set(employees.map(e => e.department?.name).filter(Boolean))].length;
    const supervisors = employees.filter(e => e.role === "supervisor").length;
    return { total, active, departments, supervisors };
  }, [employees]);

  // Transform employees for DataTable
  const processedEmployees = useMemo(() => {
    return employees.map(emp => {
      // Priority: Direct supervisor > Department supervisor > None
      const directSupervisor = emp.employmentDetail?.supervisor;
      const deptSupervisor = emp.department?.supervisor;
      const effectiveSupervisor = directSupervisor || deptSupervisor;
      
      const supervisorName = effectiveSupervisor?.profile 
        ? `${effectiveSupervisor.profile.firstName} ${effectiveSupervisor.profile.lastName}`.trim()
        : null;
      
      return {
        ...emp,
        fullName: `${emp.profile?.firstName || ""} ${emp.profile?.lastName || ""}`.trim(),
        departmentName: emp.department?.name || "No Department Assigned",
        supervisorEmail: effectiveSupervisor?.email || "—",
        supervisorName: supervisorName || "—",
        supervisorType: directSupervisor ? "direct" : deptSupervisor ? "department" : "none",
        hireDate: emp.hireDate,
        isDriver: emp.employmentDetail?.isDriver ?? false,
        jobTitle: emp.employmentDetail?.jobTitle || "—",
        employmentStatus: emp.employmentDetail?.employmentStatus || "—",
        exemptStatus: emp.employmentDetail?.exemptStatus || "—",
        employmentType: emp.employmentDetail?.employmentType || "—",
        workLocation: emp.employmentDetail?.workLocation || "—",
        probationEndDate: emp.employmentDetail?.probationEndDate,
        timeZone: emp.employmentDetail?.timeZone || "—",
      };
    });
  }, [employees]);

  // DataTable columns
  const columns = [
    {
      key: "employeeId",
      label: "Employee ID",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <BadgeIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="font-medium">{row.employeeId || "—"}</div> 
            <div className="text-xs text-muted-foreground font-mono">{row.id}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: "name",
      label: "Name",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="font-medium flex items-center gap-1.5">
              {row.fullName || "—"}
              {row.isDriver && <Car className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            </div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: "role",
      label: "Role",
      render: (role) => {
        const roleColors = {
          admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          supervisor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          employee: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        };
        return (
          <Badge variant="secondary" className={`${roleColors[role] || "bg-gray-100 text-gray-800"} capitalize`}>
            {role}
          </Badge>
        );
      },
      sortable: true,
    },
    {
      key: "department",
      label: "Department",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-orange-600" />
          <span className={row.departmentName === "No Department Assigned" ? "text-muted-foreground italic" : "font-medium"}>
            {row.departmentName}
          </span>
        </div>
      ),
    },
    {
      key: "hireDate",
      label: "Hire Date",
      render: (date) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-sm">{date ? new Date(date).toLocaleDateString() : "—"}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "jobTitle",
      label: "Job Title",
      render: (title) => (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-purple-600" />
          <span className="text-sm">{title}</span>
        </div>
      ),
    },
    {
      key: "workLocation",
      label: "Work Location",
      render: (location) => {
        const locationColors = {
          onsite: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          remote: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          hybrid: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
        };
        if (location === "—" || location === "none") {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <Badge variant="secondary" className={`${locationColors[location] || "bg-gray-100 text-gray-800"} capitalize`}>
            <MapPin className="h-3 w-3 mr-1" />
            {location === "onsite" ? "On-site" : location}
          </Badge>
        );
      },
    },
    {
      key: "employmentStatus",
      label: "Status",
      render: (status) => {
        const statusColors = {
          full_time: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          part_time: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          contract: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        };
        if (status === "—" || status === "none") {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <Badge variant="secondary" className={`${statusColors[status] || "bg-gray-100 text-gray-800"} capitalize`}>
            {status.replace("_", " ")}
          </Badge>
        );
      },
    },
  ].filter(col => visibleCols.includes(col.key));

  // DataTable actions
  const actions = [
    {
      label: "View Details",
      icon: Eye,
      onClick: (employee) => openDetailsModal(employee),
    },
    {
      label: "Edit",
      icon: Edit,
      onClick: (employee) => openEditModal(employee),
      className: "text-orange-600 hover:text-orange-700",
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: (employee) => openDeleteModal(employee),
      className: "text-red-600 hover:text-red-700",
    },
  ];

  useEffect(() => {
    if (!token) return;
    fetchEmployees();
    fetchDepartments();
    fetch(`${API}/api/company/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => { if (j.data?.id) setCompanyId(j.data.id); })
      .catch(() => {});
  }, [token]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/employee`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok && j?.data) setEmployees(j.data);
      else toast.error(j.message || "Failed to fetch employees.");
    } catch {
      toast.error("Failed to fetch employees.");
    }
    setLoading(false);
  };

  const fetchDepartments = async () => {
    try {
      const r = await fetch(`${API}/api/departments`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok && j?.data) setDepartments(j.data);
      else toast.error("Failed to fetch departments.");
    } catch {
      toast.error("Failed to fetch departments.");
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchDepartments()]);
    toast.success("Data refreshed");
    setRefreshing(false);
  };

  const fetchApplicableSchedules = async (departmentId) => {
    try {
      const r = await fetch(`${API}/api/shiftschedules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (!r.ok) return [];
      const now = new Date();
      return (j.data || []).filter((s) => {
        const isActive = s.isActive && (!s.endDate || new Date(s.endDate) >= now);
        const appliesToEmployee =
          s.assignmentType === "all" ||
          (s.assignmentType === "department" && s.targetId === departmentId);
        return isActive && appliesToEmployee;
      });
    } catch {
      return [];
    }
  };

  const openScheduleInheritModal = async (employeeId, employeeName, departmentId) => {
    const schedules = await fetchApplicableSchedules(departmentId);
    if (schedules.length === 0) {
      fetchEmployees();
      return;
    }
    const dept = departments.find((d) => d.id === departmentId);
    setScheduleInheritModal({
      open: true,
      employeeId,
      employeeName,
      departmentName: dept?.name || "this department",
      schedules,
      selectedIds: schedules.map((s) => s.id),
      applying: false,
    });
  };

  const handleApplySchedules = async () => {
    setScheduleInheritModal((m) => ({ ...m, applying: true }));
    const { employeeId, selectedIds } = scheduleInheritModal;
    let applied = 0;
    for (const scheduleId of selectedIds) {
      try {
        const r = await fetch(`${API}/api/shiftschedules/${scheduleId}/apply-to-employee`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ employeeId }),
        });
        if (r.ok) applied++;
      } catch {}
    }
    toast.success(`${applied} schedule(s) applied successfully`);
    setScheduleInheritModal({ open: false, employeeId: null, employeeName: "", departmentName: "", schedules: [], selectedIds: [], applying: false });
    fetchEmployees();
  };

  // CRUD Operations (preserving original logic)
  const handleCreateEmployee = async () => {
    const { firstName, lastName, email, password, role, departmentId, employeeId, hireDate, ...employment } = createForm;
    
    if (!val(firstName) || !val(lastName) || !val(email) || !val(password)) {
      toast.error("First name, last name, email, and password are required.");
      return;
    }

    setCreateLoading(true);
    const payload = {
      firstName: val(firstName),
      lastName: val(lastName),
      email: val(email),
      password: val(password),
      role,
      departmentId: departmentId === "none" ? undefined : departmentId,
      employeeId: val(employeeId),
      hireDate: val(hireDate),
      ...Object.fromEntries(Object.entries(employment).map(([k, v]) => [k, v === "none" ? undefined : val(v)])),
    };

    try {
      const r = await fetch(`${API}/api/employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Employee created successfully!");
        const newEmployeeId = j.data?.id;
        const newEmployeeName = `${val(firstName)} ${val(lastName)}`;
        const deptId = departmentId === "none" ? null : departmentId;
        setShowCreateModal(false);
        setCreateForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          role: "employee",
          departmentId: "none",
          employeeId: "",
          hireDate: "",
          ...blankEmployment,
        });
        if (deptId && newEmployeeId) {
          await openScheduleInheritModal(newEmployeeId, newEmployeeName, deptId);
        } else {
          fetchEmployees();
        }
      } else {
        toast.error(j.message || "Failed to create employee.");
      }
    } catch {
      toast.error("Failed to create employee.");
    }
    setCreateLoading(false);
  };

  const openEditModal = (employee) => {
    setEditOriginalDeptId(employee.department?.id || "none");
    setEditForm({
      id: employee.id,
      firstName: employee.profile?.firstName || "",
      lastName: employee.profile?.lastName || "",
      email: employee.email || "",
      password: "",
      role: employee.role || "employee",
      status: employee.status || "active",
      departmentId: employee.department?.id || "none",
      employeeId: employee.employeeId || "",
      hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : "",
      jobTitle: employee.employmentDetail?.jobTitle || "",
      employmentStatus: employee.employmentDetail?.employmentStatus || "none",
      exemptStatus: employee.employmentDetail?.exemptStatus || "none",
      employmentType: employee.employmentDetail?.employmentType || "none",
      workLocation: employee.employmentDetail?.workLocation || "none",
      probationEndDate: employee.employmentDetail?.probationEndDate ? employee.employmentDetail.probationEndDate.split('T')[0] : "",
      timeZone: employee.employmentDetail?.timeZone || "",
      isDriver: employee.employmentDetail?.isDriver ?? false,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const { id, firstName, lastName, email, password, role, status, departmentId, employeeId, hireDate, isDriver, ...employment } = editForm;
    
    if (!val(firstName) || !val(lastName) || !val(email)) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    setEditLoading(true);
    const payload = {
      firstName: val(firstName),
      lastName: val(lastName),
      email: val(email),
      role,
      status,
      departmentId: departmentId === "none" ? undefined : departmentId,
      employeeId: val(employeeId),
      hireDate: val(hireDate),
      ...Object.fromEntries(Object.entries(employment).map(([k, v]) => [k, v === "none" ? undefined : val(v)])),
      ...(isDayCare && { isDriver }),
    };

    if (val(password)) payload.password = val(password);

    try {
      const r = await fetch(`${API}/api/employee/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success("Employee updated successfully!");
        const deptChanged = departmentId !== "none" && departmentId !== editOriginalDeptId;
        const empName = `${val(firstName)} ${val(lastName)}`;
        setShowEditModal(false);
        if (deptChanged) {
          await openScheduleInheritModal(id, empName, departmentId);
        } else {
          fetchEmployees();
        }
      } else {
        toast.error(j.message || "Failed to update employee.");
      }
    } catch {
      toast.error("Failed to update employee.");
    }
    setEditLoading(false);
  };

  const openDeleteModal = (employee) => {
    setEmployeeToDelete(employee);
    setDeleteConfirmText("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setDeleteLoading(true);
    try {
      const r = await fetch(`${API}/api/employee/${employeeToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast.success("Employee deleted successfully!");
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        setDeleteConfirmText("");
        fetchEmployees();
      } else {
        const j = await r.json();
        toast.error(j.message || "Failed to delete employee.");
      }
    } catch {
      toast.error("Failed to delete employee.");
    }
    setDeleteLoading(false);
  };

  const openDetailsModal = (employee) => {
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  // Export functions (preserving original logic)
  const downloadCSV = async () => {
    if (processedEmployees.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    setExporting(true);
    
    try {
      const { exportEmployeesCSV } = await import("@/lib/exports/employees");
      const result = await exportEmployeesCSV({
        data: processedEmployees,
        visibleColumns: visibleCols,
        columnMap: headerMap,
      });
      
      if (result.success) {
        toast.success(`${result.filename}`);
      }
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const downloadPDF = async () => {
    if (processedEmployees.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    setPdfExporting(true);
    
    try {
      const { exportEmployeesPDF } = await import("@/lib/exports/employees");
      const result = await exportEmployeesPDF({
        data: processedEmployees,
        visibleColumns: visibleCols,
        columnMap: headerMap,
      });
      
      if (result.success) {
        toast.success(`${result.filename}`);
      }
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setPdfExporting(false);
    }
  };

  // Import functions — uses POST /api/employee/bulk (max 100 per request)
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;

        if (rows.length === 0) {
          toast.error("CSV file is empty.");
          return;
        }

        if (rows.length > 100) {
          toast.error("Maximum 100 employees per import. Please split your CSV into batches of 100.");
          return;
        }

        const requiredFields = ["firstName", "lastName", "email", "password"];
        const headers = Object.keys(rows[0] || {});
        const missingFields = requiredFields.filter((f) => !headers.includes(f));
        if (missingFields.length > 0) {
          toast.error(`CSV is missing required columns: ${missingFields.join(", ")}`);
          return;
        }

        setImporting(true);
        setImportReport({ total: rows.length, success: 0, failed: [], processed: 0 });
        setShowImportDialog(true);

        const employees = rows.map((row) => ({
          firstName: val(row.firstName),
          lastName: val(row.lastName),
          email: val(row.email),
          password: val(row.password),
          role: row.role || "employee",
          departmentId: val(row.departmentId),
          employeeId: val(row.employeeId),
          hireDate: val(row.hireDate),
          jobTitle: val(row.jobTitle),
          employmentStatus: val(row.employmentStatus),
          exemptStatus: val(row.exemptStatus),
          employmentType: val(row.employmentType),
          workLocation: val(row.workLocation),
          probationEndDate: val(row.probationEndDate),
          timeZone: val(row.timeZone),
        }));

        try {
          const r = await fetch(`${API}/api/employee/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ employees }),
          });

          const j = await r.json();

          const created = j.created || [];
          const failed  = (j.failed  || []).map((f) => ({
            row: f.index + 1,
            reason: f.reason || "Unknown error",
          }));

          setImportReport({
            total: rows.length,
            success: created.length,
            failed,
            processed: rows.length,
          });
        } catch (err) {
          setImportReport({
            total: rows.length,
            success: 0,
            failed: [{ row: "–", reason: err.message || "Network error" }],
            processed: rows.length,
          });
        }

        setImporting(false);
        fetchEmployees();
      },
    });
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Toaster position="top-center" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Company Employees</h1>
            <p className="text-muted-foreground">Manage your workforce and employee information</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              onClick={() => setShowInfoDialog(true)}
              className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
            >
              <Info className="h-4 w-4 mr-2" />
              Import Guide
            </Button>
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Employees</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
                <Building className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.departments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Supervisors</CardTitle>
                <UserCog className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.supervisors}</div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Controls */}
        <Card className="bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left side - Column & Export controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <ColumnSelector
                  options={columnOptions}
                  visible={visibleCols}
                  setVisible={setVisibleCols}
                />
                
                {/* Export Options */}
                <Button
                  variant="outline"
                  onClick={downloadCSV}
                  disabled={exporting}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? "Exporting..." : "CSV"}
                </Button>

                <Button
                  variant="outline"
                  onClick={downloadPDF}
                  disabled={pdfExporting}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {pdfExporting ? "Exporting..." : "PDF"}
                </Button>
              </div>

              {/* Right side - Page size selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
                <Select 
                  value={showAllRows ? "all" : pageSize.toString()} 
                  onValueChange={(value) => {
                    if (value === "all") {
                      setShowAllRows(true);
                    } else {
                      setShowAllRows(false);
                      setPageSize(parseInt(value));
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="all">All ({processedEmployees.length})</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground italic">
                  Exports include all {processedEmployees.length} rows
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-600" />
              <CardTitle>Employees ({processedEmployees.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              data={processedEmployees}
              columns={columns}
              loading={loading}
              onRefresh={refreshData}
              actions={actions}
              searchPlaceholder="Search employees by name, email, or ID..."
              onRowClick={(employee) => openDetailsModal(employee)}
              pageSize={showAllRows ? processedEmployees.length : pageSize}
            />
          </CardContent>
        </Card>

        {/* Create Employee Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                Add New Employee
              </DialogTitle>
              <DialogDescription>Create a new employee account with profile and employment details</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name <span className="text-orange-500">*</span></label>
                    <Input
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name <span className="text-orange-500">*</span></label>
                    <Input
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email <span className="text-orange-500">*</span></label>
                    <Input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      placeholder="john.doe@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password <span className="text-orange-500">*</span></label>
                    <div className="relative">
                      <Input
                        type={showCreatePassword ? "text" : "password"}
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        placeholder="Secure password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                      >
                        {showCreatePassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Select value={createForm.departmentId} onValueChange={(v) => setCreateForm({ ...createForm, departmentId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Department</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Employment Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employee ID</label>
                    <Input
                      value={createForm.employeeId}
                      onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                      placeholder="EMP001"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hire Date</label>
                    <Input
                      type="date"
                      value={createForm.hireDate}
                      onChange={(e) => setCreateForm({ ...createForm, hireDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Title</label>
                    <Input
                      value={createForm.jobTitle}
                      onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
                      placeholder="Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employment Status</label>
                    <Select value={createForm.employmentStatus} onValueChange={(v) => setCreateForm({ ...createForm, employmentStatus: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="full_time">Full-time</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Work Location</label>
                    <Select value={createForm.workLocation} onValueChange={(v) => setCreateForm({ ...createForm, workLocation: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="onsite">On-site</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Employment Type</label>
                    <Select value={createForm.employmentType} onValueChange={(v) => setCreateForm({ ...createForm, employmentType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="employee_W2">W-2 Employee</SelectItem>
                        <SelectItem value="contractor_1099">1099 Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Exempt Status</label>
                    <Select value={createForm.exemptStatus} onValueChange={(v) => setCreateForm({ ...createForm, exemptStatus: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="exempt">Exempt</SelectItem>
                        <SelectItem value="non_exempt">Non-exempt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Probation End Date</label>
                    <Input
                      type="date"
                      value={createForm.probationEndDate}
                      onChange={(e) => setCreateForm({ ...createForm, probationEndDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Zone</label>
                  <Input
                    value={createForm.timeZone}
                    onChange={(e) => setCreateForm({ ...createForm, timeZone: e.target.value })}
                    placeholder="e.g., America/Los_Angeles"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateEmployee}
                disabled={createLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {createLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Employee
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Employee Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                  <Edit className="h-5 w-5" />
                </div>
                Edit Employee
              </DialogTitle>
              <DialogDescription>Update employee information and employment details</DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="grid gap-6 py-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">First Name <span className="text-orange-500">*</span></label>
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Last Name <span className="text-orange-500">*</span></label>
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email <span className="text-orange-500">*</span></label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New Password (optional)</label>
                      <Input
                        type="password"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        placeholder="Leave blank to keep current"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Department</label>
                      <Select value={editForm.departmentId} onValueChange={(v) => setEditForm({ ...editForm, departmentId: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Department</SelectItem>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {isDayCare && (
                  <div className="pt-2 border-t dark:border-white/10">
                    <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-3">DayCare Settings</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Driver Schedule</p>
                        <p className="text-xs text-muted-foreground">Employee follows a driver shift — punch type is auto-assigned at shift boundaries</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={editForm.isDriver}
                        onClick={() => setEditForm({ ...editForm, isDriver: !editForm.isDriver })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${editForm.isDriver ? "bg-orange-500" : "bg-gray-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.isDriver ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Employment Details */}
                <div className="space-y-4 pt-4 border-t dark:border-white/10">
                  <h3 className="text-lg font-medium flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-purple-600" />
                    Employment Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Employee ID</label>
                      <Input
                        value={editForm.employeeId}
                        onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                        placeholder="e.g., EMP001"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Hire Date</label>
                      <Input
                        type="date"
                        value={editForm.hireDate}
                        onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Job Title</label>
                      <Input
                        value={editForm.jobTitle}
                        onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                        placeholder="e.g., Software Engineer"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Employment Status</label>
                      <Select value={editForm.employmentStatus} onValueChange={(v) => setEditForm({ ...editForm, employmentStatus: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="full_time">Full-time</SelectItem>
                          <SelectItem value="part_time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Exempt Status</label>
                      <Select value={editForm.exemptStatus} onValueChange={(v) => setEditForm({ ...editForm, exemptStatus: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="exempt">Exempt</SelectItem>
                          <SelectItem value="non_exempt">Non-exempt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Employment Type</label>
                      <Select value={editForm.employmentType} onValueChange={(v) => setEditForm({ ...editForm, employmentType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="employee_W2">W-2 Employee</SelectItem>
                          <SelectItem value="contractor_1099">1099 Contractor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Work Location</label>
                      <Select value={editForm.workLocation} onValueChange={(v) => setEditForm({ ...editForm, workLocation: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="onsite">On-site</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Probation End Date</label>
                      <Input
                        type="date"
                        value={editForm.probationEndDate}
                        onChange={(e) => setEditForm({ ...editForm, probationEndDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Time Zone</label>
                    <Input
                      value={editForm.timeZone}
                      onChange={(e) => setEditForm({ ...editForm, timeZone: e.target.value })}
                      placeholder="e.g., America/Los_Angeles"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {editLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update Employee"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DeleteEmployeeModal
          open={showDeleteModal}
          onOpenChange={(open) => {
            setShowDeleteModal(open);
            if (!open) setDeleteConfirmText("");
          }}
          employee={employeeToDelete}
          deleteConfirmText={deleteConfirmText}
          setDeleteConfirmText={setDeleteConfirmText}
          deleteLoading={deleteLoading}
          onConfirm={confirmDelete}
        />

        {/* Employee Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-orange-500" />
                Employee Details
              </DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-6 pr-4">
                  {/* Account Information */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      Account Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Full Name:</span>
                        <div className="font-medium flex items-center gap-1.5">
                          {selectedEmployee.fullName || "—"}
                          {selectedEmployee.isDriver && <Car className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Username:</span>
                        <div className="font-medium font-mono text-xs">{selectedEmployee.username || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <div className="font-medium">{selectedEmployee.email}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone Number:</span>
                        <div className="font-medium">{selectedEmployee.profile?.phoneNumber || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Role:</span>
                        <div>
                          <Badge variant="secondary" className="capitalize">
                            {selectedEmployee.role}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <div>
                          <Badge 
                            variant="secondary" 
                            className={selectedEmployee.status === "active" 
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }
                          >
                            {selectedEmployee.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="space-y-3 pt-4 border-t dark:border-white/10">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-purple-600" />
                      Employment Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Employee ID:</span>
                        <div className="font-medium font-mono">{selectedEmployee.employeeId || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hire Date:</span>
                        <div className="font-medium">
                          {selectedEmployee.hireDate ? new Date(selectedEmployee.hireDate).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Job Title:</span>
                        <div className="font-medium">{selectedEmployee.jobTitle}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Department:</span>
                        <div className="font-medium">{selectedEmployee.departmentName}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Supervisor:</span>
                        <div className="font-medium">
                          {(() => {
                            const directSupervisor = selectedEmployee.employmentDetail?.supervisor;
                            const deptSupervisor = selectedEmployee.department?.supervisor;
                            const effectiveSupervisor = directSupervisor || deptSupervisor;
                            
                            if (!effectiveSupervisor) return "—";
                            
                            const name = effectiveSupervisor.profile 
                              ? `${effectiveSupervisor.profile.firstName} ${effectiveSupervisor.profile.lastName}`.trim()
                              : effectiveSupervisor.email;
                            
                            return (
                              <div className="space-y-1">
                                <div>{name}</div>
                                <div className="text-xs text-muted-foreground">{effectiveSupervisor.email}</div>
                                {!directSupervisor && deptSupervisor && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building className="h-3 w-3 mr-1" />
                                    Department Supervisor
                                  </Badge>
                                )}
                                {directSupervisor && (
                                  <Badge variant="outline" className="text-xs">
                                    <User className="h-3 w-3 mr-1" />
                                    Direct Supervisor
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Employment Status:</span>
                        <div className="font-medium capitalize">{selectedEmployee.employmentStatus?.replace("_", " ")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exempt Status:</span>
                        <div className="font-medium capitalize">{selectedEmployee.exemptStatus?.replace("_", " ")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Employment Type:</span>
                        <div className="font-medium">{selectedEmployee.employmentType?.replace("_", " ")}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Work Location:</span>
                        <div className="font-medium capitalize">{selectedEmployee.workLocation}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Work State:</span>
                        <div className="font-medium">{selectedEmployee.employmentDetail?.workState || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time Zone:</span>
                        <div className="font-medium">{selectedEmployee.timeZone}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Probation End Date:</span>
                        <div className="font-medium">
                          {selectedEmployee.probationEndDate 
                            ? new Date(selectedEmployee.probationEndDate).toLocaleDateString() 
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  {(selectedEmployee.profile?.dateOfBirth || 
                    selectedEmployee.profile?.addressLine || 
                    selectedEmployee.profile?.ssnItin) && (
                    <div className="space-y-3 pt-4 border-t dark:border-white/10">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-green-600" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {selectedEmployee.profile?.dateOfBirth && (
                          <div>
                            <span className="text-muted-foreground">Date of Birth:</span>
                            <div className="font-medium">
                              {new Date(selectedEmployee.profile.dateOfBirth).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                        {selectedEmployee.profile?.ssnItin && (
                          <div>
                            <span className="text-muted-foreground">SSN/ITIN:</span>
                            <div className="font-medium font-mono">***-**-{selectedEmployee.profile.ssnItin.slice(-4)}</div>
                          </div>
                        )}
                        {selectedEmployee.profile?.addressLine && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Address:</span>
                            <div className="font-medium">
                              {selectedEmployee.profile.addressLine}
                              {selectedEmployee.profile?.city && `, ${selectedEmployee.profile.city}`}
                              {selectedEmployee.profile?.state && `, ${selectedEmployee.profile.state}`}
                              {selectedEmployee.profile?.postalCode && ` ${selectedEmployee.profile.postalCode}`}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency Contact */}
                  {(selectedEmployee.profile?.emergencyContactName || 
                    selectedEmployee.profile?.emergencyContactPhone) && (
                    <div className="space-y-3 pt-4 border-t dark:border-white/10">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        Emergency Contact
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {selectedEmployee.profile?.emergencyContactName && (
                          <div>
                            <span className="text-muted-foreground">Contact Name:</span>
                            <div className="font-medium">{selectedEmployee.profile.emergencyContactName}</div>
                          </div>
                        )}
                        {selectedEmployee.profile?.emergencyContactPhone && (
                          <div>
                            <span className="text-muted-foreground">Contact Phone:</span>
                            <div className="font-medium">{selectedEmployee.profile.emergencyContactPhone}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* System Information */}
                  <div className="space-y-3 pt-4 border-t dark:border-white/10">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <Clock className="h-5 w-5 text-gray-600" />
                      System Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">User ID:</span>
                        <div className="font-medium font-mono text-xs break-all">{selectedEmployee.id}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Company:</span>
                        <div className="font-medium">{selectedEmployee.company?.name || "—"}</div>
                        <div className="font-mono text-xs text-muted-foreground">{selectedEmployee.company?.id || "—"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Created:</span>
                        <div className="font-medium">{fmt(selectedEmployee.createdAt)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Updated:</span>
                        <div className="font-medium">{fmt(selectedEmployee.updatedAt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
            <DialogFooter>
              <Button onClick={() => setShowDetailsModal(false)} className="bg-orange-500 hover:bg-orange-600 text-white">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-orange-500" />
                CSV Import Summary
              </DialogTitle>
            </DialogHeader>
            {importing ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1 text-sm font-medium">
                  <span>Uploading {importReport.total} employee{importReport.total !== 1 ? "s" : ""}…</span>
                </div>
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full animate-pulse w-full" />
                </div>
                <div className="flex justify-center mt-2">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>
                  Processed <strong>{importReport.total}</strong> rows. Successfully created <strong>{importReport.success}</strong>.
                </p>
                {importReport.failed.length > 0 && (
                  <Card className="mt-4">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-red-500 text-sm">Failed Rows: {importReport.failed.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="max-h-60">
                        <ul className="list-disc pl-5 space-y-1">
                          {importReport.failed.map((f, i) => (
                            <li key={i}>
                              Row {f.row}: {f.reason}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={() => setShowImportDialog(false)}
                disabled={importing}
                className="bg-orange-500 text-white"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Dialog */}
        <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
          <DialogContent className="max-w-lg dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-orange-500" />
                CSV Format Guide
              </DialogTitle>
            </DialogHeader>
            <p className="mb-2 text-sm">
              Your CSV file must include the exact headers below. <em>departmentId</em>, <em>employeeId</em>, <em>hireDate</em>, and
              all employment-detail columns are optional.
            </p>
            <pre className="bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-200 p-4 rounded-md text-sm font-mono overflow-x-auto">{CSV_TEMPLATE}</pre>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "employees_template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download Sample CSV
              </Button>
              <Button onClick={() => setShowInfoDialog(false)} className="bg-orange-500 text-white">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <input type="file" ref={fileRef} accept=".csv" onChange={onFile} className="hidden" />

        {/* Schedule Inherit Modal */}
        <Dialog
          open={scheduleInheritModal.open}
          onOpenChange={(open) => {
            if (!open && !scheduleInheritModal.applying) {
              setScheduleInheritModal((m) => ({ ...m, open: false }));
              fetchEmployees();
            }
          }}
        >
          <DialogContent className="sm:max-w-lg dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-100 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                Apply Department Schedules
              </DialogTitle>
              <DialogDescription>
                <strong>{scheduleInheritModal.employeeName}</strong> was added to{" "}
                <strong>{scheduleInheritModal.departmentName}</strong>. This department has{" "}
                {scheduleInheritModal.schedules.length} active schedule(s). Select which to apply.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Select All / Deselect All */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scheduleInheritModal.selectedIds.length} of {scheduleInheritModal.schedules.length} selected
                </span>
                <button
                  type="button"
                  className="text-orange-500 hover:text-orange-600 font-medium"
                  onClick={() => {
                    const allSelected = scheduleInheritModal.selectedIds.length === scheduleInheritModal.schedules.length;
                    setScheduleInheritModal((m) => ({
                      ...m,
                      selectedIds: allSelected ? [] : m.schedules.map((s) => s.id),
                    }));
                  }}
                >
                  {scheduleInheritModal.selectedIds.length === scheduleInheritModal.schedules.length
                    ? "Deselect all"
                    : "Select all"}
                </button>
              </div>

              {/* Schedule list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scheduleInheritModal.schedules.map((schedule) => {
                  const isSelected = scheduleInheritModal.selectedIds.includes(schedule.id);
                  const days = (Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [])
                    .sort((a, b) => a - b)
                    .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                    .join(", ");
                  const start = schedule.startDate
                    ? new Date(schedule.startDate).toLocaleDateString()
                    : "—";
                  const end = schedule.endDate
                    ? new Date(schedule.endDate).toLocaleDateString()
                    : "Ongoing";
                  return (
                    <button
                      key={schedule.id}
                      type="button"
                      onClick={() =>
                        setScheduleInheritModal((m) => ({
                          ...m,
                          selectedIds: isSelected
                            ? m.selectedIds.filter((id) => id !== schedule.id)
                            : [...m.selectedIds, schedule.id],
                        }))
                      }
                      className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="mt-0.5 text-orange-500 flex-shrink-0">
                        {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-medium text-sm truncate">{schedule.shift?.shiftName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{days}</p>
                        <p className="text-xs text-muted-foreground">{start} → {end}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                disabled={scheduleInheritModal.applying}
                onClick={() => {
                  setScheduleInheritModal((m) => ({ ...m, open: false }));
                  fetchEmployees();
                }}
              >
                Skip
              </Button>
              <Button
                onClick={handleApplySchedules}
                disabled={scheduleInheritModal.applying || scheduleInheritModal.selectedIds.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {scheduleInheritModal.applying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Applying…
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Apply {scheduleInheritModal.selectedIds.length > 0 ? `(${scheduleInheritModal.selectedIds.length})` : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}