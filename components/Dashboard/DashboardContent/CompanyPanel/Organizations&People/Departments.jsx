"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Trash2, Edit3, Building, Users, AlertCircle, Download, RefreshCw, 
  Filter, FileText, Plus, Search, X, ChevronDown, Check, Briefcase,
  Eye, MoreHorizontal, UserCheck, UserX, Award, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import DataTable from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtMMDDYYYY_hhmma } from "@/lib/dateTimeFormatter";
import TableSkeleton from "@/components/common/TableSkeleton";

export default function Departments() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  
  const [profileData, setProfileData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDeptForm, setCreateDeptForm] = useState({ 
    name: "", 
    supervisorId: "", 
    paidBreak: false 
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDeptForm, setEditDeptForm] = useState({ id: "", name: "", supervisorId: "" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [usersDeptName, setUsersDeptName] = useState("");
  const [supervisorUser, setSupervisorUser] = useState(null);
  const [deptMembers, setDeptMembers] = useState([]);
  
  const [filters, setFilters] = useState({
    supervisors: [],
  });

  const columnOptions = [
    { value: "id", label: "Department ID" },
    { value: "name", label: "Department Name" },
    { value: "supervisor", label: "Supervisor" },
    { value: "userCount", label: "User Count" },
    { value: "createdAt", label: "Created At" },
    { value: "updatedAt", label: "Updated At" },
  ];
  const columnMap = {
    id: "Department ID",
    name: "Department Name",
    supervisor: "Supervisor",
    userCount: "User Count",
    createdAt: "Created At",
    updatedAt: "Updated At",
  };
  const [columnVisibility, setColumnVisibility] = useState(columnOptions.map((o) => o.value));

  const supervisors = allUsers.filter((u) => u.role && u.role.toLowerCase() === "supervisor");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/account/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.company?.id) setProfileData(j.data);
        else toast.error("User profile or company not found.");
      })
      .catch(() => toast.error("Failed to fetch profile."));
  }, [token, API_URL]);

  useEffect(() => {
    if (token && profileData?.company?.id) refreshData();
  }, [token, profileData]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/departments`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (j?.data) setDepartments(j.data);
      else toast.error(j.error || "Failed to fetch departments.");
    } catch {
      toast.error("Failed to fetch departments.");
    }
    setLoading(false);
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/employee?all=1`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (j?.data) setAllUsers(j.data);
      else toast.error("Failed to fetch users.");
    } catch {
      toast.error("Failed to fetch users.");
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchDepartments(), fetchAllUsers()]);
    toast.success("Departments refreshed");
    setRefreshing(false);
  };

  useEffect(() => {
    if (!departments.length) return;
    const map = {};
    departments.forEach((d) => {
      const members = allUsers.filter((u) => u.department && u.department.id === d.id);
      let supExtra = 0;
      if (d.supervisor) {
        const supInMembers = members.some((m) => m.id === d.supervisor.id);
        if (!supInMembers) supExtra = 1;
      }
      map[d.id] = members.length + supExtra;
    });
    setUserCounts(map);
  }, [departments, allUsers]);

  const stats = useMemo(() => {
    const total = departments.length;
    const withSupervisor = departments.filter(d => d.supervisor).length;
    const withoutSupervisor = total - withSupervisor;
    const totalUsers = Object.values(userCounts).reduce((sum, count) => sum + count, 0);
    return { total, withSupervisor, withoutSupervisor, totalUsers };
  }, [departments, userCounts]);

  const processedDepartments = useMemo(() => {
    const withCounts = departments.map((d) => ({
      ...d,
      totalUsers: userCounts[d.id] ?? 0,
      supervisorName: d.supervisor ? `${d.supervisor.profile.firstName || ""} ${d.supervisor.profile.lastName || ""}`.trim() : "",
    }));
    
    let filtered = [...withCounts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(query) ||
        d.supervisorName.toLowerCase().includes(query) ||
        d.id.toLowerCase().includes(query)
      );
    }

    // Supervisor filter
    if (filters.supervisors.length > 0) {
      filtered = filtered.filter(d => d.supervisor && filters.supervisors.includes(d.supervisor.id));
    }

    filtered.sort((a, b) => (a.id < b.id ? -1 : 1));
    return filtered;
  }, [departments, userCounts, filters, searchQuery]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilters({ supervisors: [] });
  };

  const hasActiveFilters = searchQuery || filters.supervisors.length > 0;

  const downloadCSV = async () => {
    if (processedDepartments.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    setExporting(true);
    
    try {
      const { exportDepartmentsCSV } = await import("@/lib/exports/departments");
      const result = await exportDepartmentsCSV({
        data: processedDepartments,
        visibleColumns: columnVisibility,
        columnMap: columnMap,
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
    if (processedDepartments.length === 0) {
      toast.error("No data to export");
      return;
    }
    
    setPdfExporting(true);
    
    try {
      const { exportDepartmentsPDF } = await import("@/lib/exports/departments");
      const result = await exportDepartmentsPDF({
        data: processedDepartments,
        visibleColumns: columnVisibility,
        columnMap: columnMap,
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

  const handleCreateDepartment = async () => {
    if (!createDeptForm.name.trim()) {
      toast.error("Department name is required.");
      return;
    }
    
    setLoading(true);
    
    const payload = { 
      name: createDeptForm.name,
      paidBreak: createDeptForm.paidBreak 
    };
    
    if (createDeptForm.supervisorId && createDeptForm.supervisorId !== "none") {
      payload.supervisorId = createDeptForm.supervisorId;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/departments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success("Department created successfully!");
        setShowCreateModal(false);
        setCreateDeptForm({ name: "", supervisorId: "", paidBreak: false }); // Reset including paidBreak
        fetchDepartments();
      } else {
        toast.error(j.message || "Failed to create department.");
      }
    } catch {
      toast.error("Failed to create department.");
    }
    setLoading(false);
  };
  

  const openEditModal = (dept) => {
    setEditDeptForm({ id: dept.id, name: dept.name, supervisorId: dept.supervisor?.id || "none" });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editDeptForm.name.trim()) {
      toast.error("Department name is required.");
      return;
    }
    setLoading(true);
    const payload = { name: editDeptForm.name };
    if (editDeptForm.supervisorId && editDeptForm.supervisorId !== "none") {
      payload.supervisorId = editDeptForm.supervisorId;
    }
    try {
      const res = await fetch(`${API_URL}/api/departments/update/${editDeptForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success("Department updated successfully!");
        setShowEditModal(false);
        fetchDepartments();
      } else {
        toast.error(j.message || "Failed to update department.");
      }
    } catch {
      toast.error("Failed to update department.");
    }
    setLoading(false);
  };

  const openDeleteModal = (dept) => {
    setDepartmentToDelete(dept);
    setShowDeleteModal(true);
  };

  const confirmDeleteDepartment = async () => {
    if (!departmentToDelete) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/departments/delete/${departmentToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        toast.success("Department deleted successfully!");
        setShowDeleteModal(false);
        setDepartmentToDelete(null);
        fetchDepartments();
      } else {
        const j = await res.json();
        toast.error(j.message || "Failed to delete department.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete department.");
    }
    setLoading(false);
  };

  const openUsersModal = (dept) => {
    setUsersDeptName(dept.name);
    setSupervisorUser(dept.supervisor || null);
    const members = allUsers.filter((u) => u.department && u.department.id === dept.id);
    setDeptMembers(members);
    setShowUsersModal(true);
  };

  const toggleSupervisorFilter = (supId) => {
    setFilters(prev => ({
      ...prev,
      supervisors: prev.supervisors.includes(supId)
        ? prev.supervisors.filter(id => id !== supId)
        : [...prev.supervisors, supId]
    }));
  };

  // DataTable columns
  const columns = [
    {
      key: "name",
      label: "Department",
      render: (name, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <Building className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground font-mono">{row.id}</div>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: "supervisor",
      label: "Supervisor",
      render: (_, row) => {
        if (!row.supervisor) {
          return (
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserX className="h-4 w-4" />
              <span>No supervisor</span>
            </div>
          );
        }
        const name = `${row.supervisor.profile?.firstName || ""} ${row.supervisor.profile?.lastName || ""}`.trim() || row.supervisor.username;
        return (
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            <span className="font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      key: "userCount",
      label: "Members",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <Badge variant="secondary" className="font-medium">
            {userCounts[row.id] || 0}
          </Badge>
        </div>
      ),
      sortable: true,
    },
    {
      key: "createdAt",
      label: "Created",
      render: (date) => (
        <div className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </div>
      ),
      sortable: true,
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (date) => (
        <div className="text-sm text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </div>
      ),
      sortable: true,
    },
  ].filter(col => columnVisibility.includes(col.key));

  // DataTable actions
  const actions = [
    {
      label: "View Members",
      icon: Eye,
      onClick: (department) => openUsersModal(department),
    },
    {
      label: "Edit",
      icon: Edit3,
      onClick: (department) => openEditModal(department),
      className: "text-orange-600 hover:text-orange-700",
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: (department) => openDeleteModal(department),
      className: "text-red-600 hover:text-red-700",
    },
  ];

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Toaster position="top-center" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Departments</h1>
            <p className="text-muted-foreground">Manage organizational structure and teams</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Department
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Departments</CardTitle>
                <Building className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">With Supervisor</CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.withSupervisor}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Without Supervisor</CardTitle>
                <UserX className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.withoutSupervisor}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Controls */}
        <Card className="bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-orange-400" />
                  <Input
                    placeholder="Search by department name, ID, or supervisor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/50 border-orange-200 focus:bg-background focus:border-orange-500 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-2">
                {/* Supervisor Filter */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                      <Filter className="h-4 w-4 mr-2" />
                      Supervisors
                      {filters.supervisors.length > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                          {filters.supervisors.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      <h4 className="font-medium">Filter by Supervisor</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {supervisors.map((sup) => {
                          const name = `${sup.profile?.firstName || ""} ${sup.profile?.lastName || ""}`.trim() || sup.username;
                          return (
                            <div key={sup.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={sup.id}
                                checked={filters.supervisors.includes(sup.id)}
                                onCheckedChange={() => toggleSupervisorFilter(sup.id)}
                              />
                              <label htmlFor={sup.id} className="text-sm cursor-pointer flex-1">
                                {name}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Column Visibility */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
                      <Eye className="h-4 w-4 mr-2" />
                      Columns
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="space-y-2">
                      <h4 className="font-medium">Toggle Columns</h4>
                      <div className="space-y-2">
                        {columnOptions.map((col) => (
                          <div key={col.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={col.value}
                              checked={columnVisibility.includes(col.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setColumnVisibility([...columnVisibility, col.value]);
                                } else {
                                  setColumnVisibility(columnVisibility.filter(v => v !== col.value));
                                }
                              }}
                            />
                            <label htmlFor={col.value} className="text-sm cursor-pointer">
                              {col.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Export Options */}
                <Button
                  variant="outline"
                  onClick={downloadCSV}
                  disabled={exporting}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? "Exporting..." : "CSV"}
                </Button>

                <Button
                  variant="outline"
                  onClick={downloadPDF}
                  disabled={pdfExporting}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {pdfExporting ? "Exporting..." : "PDF"}
                </Button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    onClick={clearAllFilters}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-orange-600" />
              <CardTitle>Departments</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <DataTable
              data={processedDepartments}
              columns={columns}
              loading={loading}
              onRefresh={refreshData}
              actions={actions}
              searchPlaceholder="Search departments..."
              onRowClick={(department) => openUsersModal(department)}
              pageSize={10}
            />
          </CardContent>
        </Card>

        {/* Create Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="border-2 dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                  <Plus className="h-5 w-5" />
                </div>
                Create New Department
              </DialogTitle>
              <DialogDescription>Add a new department to your organization</DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Department Name */}
              <div className="space-y-2">
                <label htmlFor="create-name" className="text-sm font-medium">
                  Department Name <span className="text-orange-500">*</span>
                </label>
                <Input
                  id="create-name"
                  value={createDeptForm.name}
                  onChange={(e) => setCreateDeptForm({ ...createDeptForm, name: e.target.value })}
                  placeholder="Enter department name"
                />
              </div>
              
              {/* Supervisor Selection */}
              <div className="space-y-2">
                <label htmlFor="create-supervisor" className="text-sm font-medium">
                  Supervisor
                </label>
                <Select
                  value={createDeptForm.supervisorId}
                  onValueChange={(v) => setCreateDeptForm({ ...createDeptForm, supervisorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supervisor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Supervisor</SelectItem>
                    {supervisors.map((sup) => {
                      const name = `${sup.profile.firstName || ""} ${sup.profile.lastName || ""}`.trim() || sup.username;
                      return (
                        <SelectItem key={sup.id} value={sup.id}>
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Paid Break Lunch Policy */}
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-orange-500" />
                    Lunch Break Policy
                  </label>
                  
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Paid Lunch Breaks</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enable if employees in this department are paid during lunch breaks
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateDeptForm({ ...createDeptForm, paidBreak: !createDeptForm.paidBreak })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                          createDeptForm.paidBreak ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            createDeptForm.paidBreak ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`text-sm font-medium ${
                        createDeptForm.paidBreak ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {createDeptForm.paidBreak ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Help Information */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-blue-900 dark:text-blue-100">
                        How Department Lunch Break Policy Works
                      </h4>
                      <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                        <li>• <strong>Paid Breaks:</strong> Employees in this department are paid during lunch breaks</li>
                        <li>• <strong>Unpaid Breaks:</strong> Lunch time is deducted from employee pay calculations</li>
                        <li>• Changes are applied immediately and affect future payroll calculations</li>
                        <li>• Each department can have different lunch break policies</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateDeptForm({ name: "", supervisorId: "", paidBreak: false }); // Reset form
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateDepartment}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? "Creating…" : "Create Department"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="border-2 dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                  <Edit3 className="h-5 w-5" />
                </div>
                Edit Department
              </DialogTitle>
              <DialogDescription>Update department information</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label htmlFor="edit-name" className="text-sm font-medium">
                  Department Name <span className="text-orange-500">*</span>
                </label>
                <Input
                  id="edit-name"
                  value={editDeptForm.name}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, name: e.target.value })}
                  placeholder="Enter department name"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="edit-supervisor" className="text-sm font-medium">
                  Supervisor
                </label>
                <Select
                  value={editDeptForm.supervisorId}
                  onValueChange={(v) => setEditDeptForm({ ...editDeptForm, supervisorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supervisor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Supervisor</SelectItem>
                    {supervisors.map((sup) => {
                      const name = `${sup.profile.firstName || ""} ${sup.profile.lastName || ""}`.trim() || sup.username;
                      return (
                        <SelectItem key={sup.id} value={sup.id}>
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
                {loading ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-md border-2 border-red-200 dark:border-red-800/50">
            <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                Delete Department
              </DialogTitle>
              <DialogDescription>Are you sure you want to delete this department? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 my-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                Deleting a department will remove it from your organization structure. Any users assigned to this department may need to be reassigned.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteDepartment} disabled={loading}>
                {loading ? "Deleting…" : "Delete Department"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Users Modal */}
        <Dialog open={showUsersModal} onOpenChange={setShowUsersModal}>
          <DialogContent className="max-w-2xl border-2 dark:border-white/10">
            <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                Users in "{usersDeptName}"
              </DialogTitle>
              <DialogDescription>
                {supervisorUser ? "Supervisor and members" : "Department members"}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supervisorUser && (
                    <TableRow className="bg-orange-50 dark:bg-orange-950/20">
                      <TableCell className="font-medium">
                        {`${supervisorUser.profile.firstName || ""} ${supervisorUser.profile.lastName || ""}`.trim()}
                      </TableCell>
                      <TableCell>{supervisorUser.email}</TableCell>
                      <TableCell>
                        <Badge className="bg-orange-500 text-white">Supervisor</Badge>
                      </TableCell>
                    </TableRow>
                  )}
                  {deptMembers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{`${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim()}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!supervisorUser && !deptMembers.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-32">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Users className="h-8 w-8 mb-2 opacity-50" />
                          <p>No users in this department</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => setShowUsersModal(false)} className="bg-orange-500 hover:bg-orange-600 text-white">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}