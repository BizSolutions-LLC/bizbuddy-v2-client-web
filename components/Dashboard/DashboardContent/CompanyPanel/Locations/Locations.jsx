// components/Dashboard/DashboardContent/CompanyPanel/Locations/Locations.jsx
/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Edit3,
  Trash2,
  Users2,
  ChevronUp,
  ChevronDown,
  MapPin,
  RefreshCw,
  Filter,
  AlertCircle,
  UserCheck,
  Loader2,
  ExternalLink,
  Info,
  Check,
  Plus,
  Search,
  Clock,
  Eye,
  Building,
  Globe,
  Target,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "@/store/useAuthStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Circle = dynamic(() => import("react-leaflet").then((m) => m.Circle), { ssr: false });
const useMapEvents = dynamic(() => import("react-leaflet").then((m) => m.useMapEvents), { ssr: false });

if (typeof window !== "undefined") {
  import("leaflet/dist/leaflet.css");
  import("leaflet/dist/images/marker-icon.png");
  import("leaflet/dist/images/marker-shadow.png");
  const L = require("leaflet");
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// Enhanced date formatting utilities
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "—";
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${diffYears}y ago`;
};

const formatFullDateTime = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Enhanced geocoding function using Nominatim (OpenStreetMap)
const searchLocation = async (query) => {
  if (!query || query.trim().length < 3) return [];
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
    );
    const data = await response.json();
    
    return data.map(item => ({
      id: item.place_id,
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      address: item.display_name
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

function getPreciseBrowserLocation({ desiredAccuracy = 50, timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("geolocation" in navigator))
      return resolve({ latitude: null, longitude: null, accuracy: null });
    let settled = false;
    let lastCoords = null;
    const finish = (coords) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watcher);
      clearTimeout(failTimer);
      resolve(coords);
    };
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        lastCoords = { latitude, longitude, accuracy };
        if (accuracy <= desiredAccuracy) finish(lastCoords);
      },
      () => finish({ latitude: null, longitude: null, accuracy: null }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
    const failTimer = setTimeout(
      () => finish(lastCoords || { latitude: null, longitude: null, accuracy: null }),
      timeoutMs + 2000
    );
  });
}

// Enhanced location picker with search functionality
function LocationPicker({ lat, lng, radius, onChange }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  const center = useMemo(() => [parseFloat(lat) || 14.5995, parseFloat(lng) || 120.9842], [lat, lng]);
  const mapKey = useMemo(() => `map-${lat}-${lng}-${radius}`, [lat, lng, radius]);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    const results = await searchLocation(query);
    setSearchResults(results);
    setSearching(false);
  };

  const selectSearchResult = (result) => {
    onChange({ lat: result.lat.toFixed(6), lng: result.lng.toFixed(6) });
    setSelectedResult(result);
    setSearchResults([]);
    setSearchQuery(result.name);
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        onChange({ lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) });
        setSelectedResult(null);
        setSearchQuery("");
      },
    });
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Search Interface */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for an address, business, or landmark..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 focus:border-orange-500 focus:ring-orange-500/20"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                onClick={() => selectSearchResult(result)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.name.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {result.address}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Map */}
      <div className="w-full h-96 rounded-md overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-lg">
        <MapContainer 
          key={mapKey} 
          center={center} 
          zoom={15} 
          scrollWheelZoom 
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
          />
          <Circle
            center={center}
            radius={parseInt(radius || 500, 10)}
            pathOptions={{ 
              color: "#f97316", 
              fillColor: "#f97316", 
              fillOpacity: 0.15,
              weight: 2
            }}
          />
          <Marker
            position={center}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                onChange({ lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) });
                setSelectedResult(null);
                setSearchQuery("");
              },
            }}
          />
          <MapEvents />
        </MapContainer>
      </div>

      {/* Location Info */}
      {selectedResult && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <MapPin className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <span className="font-medium">Selected:</span> {selectedResult.name.split(',')[0]}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Enhanced time display with tooltips
const TimeDisplayWithTooltip = ({ dateTime, type }) => {
  const getTimeDefinition = (type) => {
    switch (type) {
      case 'created':
        return "When this location was first added to the system";
      case 'updated':
        return "When this location was last modified or updated";
      default:
        return "";
    }
  };

  if (!dateTime) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            <div className="text-xs font-medium">{formatRelativeTime(dateTime)}</div>
            <div className="text-xs text-muted-foreground">{formatFullDateTime(dateTime).split(',')[0]}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="text-sm space-y-1">
            <div>{getTimeDefinition(type)}</div>
            <div className="text-xs text-muted-foreground border-t pt-1">
              Exact time: {formatFullDateTime(dateTime)}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const columnOptions = [
  { value: "id", label: "Location ID", essential: false, group: "meta" },
  { value: "name", label: "Location Name", essential: true, group: "basic" },
  { value: "latitude", label: "Latitude", essential: false, group: "coordinates" },
  { value: "longitude", label: "Longitude", essential: false, group: "coordinates" },
  { value: "radius", label: "Radius (m)", essential: true, group: "basic" },
  { value: "users", label: "Assigned Users", essential: true, group: "basic" },
  { value: "map", label: "Map Link", essential: true, group: "basic" },
  { value: "createdAt", label: "Created", essential: false, group: "timestamps" },
  { value: "updatedAt", label: "Last Updated", essential: false, group: "timestamps" },
];

export default function Locations() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [deviceLoc, setDeviceLoc] = useState({ latitude: null, longitude: null, accuracy: null });
  const [deviceLocLoading, setDeviceLocLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", latitude: "14.5995", longitude: "120.9842", radius: "500" });
  const [createLoading, setCreateLoading] = useState(false);
  const [useLocLoadingCreate, setUseLocLoadingCreate] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, name: "", latitude: "", longitude: "", radius: "500" });
  const [editLoading, setEditLoading] = useState(false);
  const [useLocLoadingEdit, setUseLocLoadingEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState(null);
  const [filters, setFilters] = useState({ names: [], userCounts: [], search: "" });
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "ascending" });

  // Better default column visibility - show only essential columns by default
  const essentialColumns = columnOptions.filter(c => c.essential).map(c => c.value);
  const [columnVisibility, setColumnVisibility] = useState(essentialColumns);

  useEffect(() => {
    let mounted = true;
    setDeviceLocLoading(true);
    getPreciseBrowserLocation().then((loc) => {
      if (mounted) {
        setDeviceLoc(loc);
        setDeviceLocLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchLocations();
    fetchUsers();
  }, [token]);

  async function fetchLocations() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/location`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setLocations(j.data || []);
      else toast.error(j.error || "Failed to fetch locations.");
    } catch {
      toast.error("Failed to fetch locations.");
    }
    setLoading(false);
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`${API_URL}/api/employee`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) setUsers(j.data || []);
      else toast.error(j.error || "Failed to fetch users.");
    } catch {
      toast.error("Failed to fetch users.");
    }
  }

  async function fetchAssignedUsers(locationId) {
    try {
      const res = await fetch(`${API_URL}/api/location/${locationId}/users`, { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (res.ok) return j.data || [];
      toast.error(j.error || "Failed to fetch assigned users.");
      return [];
    } catch {
      toast.error("Failed to fetch assigned users.");
      return [];
    }
  }

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchLocations(), fetchUsers()]);
    toast.success("Data refreshed successfully");
    setRefreshing(false);
  };

  const getAssignedCount = (loc) => loc.LocationRestriction?.filter((r) => r.restrictionStatus).length || 0;

  const getSortValue = (loc, key) => {
    switch (key) {
      case "id":
        return loc.id;
      case "name":
        return loc.name.toLowerCase();
      case "latitude":
        return Number(loc.latitude);
      case "longitude":
        return Number(loc.longitude);
      case "radius":
        return Number(loc.radius);
      case "users":
        return getAssignedCount(loc);
      case "createdAt":
      case "updatedAt":
        return new Date(loc[key]).getTime();
      default:
        return 0;
    }
  };

  const passesFilters = (loc) => {
    if (filters.search && !loc.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.names.length && !filters.names.includes(loc.name)) return false;
    if (filters.userCounts.length && !filters.userCounts.includes(getAssignedCount(loc))) return false;
    return true;
  };

  const tableData = useMemo(() => {
    const filtered = locations.filter(passesFilters);
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      const A = getSortValue(a, sortConfig.key);
      const B = getSortValue(b, sortConfig.key);
      if (A < B) return sortConfig.direction === "ascending" ? -1 : 1;
      if (A > B) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [locations, filters, sortConfig]);

  const toggleColumn = (c) => setColumnVisibility((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const MultiColumnSelect = () => {
    const allChecked = columnVisibility.length === columnOptions.length;
    const toggle = (val) => {
      if (val === "all") return setColumnVisibility(allChecked ? [] : columnOptions.map((o) => o.value));
      toggleColumn(val);
    };
    const label = allChecked
      ? "All columns"
      : columnVisibility.length === 0
      ? "No columns"
      : `${columnVisibility.length} selected`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full sm:min-w-[180px] justify-between">
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
              const checked = columnVisibility.includes(opt.value);
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
  };

  const labelClass = "my-auto shrink-0 text-sm font-medium text-muted-foreground";

  function openCreate() {
    setCreateForm({ name: "", latitude: "34.0522", longitude: "-118.2437", radius: "500" });
    setShowCreateModal(true);
  }

  async function handleUseCurrentLocationCreate() {
    setUseLocLoadingCreate(true);
    const loc = await getPreciseBrowserLocation();
    setUseLocLoadingCreate(false);
    if (loc.latitude && loc.longitude) {
      setCreateForm((p) => ({ ...p, latitude: loc.latitude.toFixed(6), longitude: loc.longitude.toFixed(6) }));
      toast.success(`Location set with ${Math.round(loc.accuracy)}m accuracy`);
    } else {
      toast.error("Location unavailable – enable location services and try again.");
    }
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return toast.error("Location name is required");
    setCreateLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/location/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: createForm.name.trim(),
          latitude: parseFloat(createForm.latitude),
          longitude: parseFloat(createForm.longitude),
          radius: parseInt(createForm.radius, 10) || 500,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success(j.message || "Location created successfully");
        setShowCreateModal(false);
        fetchLocations();
      } else toast.error(j.error || "Failed to create location");
    } catch {
      toast.error("Failed to create location");
    }
    setCreateLoading(false);
  }

  function openEdit(loc) {
    setEditForm({
      id: loc.id,
      name: loc.name,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius: String(loc.radius ?? 500),
    });
    setShowEditModal(true);
  }

  async function handleUseCurrentLocationEdit() {
    setUseLocLoadingEdit(true);
    const loc = await getPreciseBrowserLocation();
    setUseLocLoadingEdit(false);
    if (loc.latitude && loc.longitude) {
      setEditForm((p) => ({ ...p, latitude: loc.latitude.toFixed(6), longitude: loc.longitude.toFixed(6) }));
      toast.success(`Location updated with ${Math.round(loc.accuracy)}m accuracy`);
    } else {
      toast.error("Location unavailable – enable location services and try again.");
    }
  }

  async function handleSaveEdit() {
    const { id, name, latitude, longitude, radius } = editForm;
    if (!name.trim()) return toast.error("Location name is required");
    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/location/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radius: parseInt(radius, 10) || 500,
        }),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success(j.message || "Location updated successfully");
        setShowEditModal(false);
        fetchLocations();
      } else toast.error(j.error || "Failed to update location");
    } catch {
      toast.error("Failed to update location");
    }
    setEditLoading(false);
  }

  function openDelete(id, name) {
    setLocationToDelete({ id, name });
    setShowDeleteModal(true);
  }

  async function confirmDelete() {
    if (!locationToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/location/delete/${locationToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      if (res.ok) {
        toast.success(j.message || "Location deleted successfully");
        setLocations((prev) => prev.filter((l) => l.id !== locationToDelete.id));
      } else toast.error(j.error || "Failed to delete location");
    } catch {
      toast.error("Failed to delete location");
    }
    setShowDeleteModal(false);
    setDeleteLoading(false);
  }

  async function openUsers(loc) {
    setCurrentLocation(loc);
    const assigned = await fetchAssignedUsers(loc.id);
    setAssignedUsers(assigned);
    const assignedIds = assigned.map((u) => u.id);
    setAvailableUsers(users.filter((u) => !assignedIds.includes(u.id)));
    setSelectedUserId("");
    setShowUsersModal(true);
  }

  async function addUser() {
    if (!selectedUserId) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/location/${currentLocation.id}/assign-users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds: [selectedUserId] }),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success(j.message || "User assigned successfully");
        const added = availableUsers.find((u) => u.id === selectedUserId);
        setAssignedUsers((prev) => [...prev, added]);
        setAvailableUsers((prev) => prev.filter((u) => u.id !== selectedUserId));
        setSelectedUserId("");
      } else toast.error(j.error || "Failed to assign user");
    } catch {
      toast.error("Failed to assign user");
    }
    setUserActionLoading(false);
  }

  async function removeUser(userId) {
    setLoadingUserId(userId);
    try {
      const res = await fetch(`${API_URL}/api/location/${currentLocation.id}/remove-users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userIds: [userId] }),
      });
      const j = await res.json();
      if (res.ok) {
        toast.success(j.message || "User removed successfully");
        const removed = assignedUsers.find((u) => u.id === userId);
        setAssignedUsers((prev) => prev.filter((u) => u.id !== userId));
        setAvailableUsers((prev) => [...prev, removed]);
      } else toast.error(j.error || "Failed to remove user");
    } catch {
      toast.error("Failed to remove user");
    }
    setLoadingUserId(null);
  }

  // Summary statistics
  const SummaryStats = ({ data }) => {
    const stats = useMemo(() => {
      const totalLocations = data.length;
      const locationsWithUsers = data.filter(l => getAssignedCount(l) > 0).length;
      const totalAssignedUsers = data.reduce((sum, l) => sum + getAssignedCount(l), 0);
      const avgUsersPerLocation = totalLocations ? (totalAssignedUsers / totalLocations).toFixed(1) : '0.0';
      
      return { totalLocations, locationsWithUsers, totalAssignedUsers, avgUsersPerLocation };
    }, [data]);

    const getDefinition = (type) => {
      switch (type) {
        case 'total':
          return "Total number of location geofences configured for your company";
        case 'active':
          return "Locations that have at least one employee assigned for attendance tracking";
        case 'users':
          return "Total number of employee assignments across all locations";
        case 'average':
          return "Average number of employees assigned per location";
        default:
          return "";
      }
    };

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 cursor-help hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-blue-600">Total Locations</div>
                  <div className="text-lg font-bold">{stats.totalLocations}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">{getDefinition('total')}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 cursor-help hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-green-600">Active Locations</div>
                  <div className="text-lg font-bold">{stats.locationsWithUsers}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">{getDefinition('active')}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 cursor-help hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Users2 className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-orange-600">Assigned Users</div>
                  <div className="text-lg font-bold">{stats.totalAssignedUsers}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">{getDefinition('users')}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 cursor-help hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors">
                <div className="p-2 rounded-full bg-purple-500/10">
                  <Globe className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-purple-600">Avg per Location</div>
                  <div className="text-lg font-bold">{stats.avgUsersPerLocation}</div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="text-sm">{getDefinition('average')}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:px-6 px-2 space-y-6">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-7 w-7 text-orange-500" />
            Company Locations
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage geofenced locations for employee attendance tracking
          </p>
          <div className="mt-2">
            {deviceLocLoading ? (
              <Badge variant="outline" className="animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Locating…
              </Badge>
            ) : deviceLoc.latitude ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 cursor-help"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      GPS Available
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Current location: {deviceLoc.latitude.toFixed(5)}, {deviceLoc.longitude.toFixed(5)}
                      <br />
                      Accuracy: ±{Math.round(deviceLoc.accuracy)}m
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-help"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      GPS Unavailable
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Enable browser location services to use GPS features</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/dashboard/company/shifts">
              <Clock className="h-4 w-4 mr-2" />
              Shifts
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/company/schedules">
              <Calendar className="h-4 w-4 mr-2" />
              Schedules
            </Link>
          </Button>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={refreshData} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh location data</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button 
            onClick={openCreate} 
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Location
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <SummaryStats data={tableData} />

      {/* Filters Card */}
      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
                <Filter className="h-4 w-4" />
              </div>
              Filters & Controls
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              Showing {tableData.length} of {locations.length} locations
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column Selector */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className={labelClass}>
              <Eye className="w-4 h-4 mr-1 inline" />
              Columns:
            </span>
            <MultiColumnSelect />
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className={labelClass}>
              <Search className="w-4 h-4 mr-1 inline" />
              Search:
            </span>
            <div className="relative w-full sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search locations..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 focus:border-orange-500 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-2 shadow-md overflow-hidden dark:border-white/10">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <MapPin className="h-4 w-4" />
            </div>
            Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columnOptions
                    .filter((c) => columnVisibility.includes(c.value))
                    .map(({ value, label }) => (
                      <TableHead
                        key={value}
                        className="text-center text-nowrap cursor-pointer font-semibold"
                        onClick={() =>
                          setSortConfig({
                            key: value,
                            direction:
                              sortConfig.key === value && sortConfig.direction === "ascending" ? "descending" : "ascending",
                          })
                        }
                      >
                        <div className="flex items-center justify-center">
                          {label}
                          {sortConfig.key === value &&
                            (sortConfig.direction === "ascending" ? (
                              <ChevronUp className="ml-1 h-4 w-4" />
                            ) : (
                              <ChevronDown className="ml-1 h-4 w-4" />
                            ))}
                        </div>
                      </TableHead>
                    ))}
                  <TableHead className="text-center text-nowrap font-semibold">Actions</TableHead>
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
                ) : tableData.length ? (
                  <AnimatePresence>
                    {tableData.map((loc, index) => {
                      const assigned = getAssignedCount(loc);
                      const mapUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
                      return (
                        <motion.tr
                          key={loc.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className="border-b transition-all hover:bg-muted/50"
                        >
                          {columnVisibility.includes("id") && (
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-mono text-xs">
                                {loc.id}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.includes("name") && (
                            <TableCell className="font-medium text-center">
                              <div className="max-w-[200px] truncate mx-auto" title={loc.name}>
                                {loc.name}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.includes("latitude") && (
                            <TableCell className="text-center text-xs font-mono">{loc.latitude}</TableCell>
                          )}
                          {columnVisibility.includes("longitude") && (
                            <TableCell className="text-center text-xs font-mono">{loc.longitude}</TableCell>
                          )}
                          {columnVisibility.includes("radius") && (
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                {loc.radius}m
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.includes("users") && (
                            <TableCell className="text-center">
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      className="bg-orange-500 hover:bg-orange-600 text-white cursor-pointer transition-colors"
                                      onClick={() => openUsers(loc)}
                                    >
                                      <Users2 className="h-3 w-3 mr-1" />
                                      {assigned}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm">
                                      {assigned === 0 ? 'No users assigned' : 
                                       assigned === 1 ? '1 user assigned' : 
                                       `${assigned} users assigned`}
                                      <br />
                                      <span className="text-xs text-muted-foreground">Click to manage users</span>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          )}
                          {columnVisibility.includes("map") && (
                            <TableCell className="text-center">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(mapUrl, "_blank", "noopener")}
                                      className="text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View location on Google Maps</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          )}
                          {columnVisibility.includes("createdAt") && (
                            <TableCell className="text-center">
                              <TimeDisplayWithTooltip dateTime={loc.createdAt} type="created" />
                            </TableCell>
                          )}
                          {columnVisibility.includes("updatedAt") && (
                            <TableCell className="text-center">
                              <TimeDisplayWithTooltip dateTime={loc.updatedAt} type="updated" />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEdit(loc)}
                                      className="text-orange-700 hover:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit location details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openDelete(loc.id, loc.name)}
                                      className="text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Delete location</TooltipContent>
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
                        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                          <MapPin className="h-8 w-8 text-orange-500/50" />
                        </div>
                        <h3 className="font-medium mb-2">No locations found</h3>
                        <p className="text-sm">
                          {filters.search ? 
                            "No locations match your search criteria." : 
                            "Create your first location to get started with geofenced attendance tracking."
                          }
                        </p>
                        {!filters.search && (
                          <Button 
                            onClick={openCreate} 
                            className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Location
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Location Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[90vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-500" />
              Create New Location
            </DialogTitle>
            <DialogDescription>Add a new geofenced location for employee attendance tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <LocationPicker
              lat={createForm.latitude}
              lng={createForm.longitude}
              radius={createForm.radius}
              onChange={({ lat, lng }) => setCreateForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Location Name</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter location name"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Geofence Radius (meters)
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-xs">
                          The circular area around the location where employees can clock in/out. 
                          Larger radius = more flexible attendance, smaller radius = more precise tracking.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={createForm.radius}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), 5000);
                    setCreateForm((p) => ({ ...p, radius: v ? String(v) : "" }));
                  }}
                  placeholder="500"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Latitude</label>
                <Input
                  value={createForm.latitude}
                  onChange={(e) => setCreateForm((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder="14.5995"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Longitude</label>
                <Input
                  value={createForm.longitude}
                  onChange={(e) => setCreateForm((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder="120.9842"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleUseCurrentLocationCreate}
              disabled={useLocLoadingCreate}
              className="w-full border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
            >
              {useLocLoadingCreate ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              Use My Current Location
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createLoading || !createForm.name.trim()} 
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {createLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-[90vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-orange-500" />
              Edit Location
            </DialogTitle>
            <DialogDescription>Update location information and geofence settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <LocationPicker
              lat={editForm.latitude}
              lng={editForm.longitude}
              radius={editForm.radius}
              onChange={({ lat, lng }) => setEditForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
            />
            
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <span className="font-medium">Tip:</span> Drag the orange marker on the map to precisely position your location, 
                or use the search function to find a specific address.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Location Name</label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter location name"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  Geofence Radius (meters)
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="text-xs">
                          Adjusting the radius will affect where employees can clock in/out. 
                          Consider GPS accuracy (usually 3-5 meters) when setting the radius.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>
                <Input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={editForm.radius}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), 5000);
                    setEditForm((p) => ({ ...p, radius: v ? String(v) : "" }));
                  }}
                  placeholder="500"
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Latitude</label>
                <Input
                  value={editForm.latitude}
                  onChange={(e) => setEditForm((p) => ({ ...p, latitude: e.target.value }))}
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Longitude</label>
                <Input
                  value={editForm.longitude}
                  onChange={(e) => setEditForm((p) => ({ ...p, longitude: e.target.value }))}
                  className="focus:border-orange-500 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleUseCurrentLocationEdit}
              disabled={useLocLoadingEdit}
              className="w-full border-orange-500/30 text-orange-700 hover:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20"
            >
              {useLocLoadingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              Update to My Current Location
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={editLoading || !editForm.name.trim()} 
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {editLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users Management Dialog */}
      <Dialog open={showUsersModal} onOpenChange={setShowUsersModal}>
        <DialogContent className="w-[90vw] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto border-2 dark:border-white/10">
          <div className="h-1 w-full bg-orange-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-orange-500" />
              Manage Location Access
            </DialogTitle>
            <DialogDescription>
              Assign employees to <span className="font-medium">{currentLocation?.name}</span> for attendance tracking
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Assigned Users Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <h4 className="font-medium text-sm">Assigned Employees ({assignedUsers.length})</h4>
              </div>
              
              <div className="border-2 rounded-md max-h-48 overflow-y-auto border-gray-200 dark:border-gray-700">
                {assignedUsers.length ? (
                  <Table>
                    <TableBody>
                      {assignedUsers.map((u) => (
                        <TableRow key={u.id} className="hover:bg-muted/50">
                          <TableCell className="py-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                <UserCheck className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {u.profile?.firstName} {u.profile?.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeUser(u.id)}
                                    disabled={loadingUserId === u.id}
                                    className="text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                  >
                                    {loadingUserId === u.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove access to this location</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <div className="w-12 h-12 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users2 className="h-6 w-6 text-orange-500/50" />
                    </div>
                    <p className="text-sm">No employees assigned yet</p>
                    <p className="text-xs">Add employees below to enable location-based attendance</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add User Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-orange-500" />
                <h4 className="font-medium text-sm">Add Employee</h4>
              </div>
              
              <div className="flex gap-3">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select an employee to add..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {availableUsers.length ? (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                              <Users2 className="h-3 w-3 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-sm">{u.profile?.firstName} {u.profile?.lastName}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        All employees are already assigned to this location
                      </div>
                    )}
                  </SelectContent>
                </Select>
                
                <Button
                  disabled={!selectedUserId || userActionLoading}
                  onClick={addUser}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {userActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowUsersModal(false)} 
              className="bg-orange-500 hover:bg-orange-600 text-white w-full"
            >
              <Check className="h-4 w-4 mr-2" />
              Done Managing Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md border-2 border-red-200 dark:border-red-800/50">
          <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Delete Location
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All employee assignments to this location will be removed.
            </DialogDescription>
          </DialogHeader>
          
          {locationToDelete && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <span className="font-medium">Deleting:</span> {locationToDelete.name}
                <br />
                <span className="text-sm">Any users assigned to this location will lose access immediately.</span>
              </AlertDescription>
            </Alert>
          )}
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}