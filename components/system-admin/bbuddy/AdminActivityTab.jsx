// components/system-admin/bbuddy/AdminActivityTab.jsx
//
// BB-110: who did what at the system-admin level — request logs filtered by
// systemAdminId. Owners can pick any admin (from /admins, owner-only); other
// admins see their own activity.

"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSystemAdmin } from "@/components/system-admin/SystemAdminContext";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatDateTime } from "./api";

const PAGE_SIZE = 50;
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

const statusClass = (code) =>
  code >= 500 ? "text-red-600" : code >= 400 ? "text-yellow-600" : "text-green-600";

export default function AdminActivityTab({ refreshKey }) {
  const { admin: me } = useSystemAdmin();
  const [admins, setAdmins] = useState([]);
  const [adminId, setAdminId] = useState(me?.id || "");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Owners can look at anyone; /admins is owner-only
  useEffect(() => {
    if (!me?.isOwner) return;
    systemAdminFetch("/api/system-admin/admins")
      .then((json) => setAdmins(json.data || []))
      .catch((err) => console.error("Load admins error:", err));
  }, [me?.isOwner]);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const json = await systemAdminFetch("/api/system-admin/requests", {
          query: { systemAdminId: adminId, page, limit: PAGE_SIZE },
        });
        if (cancelled) return;
        setRows(json.data || []);
        // Server may not send pagination; fall back to "a full page means there may be more"
        setTotalPages(json.pagination?.totalPages ?? json.totalPages ?? null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [adminId, page, refreshKey]);

  const hasNext = totalPages ? page < totalPages : rows.length === PAGE_SIZE;

  return (
    <div className="space-y-4">
      {me?.isOwner && (
        <div className="space-y-1.5 max-w-xs">
          <Label>System admin</Label>
          <Select
            value={adminId}
            onValueChange={(v) => {
              setAdminId(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick an admin" />
            </SelectTrigger>
            <SelectContent>
              {(admins.length ? admins : [me]).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} (@{a.username}){a.id === me.id ? " · you" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {me?.isOwner ? "Admin activity" : "My activity"}
          </CardTitle>
          {loading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        No activity yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(r.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {r.systemAdmin ? `${r.systemAdmin.name} (@${r.systemAdmin.username})` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={WRITE_METHODS.includes(r.method) ? "outline" : "secondary"} className="text-[10px]">
                              {r.method}
                            </Badge>
                            <span className="font-mono text-xs break-all">{r.endpoint || r.url}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.ipAddress || "—"}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${statusClass(r.statusCode)}`}>
                          {r.statusCode}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-muted-foreground">
              Page {page}
              {totalPages ? ` of ${totalPages}` : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
