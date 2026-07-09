// components/Dashboard/DashboardContent/BizBuddyPanel/Subscribers.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Edit3,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Download,
  CreditCard,
  AlertCircle,
  Check,
  Filter,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";

const COUNTRY_OPTS = ["Philippines", "United States", "Canada", "Japan"];
const CURRENCY_OPTS = ["PHP", "USD", "CAD", "JPY", "EUR"];
const LANGUAGE_OPTS = ["English", "Filipino", "Japanese", "French"];

const columnOptions = [
  { value: "id", label: "Company ID" },
  { value: "name", label: "Name" },
  { value: "country", label: "Country" },
  { value: "currency", label: "Currency" },
  { value: "language", label: "Language" },
  { value: "startDate", label: "Start Date" },
  { value: "endDate", label: "Expiration" },
];

const BLANK_FORM = {
  name: "",
  country: null,
  currency: null,
  language: null,
};

const arrow = (on, dir) =>
  on ? dir === "ascending" ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" /> : null;

function MultiColumnSelect({ visible, setVisible }) {
  const allChecked = visible.length === columnOptions.length;

  const toggle = (val) => {
    if (val === "all") {
      return setVisible(allChecked ? [] : columnOptions.map((o) => o.value));
    }
    setVisible((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const label = allChecked ? "All columns" : visible.length === 0 ? "No columns" : `${visible.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[180px] justify-between">
          {label}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-1" align="start">
        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => toggle("all")}>
          <Checkbox checked={allChecked} />
          <span>All columns</span>
          {allChecked && <Check className="ml-auto h-4 w-4 text-orange-500" />}
        </div>
        <div className="max-h-64 overflow-y-auto pr-1">
          {columnOptions.map((opt) => {
            const checked = visible.includes(opt.value);
            return (
              <div
                key={opt.value}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => toggle(opt.value)}
              >
                <Checkbox checked={checked} />
                <span>{opt.label}</span>
                {checked && <Check className="ml-auto h-4 w-4 text-orange-500" />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const buildCSV = (rows) => {
  const header = ["ID", "Name", "Country", "Currency", "Language", "Start Date", "Expiration"];
  const body = rows.map((c) => {
    const sub = firstRelevantSub(c.Subscription);
    const start = sub?.startDate ? new Date(sub.startDate).toISOString() : "";
    const end = sub?.endDate ? new Date(sub.endDate).toISOString() : "";
    return [
      `"${c.id}"`,
      `"${c.name}"`,
      `"${c.country || ""}"`,
      `"${c.currency || ""}"`,
      `"${c.language || ""}"`,
      `"${start}"`,
      `"${end}"`,
    ];
  });
  return [header, ...body].map((l) => l.join(",")).join("\r\n");
};

function firstRelevantSub(subs) {
  if (!subs?.length) return null;
  return (
    subs.find((s) => s.active) ||
    subs.slice().sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
  );
}

export default function Subscribers() {
  const { token } = useAuthStore();
  const API = process.env.NEXT_PUBLIC_API_URL;
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ ...BLANK_FORM, id: "" });
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsLoad, setDetailsLoad] = useState(false);
  const [sort, setSort] = useState({ key: "name", direction: "ascending" });
  const [filterName, setFilterName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState(columnOptions.map((c) => c.value));

  useEffect(() => {
    if (token) fetchCompanies();
  }, [token]);

  async function fetchCompanies() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/company/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setCompanies(json.data || []);
      else toast.error(json.message || "Failed to load companies");
    } catch {
      toast.error("Network error");
    }
    setLoading(false);
  }

  async function refreshData() {
    setRefreshing(true);
    await fetchCompanies();
    toast.message("Data refreshed");
    setRefreshing(false);
  }

  const requestSort = (key) => {
    setSort((p) => ({
      key,
      direction: p.key === key && p.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const listed = () => {
    const filtered = companies.filter((c) => (filterName ? c.name.toLowerCase().includes(filterName.toLowerCase()) : true));
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal;
      let bVal;
      if (sort.key === "startDate") {
        aVal = firstRelevantSub(a.Subscription)?.startDate || "";
        bVal = firstRelevantSub(b.Subscription)?.startDate || "";
      } else if (sort.key === "endDate") {
        aVal = firstRelevantSub(a.Subscription)?.endDate || "";
        bVal = firstRelevantSub(b.Subscription)?.endDate || "";
      } else if (sort.key === "id") {
        aVal = a.id;
        bVal = b.id;
      } else {
        aVal = (a[sort.key] ?? "").toString().toLowerCase();
        bVal = (b[sort.key] ?? "").toString().toLowerCase();
      }
      if (aVal < bVal) return sort.direction === "ascending" ? -1 : 1;
      if (aVal > bVal) return sort.direction === "ascending" ? 1 : -1;
      return 0;
    });
  };

  function exportCSV() {
    const rows = listed();
    if (!rows.length) return toast.message("No rows to export");
    setExporting(true);
    try {
      const d = new Date();
      const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const blob = new Blob([buildCSV(rows)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Companies_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.message("CSV exported");
    } finally {
      setExporting(false);
    }
  }

  const renderSelect = (form, setForm, field, opts) => (
    <div className="grid grid-cols-4 items-center gap-4">
      <label htmlFor={`edit-${field}`} className="text-right font-medium text-sm capitalize">
        {field}
      </label>
      <Select value={form[field] ?? "none"} onValueChange={(v) => setForm({ ...form, [field]: v })}>
        <SelectTrigger id={`edit-${field}`} className="col-span-3">
          <SelectValue placeholder={`Select ${field}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {opts.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  async function submitEdit() {
    const data = { ...editForm };
    ["country", "currency", "language"].forEach((f) => {
      if (data[f] === "none") data[f] = null;
    });

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/company/update/${data.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Company updated");
        setShowEdit(false);
        fetchCompanies();
      } else toast.error(json.message || "Update failed");
    } catch {
      toast.error("Network error");
    }
    setSubmitting(false);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/company/delete/${deleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Company deleted");
        setCompanies((p) => p.filter((c) => c.id !== deleteId));
        setShowDelete(false);
      } else toast.error(json.message || "Delete failed");
    } catch {
      toast.error("Network error");
    }
    setSubmitting(false);
  }

  async function openDetails(id) {
    setShowDetails(true);
    setDetails(null);
    setDetailsLoad(true);
    try {
      const res = await fetch(`${API}/api/company/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setDetails(json.data);
      else toast.error(json.message || "Failed to fetch details");
    } catch {
      toast.error("Network error");
    }
    setDetailsLoad(false);
  }

  const labelClass = "my-auto shrink-0 text-sm font-medium text-muted-foreground";

  return (
    <div className="max-w-full mx-auto p-4 lg:px-10 px-2 space-y-8">
      <Toaster position="top-center" />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-orange-500" />
            Subscribers
          </h2>
        </div>
        <div className="flex gap-2">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={refreshData} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh table</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={exportCSV} disabled={exporting || !listed().length}>
                  <Download className={`h-4 w-4 ${exporting ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2 relative">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Filter className="h-5 w-5" />
            </div>
            Table Controls
          </CardTitle>
          <span className="absolute top-2 right-4 text-sm text-muted-foreground">
            {listed().length} of {companies.length}
          </span>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className={labelClass}>Columns:</span>
              <MultiColumnSelect visible={columnVisibility} setVisible={setColumnVisibility} />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <span className={labelClass}>Filter:</span>
              <Input
                placeholder="Company name"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="h-8 max-w-xs"
              />
              {filterName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterName("")}
                  className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
              <Building2 className="h-5 w-5" />
            </div>
            Subscribers
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {columnOptions
                    .filter((c) => columnVisibility.includes(c.value))
                    .map(({ value, label }) => (
                      <TableHead
                        key={value}
                        className="cursor-pointer text-center"
                        onClick={() =>
                          ["startDate", "endDate"].includes(value) ||
                          ["id", "name", "country", "currency", "language"].includes(value)
                            ? requestSort(value)
                            : undefined
                        }
                      >
                        <div className="flex justify-center items-center">
                          {label}
                          {arrow(sort.key === value, sort.direction)}
                        </div>
                      </TableHead>
                    ))}
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {columnVisibility.concat("actions").map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : listed().length ? (
                  <AnimatePresence>
                    {listed().map((c) => {
                      const sub = firstRelevantSub(c.Subscription);
                      const startDate = sub?.startDate ? new Date(sub.startDate).toLocaleDateString() : "—";
                      const endDate = sub?.endDate ? new Date(sub.endDate).toLocaleDateString() : "—";
                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                        >
                          {columnVisibility.includes("id") && <TableCell className="text-center text-xs">{c.id}</TableCell>}
                          {columnVisibility.includes("name") && <TableCell className="text-center text-xs">{c.name}</TableCell>}
                          {columnVisibility.includes("country") && (
                            <TableCell className="text-center text-xs">{c.country || "—"}</TableCell>
                          )}
                          {columnVisibility.includes("currency") && (
                            <TableCell className="text-center text-xs">{c.currency || "—"}</TableCell>
                          )}
                          {columnVisibility.includes("language") && (
                            <TableCell className="text-center text-xs">{c.language || "—"}</TableCell>
                          )}
                          {columnVisibility.includes("startDate") && (
                            <TableCell className="text-center text-xs">{startDate}</TableCell>
                          )}
                          {columnVisibility.includes("endDate") && (
                            <TableCell className="text-center text-xs">{endDate}</TableCell>
                          )}

                          <TableCell className="text-center ">
                            <div className="flex justify-center gap-1">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDetails(c.id)}
                                      className="text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                    >
                                      <CreditCard className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditForm({
                                          ...c,
                                          country: c.country ?? "none",
                                          currency: c.currency ?? "none",
                                          language: c.language ?? "none",
                                        });
                                        setShowEdit(true);
                                      }}
                                      className="text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit company</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteId(c.id);
                                        setShowDelete(true);
                                      }}
                                      className="text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete company</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <TableRow>
                    <TableCell colSpan={columnVisibility.length + 1} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <div className="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Building2 className="h-8 w-8 text-orange-500/50" />
                        </div>
                        <p className="text-xs italic">No companies found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="sm:max-w-md border-2 border-red-200 dark:border-red-800/50">
          <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              Delete Company
            </DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 my-4">
            <p className="text-sm text-red-600 dark:text-red-400">Deleting a company will remove all associated data.</p>
          </div>

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={submitting}>
              {submitting ? "Deleting…" : "Delete Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl border-2 dark:border-white/10 overflow-y-auto max-h-[90vh]">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>

          {detailsLoad ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          ) : details ? (
            <>
              <section className="space-y-1 mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> {details.name}
                </h3>
                {details.id && <p className="text-sm text-muted-foreground">Company ID: {details.id}</p>}
                {details.country && <p className="text-sm text-muted-foreground">Country: {details.country}</p>}
                {details.currency && <p className="text-sm text-muted-foreground">Currency: {details.currency}</p>}
                {details.language && <p className="text-sm text-muted-foreground">Language: {details.language}</p>}
              </section>

              <section className="mb-6">
                <h4 className="font-medium mb-2 flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-orange-500" /> Subscriptions
                </h4>
                {details.Subscription?.length ? (
                  <ul className="space-y-2">
                    {details.Subscription.map((sub) => (
                      <li key={sub.id} className="flex items-start gap-2 text-sm">
                        <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400">
                          {sub.plan?.name ?? "Plan"} {sub.active ? "(Active)" : "(Expired)"}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(sub.startDate).toLocaleDateString()} –
                          {sub.endDate ? ` ${new Date(sub.endDate).toLocaleDateString()}` : " —"}
                          {sub.plan?.rangeOfUsers ? ` • ${sub.plan.rangeOfUsers} users` : ""}
                          {sub.plan?.price ? ` • $${sub.plan.price.toLocaleString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">No subscriptions</p>
                )}
              </section>
            </>
          ) : (
            <p className="text-muted-foreground">No details loaded.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="border-2 dark:border-white/10 max-w-lg">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500 dark:bg-orange-500/20 dark:text-orange-500">
                <Edit3 className="h-5 w-5" />
              </div>
              Edit Company
            </DialogTitle>
            <DialogDescription>Update company information</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="edit-name" className="text-right font-medium text-sm">
                Name
              </label>
              <Input
                id="edit-name"
                className="col-span-3 bg-muted/40 border-dashed opacity-60 cursor-not-allowed"
                value={editForm.name}
                disabled
              />
            </div>

            {renderSelect(editForm, setEditForm, "country", COUNTRY_OPTS)}
            {renderSelect(editForm, setEditForm, "currency", CURRENCY_OPTS)}
            {renderSelect(editForm, setEditForm, "language", LANGUAGE_OPTS)}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={submitting} className="bg-orange-500 hover:bg-orange-600 text-white">
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
