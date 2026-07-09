// components/Dashboard/DashboardContent/CompanyPanel/Shifts&Schedules/Shifts.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  RefreshCw,
  Check,
  Plus,
  Search,
  AlertCircle,
  Info,
  Timer,
  Loader2,
  Globe,
  ChevronsLeft,
  ChevronsRight,
  X,
  Calendar,
  PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const toUtcIso = (hhmm) => {
  // Create naive time directly in UTC - no timezone conversion
  const [h, m] = hhmm.split(":").map(Number);
  const date = new Date(Date.UTC(1970, 0, 1, h, m, 0)); // Use UTC directly
  return date.toISOString();
};

const fmtClock = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

const fmtClockWith12Hour = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC" });


const totalHours = (a, b) => {
  if (!a || !b) return "—";
  let diff = new Date(b) - new Date(a);
  if (diff < 0) diff += 86400000;
  return (diff / 3600000).toFixed(2);
};

// Get timezone abbreviation
const getTimezoneAbbr = (timezone) => {
  try {
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch {
    return '';
  }
};

// Inline style constants
const BOX      = { background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12 };
const TH_STYLE = { fontSize: 11, fontWeight: 500, color: "#888", padding: "8px 12px", borderBottom: "0.5px solid #e5e5e5", background: "#fafaf9", whiteSpace: "nowrap", userSelect: "none" };
const TD_STYLE = { padding: "9px 12px", verticalAlign: "middle" };
const PAGE_BTN = { border: "0.5px solid #e5e5e5", background: "#fff", color: "#888", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit" };

export default function Shifts() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [companyTimezone, setCompanyTimezone] = useState("America/Los_Angeles");
  const [loadingTimezone, setLoadingTimezone] = useState(true);
  const [autoBreakBasis, setAutoBreakBasis] = useState("department");
  const [autoLunchEnabled, setAutoLunchEnabled] = useState(false);
  const [autoCoffeeEnabled, setAutoCoffeeEnabled] = useState(false);
  const [shiftAutoBreakEntitlement, setShiftAutoBreakEntitlement] = useState({});

  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    shiftName: "",
    startTime: "08:00",
    endTime: "17:00",
    differentialMultiplier: "1.0",
    timeZone: "",
  });

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    shiftName: "",
    startTime: "",
    endTime: "",
    differentialMultiplier: "1.0",
    timeZone: "",
    autoLunchEntitled: false,
    autoBreakLunchMinutes: 60,
    autoBreakLunchAfterHours: 5,
    autoBreakLunchDeductible: false,
    autoCoffeeEntitled: false,
    autoBreakCoffeeCount: 2,
    autoBreakCoffeeMinutes: 15,
    autoBreakCoffeeDeductible: false,
  });

  const [showDelete, setShowDelete] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [filters, setFilters] = useState({ name: "" });
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "ascending" });


  // Fetch company timezone
  const fetchCompanyTimezone = async () => {
    setLoadingTimezone(true);
    try {
      const r = await fetch(`${API}/api/company-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await r.json();
      if (r.ok && j.data) {
        setCompanyTimezone(j.data.timezone || "America/Los_Angeles");
        setAutoBreakBasis(j.data.autoBreakBasis || "department");
        setAutoLunchEnabled(j.data.autoLunchEnabled || false);
        setAutoCoffeeEnabled(j.data.autoCoffeeEnabled || false);
      } else {
        setCompanyTimezone("America/Los_Angeles");
      }
    } catch (error) {
      console.error('Failed to fetch company timezone:', error);
      setCompanyTimezone("America/Los_Angeles");
    }
    setLoadingTimezone(false);
  };

  useEffect(() => {
    if (token) {
      fetchCompanyTimezone();
      fetchShifts();
    }
  }, [token]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/shifts`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json();
      if (r.ok) {
        const data = j.data || [];
        setShifts(data);
        const entitlement = {};
        data.forEach((s) => {
          entitlement[s.id] = {
            autoLunchEntitled:        s.autoLunchEntitled        || false,
            autoBreakLunchMinutes:    s.autoBreakLunchMinutes    ?? 60,
            autoBreakLunchAfterHours: s.autoBreakLunchAfterHours ?? 5,
            autoBreakLunchDeductible: s.autoBreakLunchDeductible || false,
            autoCoffeeEntitled:       s.autoCoffeeEntitled       || false,
            autoBreakCoffeeCount:     s.autoBreakCoffeeCount     ?? 2,
            autoBreakCoffeeMinutes:   s.autoBreakCoffeeMinutes   ?? 15,
            autoBreakCoffeeDeductible:s.autoBreakCoffeeDeductible|| false,
          };
        });
        setShiftAutoBreakEntitlement(entitlement);
      } else toast.error(j.message || "Failed to fetch shifts.");
    } catch {
      toast.error("Failed to fetch shifts.");
    }
    setLoading(false);
  };

  const refreshShifts = async () => {
    setRefreshing(true);
    await fetchShifts();
    toast.success("Shifts refreshed successfully");
    setRefreshing(false);
  };


const filteredSorted = useMemo(() => {
    const data = shifts.filter((s) => s.shiftName.toLowerCase().includes(filters.name.toLowerCase()));
    if (sortConfig.key) {
      data.sort((a, b) => {
        const aVal =
          sortConfig.key === "totalHours"
            ? Number(totalHours(a.startTime, a.endTime))
            : sortConfig.key === "differentialMultiplier"
            ? Number(a[sortConfig.key])
            : (a[sortConfig.key] ?? "").toString().toLowerCase();
        const bVal =
          sortConfig.key === "totalHours"
            ? Number(totalHours(b.startTime, b.endTime))
            : sortConfig.key === "differentialMultiplier"
            ? Number(b[sortConfig.key])
            : (b[sortConfig.key] ?? "").toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [shifts, filters, sortConfig]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredSorted.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredSorted.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.name]);

  // Pagination handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPage = (page) => setCurrentPage(Math.min(Math.max(1, page), totalPages));


  const openCreate = () => {
    setCreateForm({ shiftName: "", startTime: "08:00", endTime: "17:00", differentialMultiplier: "1.0" });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!createForm.shiftName.trim()) return toast.error("Shift name is required");
    setActionLoading(true);
    try {
      const payload = {
        shiftName: createForm.shiftName.trim(),
        startTime: createForm.startTime,
        endTime: createForm.endTime,
        differentialMultiplier: parseFloat(createForm.differentialMultiplier),
        timeZone: companyTimezone,
      };
      const r = await fetch(`${API}/api/shifts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.status === 201 || r.status === 200) {
        toast.success(j.message || "Shift template created successfully");
        setShowCreate(false);
        fetchShifts();
      } else toast.error(j.message || "Failed to create shift template");
    } catch {
      toast.error("Failed to create shift template");
    }
    setActionLoading(false);
  };

  const openEdit = (s) => {
    const ab = shiftAutoBreakEntitlement[s.id] || {};
    setEditForm({
      id: s.id,
      shiftName: s.shiftName,
      startTime: fmtClock(s.startTime),
      endTime: fmtClock(s.endTime),
      differentialMultiplier: String(s.differentialMultiplier),
      autoLunchEntitled:        ab.autoLunchEntitled        || false,
      autoBreakLunchMinutes:    ab.autoBreakLunchMinutes    ?? 60,
      autoBreakLunchAfterHours: ab.autoBreakLunchAfterHours ?? 5,
      autoBreakLunchDeductible: ab.autoBreakLunchDeductible || false,
      autoCoffeeEntitled:       ab.autoCoffeeEntitled       || false,
      autoBreakCoffeeCount:     ab.autoBreakCoffeeCount     ?? 2,
      autoBreakCoffeeMinutes:   ab.autoBreakCoffeeMinutes   ?? 15,
      autoBreakCoffeeDeductible:ab.autoBreakCoffeeDeductible|| false,
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.shiftName.trim()) return toast.error("Shift name is required");
    setActionLoading(true);
    try {
      const payload = {
        shiftName: editForm.shiftName.trim(),
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        differentialMultiplier: parseFloat(editForm.differentialMultiplier),
        timeZone: companyTimezone,
        autoLunchEntitled:        editForm.autoLunchEntitled,
        autoBreakLunchMinutes:    editForm.autoBreakLunchMinutes,
        autoBreakLunchAfterHours: editForm.autoBreakLunchAfterHours,
        autoBreakLunchDeductible: editForm.autoBreakLunchDeductible,
        autoCoffeeEntitled:       editForm.autoCoffeeEntitled,
        autoBreakCoffeeCount:     editForm.autoBreakCoffeeCount,
        autoBreakCoffeeMinutes:   editForm.autoBreakCoffeeMinutes,
        autoBreakCoffeeDeductible:editForm.autoBreakCoffeeDeductible,
      };
      const r = await fetch(`${API}/api/shifts/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok) {
        setShiftAutoBreakEntitlement((p) => ({
          ...p,
          [editForm.id]: {
            autoLunchEntitled:        editForm.autoLunchEntitled,
            autoBreakLunchMinutes:    editForm.autoBreakLunchMinutes,
            autoBreakLunchAfterHours: editForm.autoBreakLunchAfterHours,
            autoBreakLunchDeductible: editForm.autoBreakLunchDeductible,
            autoCoffeeEntitled:       editForm.autoCoffeeEntitled,
            autoBreakCoffeeCount:     editForm.autoBreakCoffeeCount,
            autoBreakCoffeeMinutes:   editForm.autoBreakCoffeeMinutes,
            autoBreakCoffeeDeductible:editForm.autoBreakCoffeeDeductible,
          },
        }));
        toast.success(j.message || "Shift template updated successfully");
        setShowEdit(false);
        fetchShifts();
      } else toast.error(j.message || "Failed to update shift template");
    } catch {
      toast.error("Failed to update shift template");
    }
    setActionLoading(false);
  };

  const openDelete = (s) => {
    setShiftToDelete(s);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!shiftToDelete) return;
    setActionLoading(true);
    try {
      const r = await fetch(`${API}/api/shifts/${shiftToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(j.message || "Shift template deleted successfully");
        setShifts((p) => p.filter((x) => x.id !== shiftToDelete.id));
      } else toast.error(j.message || "Failed to delete shift template");
    } catch {
      toast.error("Failed to delete shift template");
    }
    setActionLoading(false);
    setShowDelete(false);
    setShiftToDelete(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 20 }}>
      <Toaster position="top-center" />

      {/* Header */}
      <div style={{ ...BOX, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={18} color="#f97316" />
            Shift Templates
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Manage work shift templates for employee scheduling</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href="/dashboard/company/schedules">
            <button style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "0.5px solid #e5e5e5", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              <Calendar size={13} /> Schedules
            </button>
          </Link>
          <button
            onClick={refreshShifts}
            disabled={refreshing}
            title="Refresh shift templates"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", border: "0.5px solid #e5e5e5", background: "#fff", borderRadius: 8, padding: "6px 8px", cursor: "pointer" }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openCreate}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus size={13} /> Create Shift
          </button>
        </div>
      </div>


      {/* Main table */}
      <div style={{ ...BOX, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} color="#f97316" />
            Shifts
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>{filteredSorted.length} total</div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e5e5e5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", background: "#fff", maxWidth: 320 }}>
            <Search size={12} color="#bbb" />
            <input
              value={filters.name}
              onChange={e => setFilters(p => ({ ...p, name: e.target.value }))}
              placeholder="Search shift templates…"
              style={{ border: "none", outline: "none", fontSize: 12, color: "#1a1a1a", background: "transparent", width: "100%", fontFamily: "inherit" }}
            />
            {filters.name && (
              <button onClick={() => setFilters({ name: "" })} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", display: "flex", alignItems: "center", padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  { label: "Shift Name",    key: "shiftName",              align: "left"   },
                  { label: "Time",          key: null,                     align: "left"   },
                  { label: "Duration",      key: "totalHours",             align: "center" },
                  { label: "Timezone",      key: "timeZone",               align: "center" },
                  { label: "Pay Rate",      key: "differentialMultiplier", align: "center" },
                  { label: "Actions",       key: null,                     align: "right"  },
                ].map((col, i) => (
                  <th
                    key={i}
                    onClick={() => col.key && setSortConfig(p => ({ key: col.key, direction: p.key === col.key && p.direction === "ascending" ? "descending" : "ascending" }))}
                    style={{ ...TH_STYLE, textAlign: col.align, cursor: col.key ? "pointer" : "default" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {col.label}
                      {col.key && sortConfig.key === col.key && (
                        sortConfig.direction === "ascending"
                          ? <ChevronUp size={10} color="#f97316" />
                          : <ChevronDown size={10} color="#f97316" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Loader2 size={22} className="animate-spin" style={{ color: "#f97316" }} />
                    </div>
                  </td>
                </tr>
              ) : currentPageData.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 16px", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Clock size={16} color="#ccc" />
                      </div>
                      <div style={{ fontSize: 13, color: "#888" }}>
                        {filters.name ? "No shifts match your search." : "No shift templates yet."}
                      </div>
                      {!filters.name && (
                        <button
                          onClick={openCreate}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", marginTop: 4, fontFamily: "inherit" }}
                        >
                          <Plus size={12} /> Create First Shift
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : currentPageData.map(s => (
                  <tr
                    key={s.id}
                    style={{ borderBottom: "0.5px solid #e5e5e5" }}
                  >
                    <td style={{ ...TD_STYLE }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.shiftName}</div>
                    </td>
                    <td style={{ ...TD_STYLE, whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>
                        {fmtClock(s.startTime)} → {fmtClock(s.endTime)}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>
                        {fmtClockWith12Hour(s.startTime)} – {fmtClockWith12Hour(s.endTime)}
                      </div>
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, background: "#faeeda", color: "#633806", padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                        {totalHours(s.startTime, s.endTime)}h
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: "center" }}>
                      {s.timeZone ? (
                        <span title={s.timeZone} style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#666", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <Globe size={11} color="#3b82f6" />
                          {getTimezoneAbbr(s.timeZone) || s.timeZone.split("/").pop()}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>Missing</span>
                      )}
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: "center" }}>
                      <span style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "#888" }}>
                        {s.differentialMultiplier}×
                      </span>
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => openEdit(s)}
                        title="Edit shift template"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316", padding: "4px 6px", borderRadius: 6 }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => openDelete(s)}
                        title="Delete shift template"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "4px 6px", borderRadius: 6 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredSorted.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "0.5px solid #e5e5e5", background: "#fafaf9", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <button disabled={currentPage === 1} onClick={goToFirstPage} style={{ ...PAGE_BTN, opacity: currentPage === 1 ? 0.4 : 1 }}>
                <ChevronsLeft size={11} /> First
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  style={{ ...PAGE_BTN, background: currentPage === p ? "#f97316" : "#fff", color: currentPage === p ? "#fff" : "#888", border: `0.5px solid ${currentPage === p ? "#f97316" : "#e5e5e5"}`, fontWeight: currentPage === p ? 500 : 400 }}
                >
                  {p}
                </button>
              ))}
              <button disabled={currentPage === totalPages} onClick={goToLastPage} style={{ ...PAGE_BTN, opacity: currentPage === totalPages ? 0.4 : 1 }}>
                Last <ChevronsRight size={11} />
              </button>
            </div>
            <span style={{ fontSize: 12, color: "#888" }}>
              Page {currentPage} of {totalPages} · {filteredSorted.length} shift{filteredSorted.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600 }}>
              <PlusCircle size={18} color="#f97316" />
              Create New Shift Template
            </DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              Add a new shift template for employee scheduling
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
            {/* Timezone row */}
            {!loadingTimezone && companyTimezone && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "#fff7f0", border: "0.5px solid #fed7aa", borderRadius: 8 }}>
                <Globe size={13} color="#f97316" />
                <span style={{ fontSize: 12, color: "#7c2d12" }}>
                  <strong>Company Timezone:</strong> {companyTimezone}
                  {getTimezoneAbbr(companyTimezone) ? ` (${getTimezoneAbbr(companyTimezone)})` : ""}
                </span>
              </div>
            )}

            {/* Shift name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#444", display: "flex", alignItems: "center", gap: 4 }}>
                Shift Template Name
                <Info size={11} color="#bbb" title="Give your shift a descriptive name like Morning Shift or Night Security" style={{ cursor: "help" }} />
              </label>
              <input
                value={createForm.shiftName}
                onChange={(e) => setCreateForm((p) => ({ ...p, shiftName: e.target.value }))}
                placeholder="e.g., Morning Shift, Night Shift"
                style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#f97316")}
                onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
              />
            </div>

            {/* Start / End time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Start Time", key: "startTime", tip: `When employees begin their shift (${companyTimezone})` },
                { label: "End Time",   key: "endTime",   tip: `When employees finish their shift (${companyTimezone})` },
              ].map(({ label, key, tip }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#444", display: "flex", alignItems: "center", gap: 4 }}>
                    {label}
                    <Info size={11} color="#bbb" title={tip} style={{ cursor: "help" }} />
                  </label>
                  <input
                    type="time"
                    value={createForm[key]}
                    onChange={(e) => setCreateForm((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f97316")}
                    onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
                  />
                </div>
              ))}
            </div>

            {/* Pay rate */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#444", display: "flex", alignItems: "center", gap: 4 }}>
                Pay Rate Multiplier
                <Info size={11} color="#bbb" title="1.0 = normal rate · 1.5 = time and a half · 2.0 = double time" style={{ cursor: "help" }} />
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={createForm.differentialMultiplier}
                onChange={(e) => setCreateForm((p) => ({ ...p, differentialMultiplier: e.target.value }))}
                style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#f97316")}
                onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
              />
            </div>

            {/* Preview */}
            {createForm.startTime && createForm.endTime && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8 }}>
                <Timer size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#166534" }}>
                  <strong>Preview:</strong> {totalHours(toUtcIso(createForm.startTime), toUtcIso(createForm.endTime))} hours
                  {parseFloat(createForm.differentialMultiplier) !== 1.0 && ` · ${createForm.differentialMultiplier}× pay`}
                  {" "}in {companyTimezone}
                </span>
              </div>
            )}
          </div>

          <DialogFooter style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowCreate(false)}
              style={{ border: "0.5px solid #e5e5e5", background: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={actionLoading || !createForm.shiftName.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: actionLoading || !createForm.shiftName.trim() ? "#fdba74" : "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: actionLoading || !createForm.shiftName.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {actionLoading ? (
                <><Loader2 size={13} className="animate-spin" /> Creating…</>
              ) : (
                <><Plus size={13} /> Create Shift</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600 }}>
              <Edit3 size={17} color="#f97316" />
              Edit Shift Template
            </DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              Update shift template information
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
            {/* Timezone row */}
            {!loadingTimezone && companyTimezone && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "#fff7f0", border: "0.5px solid #fed7aa", borderRadius: 8 }}>
                <Globe size={13} color="#f97316" />
                <span style={{ fontSize: 12, color: "#7c2d12" }}>
                  <strong>Company Timezone:</strong> {companyTimezone}
                  {getTimezoneAbbr(companyTimezone) ? ` (${getTimezoneAbbr(companyTimezone)})` : ""}
                </span>
              </div>
            )}

            {/* Shift name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#444" }}>Shift Template Name</label>
              <input
                value={editForm.shiftName}
                onChange={(e) => setEditForm((p) => ({ ...p, shiftName: e.target.value }))}
                placeholder="e.g., Morning Shift, Night Shift"
                style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#f97316")}
                onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
              />
            </div>

            {/* Start / End time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Start Time", key: "startTime" },
                { label: "End Time",   key: "endTime"   },
              ].map(({ label, key }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#444" }}>{label}</label>
                  <input
                    type="time"
                    value={editForm[key]}
                    onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "#f97316")}
                    onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
                  />
                  <span style={{ fontSize: 11, color: "#aaa" }}>Time in {companyTimezone}</span>
                </div>
              ))}
            </div>

            {/* Pay rate */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#444" }}>Pay Rate Multiplier</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={editForm.differentialMultiplier}
                onChange={(e) => setEditForm((p) => ({ ...p, differentialMultiplier: e.target.value }))}
                style={{ height: 36, border: "0.5px solid #d0d0d0", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
                onFocus={e => (e.target.style.borderColor = "#f97316")}
                onBlur={e => (e.target.style.borderColor = "#d0d0d0")}
              />
            </div>

            {/* Preview */}
            {editForm.startTime && editForm.endTime && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: 8 }}>
                <Timer size={13} color="#2563eb" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#1e40af" }}>
                  <strong>Updated Duration:</strong> {totalHours(toUtcIso(editForm.startTime), toUtcIso(editForm.endTime))} hours
                  {parseFloat(editForm.differentialMultiplier) !== 1.0 && ` · ${editForm.differentialMultiplier}× pay`}
                  {" "}in {companyTimezone}
                </span>
              </div>
            )}

            {/* Auto-break config — only shown when company-level features are on and basis is shift */}
            {autoBreakBasis === "shift" && (autoLunchEnabled || autoCoffeeEnabled) && (
              <div className="space-y-3 pt-1">
                <div className="h-px bg-neutral-200 dark:bg-neutral-700" />
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Auto-Break Config</p>

                {/* Auto-Lunch */}
                {autoLunchEnabled && (
                  <div className="border border-green-200 rounded-xl p-3 space-y-3 bg-green-50/40 dark:bg-green-950/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Auto-Lunch Injection
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, autoLunchEntitled: !p.autoLunchEntitled }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${editForm.autoLunchEntitled ? "bg-green-500" : "bg-neutral-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editForm.autoLunchEntitled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                        <span className={`text-xs font-semibold ${editForm.autoLunchEntitled ? "text-green-600" : "text-neutral-500"}`}>
                          {editForm.autoLunchEntitled ? "Entitled" : "Not Entitled"}
                        </span>
                      </div>
                    </div>
                    {editForm.autoLunchEntitled && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Duration (min)</Label>
                          <Input type="number" min="1" value={editForm.autoBreakLunchMinutes}
                            onChange={(e) => setEditForm((p) => ({ ...p, autoBreakLunchMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="h-8 text-sm font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">After (hours)</Label>
                          <Input type="number" min="0.5" step="0.5" value={editForm.autoBreakLunchAfterHours}
                            onChange={(e) => setEditForm((p) => ({ ...p, autoBreakLunchAfterHours: Math.max(0.5, parseFloat(e.target.value) || 0.5) }))}
                            className="h-8 text-sm font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Deductible</Label>
                          <div className="flex items-center gap-2 h-8">
                            <button
                              type="button"
                              onClick={() => setEditForm((p) => ({ ...p, autoBreakLunchDeductible: !p.autoBreakLunchDeductible }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${editForm.autoBreakLunchDeductible ? "bg-red-500" : "bg-green-500"}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editForm.autoBreakLunchDeductible ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                            <span className={`text-[11px] font-semibold ${editForm.autoBreakLunchDeductible ? "text-red-600" : "text-green-600"}`}>
                              {editForm.autoBreakLunchDeductible ? "Deducted" : "Paid"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Preview</Label>
                          <div className="h-8 border rounded-md bg-white flex items-center justify-center font-mono text-[11px] font-semibold text-neutral-700">
                            {editForm.autoBreakLunchMinutes}m after {editForm.autoBreakLunchAfterHours}h
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-Coffee */}
                {autoCoffeeEnabled && (
                  <div className="border border-amber-200 rounded-xl p-3 space-y-3 bg-amber-50/40 dark:bg-amber-950/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                        <Timer className="h-3 w-3" /> Auto-Coffee Injection
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditForm((p) => ({ ...p, autoCoffeeEntitled: !p.autoCoffeeEntitled }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 ${editForm.autoCoffeeEntitled ? "bg-green-500" : "bg-neutral-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editForm.autoCoffeeEntitled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                        <span className={`text-xs font-semibold ${editForm.autoCoffeeEntitled ? "text-green-600" : "text-neutral-500"}`}>
                          {editForm.autoCoffeeEntitled ? "Entitled" : "Not Entitled"}
                        </span>
                      </div>
                    </div>
                    {editForm.autoCoffeeEntitled && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Breaks</Label>
                          <Input type="number" min="1" max="10" value={editForm.autoBreakCoffeeCount}
                            onChange={(e) => setEditForm((p) => ({ ...p, autoBreakCoffeeCount: Math.min(10, Math.max(1, parseInt(e.target.value) || 1)) }))}
                            className="h-8 text-sm font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Min/Break</Label>
                          <Input type="number" min="1" value={editForm.autoBreakCoffeeMinutes}
                            onChange={(e) => setEditForm((p) => ({ ...p, autoBreakCoffeeMinutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="h-8 text-sm font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Deductible</Label>
                          <div className="flex items-center gap-2 h-8">
                            <button
                              type="button"
                              onClick={() => setEditForm((p) => ({ ...p, autoBreakCoffeeDeductible: !p.autoBreakCoffeeDeductible }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${editForm.autoBreakCoffeeDeductible ? "bg-red-500" : "bg-green-500"}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${editForm.autoBreakCoffeeDeductible ? "translate-x-4" : "translate-x-0.5"}`} />
                            </button>
                            <span className={`text-[11px] font-semibold ${editForm.autoBreakCoffeeDeductible ? "text-red-600" : "text-green-600"}`}>
                              {editForm.autoBreakCoffeeDeductible ? "Deducted" : "Paid"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Total</Label>
                          <div className="h-8 border rounded-md bg-white flex items-center justify-center font-mono text-[11px] font-semibold text-neutral-700">
                            {editForm.autoBreakCoffeeCount} × {editForm.autoBreakCoffeeMinutes}m
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowEdit(false)}
              style={{ border: "0.5px solid #e5e5e5", background: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={actionLoading || !editForm.shiftName.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: actionLoading || !editForm.shiftName.trim() ? "#fdba74" : "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: actionLoading || !editForm.shiftName.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {actionLoading ? (
                <><Loader2 size={13} className="animate-spin" /> Saving…</>
              ) : (
                <><Check size={13} /> Save Changes</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 600 }}>
              <Trash2 size={17} color="#ef4444" />
              Delete Shift Template
            </DialogTitle>
            <DialogDescription style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {shiftToDelete && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
              <div style={{ borderLeft: "3px solid #ef4444", padding: "8px 12px", background: "#fafaf9", borderRadius: "0 8px 8px 0" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{shiftToDelete.shiftName}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                  {fmtClockWith12Hour(shiftToDelete.startTime)} – {fmtClockWith12Hour(shiftToDelete.endTime)}
                  {" · "}{totalHours(shiftToDelete.startTime, shiftToDelete.endTime)} hours
                </div>
              </div>
            </div>
          )}

          <DialogFooter style={{ marginTop: 8, gap: 8 }}>
            <button
              onClick={() => setShowDelete(false)}
              style={{ border: "0.5px solid #e5e5e5", background: "#fff", borderRadius: 8, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={actionLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: actionLoading ? "#fca5a5" : "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {actionLoading ? (
                <><Loader2 size={13} className="animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 size={13} /> Delete Template</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}