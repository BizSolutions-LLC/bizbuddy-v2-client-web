// components/system-admin/bbuddy/AccountsTab.jsx
//
// BB-110: every company and whether it has a B. Buddy account. Retired
// companies (no active users, BB-107) are greyed out and hidden by default.
// BB-107: "Add company" (AddCompanySheet) and "Set up" B. Buddy per row.

"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddCompanySheet from "./AddCompanySheet";
import { bbuddyFetch, formatDateTime } from "./api";

// The table primitive centres by default; this table reads left to right
const HEAD = "text-left px-3";
const CELL = "text-left px-3 py-3";

const Empty = () => <span className="text-muted-foreground">—</span>;

const VIEWS = [
  { id: "all", label: "All" },
  { id: "with", label: "With B. Buddy" },
  { id: "without", label: "Without B. Buddy" },
];

export default function AccountsTab({ accounts, agents, loading, error, onChanged }) {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [hideRetired, setHideRetired] = useState(true);
  const [adding, setAdding] = useState(false);
  const [setupFor, setSetupFor] = useState(null);
  const [settingUp, setSettingUp] = useState(false);

  const setUpBBuddy = async () => {
    const company = setupFor;
    setSettingUp(true);
    try {
      await bbuddyFetch(`/accounts/${company.companyId}`, { method: "POST" });
      toast.success(`B. Buddy set up for ${company.companyName}.`);
      setSetupFor(null);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSettingUp(false);
    }
  };

  // The heading counts active companies only
  const active = accounts.filter((a) => !a.isRetired);
  const withCount = active.filter((a) => a.hasBBuddy).length;
  const retiredCount = accounts.length - active.length;
  const term = search.trim().toLowerCase();
  const rows = accounts.filter(
    (a) =>
      (!hideRetired || !a.isRetired) &&
      (view === "all" || (view === "with" ? a.hasBBuddy : !a.hasBBuddy)) &&
      (!term || (a.companyName || "").toLowerCase().includes(term))
  );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            Companies{" "}
            <span className="text-muted-foreground font-normal">
              · {withCount} of {active.length} have B. Buddy
              {retiredCount > 0 && ` · ${retiredCount} retired`}
            </span>
          </CardTitle>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add company
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {VIEWS.map((v) => (
            <Button key={v.id} size="sm" variant={view === v.id ? "default" : "outline"} onClick={() => setView(v.id)}>
              {v.label}
            </Button>
          ))}
          <div className="flex items-center gap-2 pl-2">
            <Checkbox id="hide-retired" checked={hideRetired} onCheckedChange={(v) => setHideRetired(v === true)} />
            <Label htmlFor="hide-retired" className="text-xs font-normal">
              Hide retired
            </Label>
          </div>
          <Input
            placeholder="Search company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 sm:ml-auto"
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD}>Company</TableHead>
                <TableHead className={HEAD}>B. Buddy</TableHead>
                <TableHead className={HEAD}>Staff with access</TableHead>
                <TableHead className={HEAD}>B. Buddy status</TableHead>
                <TableHead className={HEAD}>Last sign-in</TableHead>
                <TableHead className={HEAD}>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading…" : "No companies match."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => (
                  <TableRow key={a.companyId} className={a.isRetired ? "opacity-50" : ""}>
                    <TableCell className={CELL}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${a.isRetired ? "text-muted-foreground" : "text-foreground"}`}>
                          {a.companyName || a.companyId}
                        </span>
                        {a.isRetired && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            Retired
                          </Badge>
                        )}
                      </div>
                      {a.activeUsers != null && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.activeUsers} {a.activeUsers === 1 ? "person" : "people"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className={CELL}>
                      {a.isRetired ? (
                        <Empty />
                      ) : a.hasBBuddy ? (
                        <Badge variant="secondary" className="font-normal">
                          Yes
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2.5" onClick={() => setSetupFor(a)}>
                          Set up
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className={`${CELL} max-w-xs`}>
                      <StaffAccess account={a} />
                    </TableCell>
                    <TableCell className={`${CELL} capitalize`}>{a.account?.status || <Empty />}</TableCell>
                    <TableCell className={`${CELL} whitespace-nowrap text-xs text-muted-foreground tabular-nums`}>
                      {a.account?.lastLoginAt ? formatDateTime(a.account.lastLoginAt) : <Empty />}
                    </TableCell>
                    <TableCell className={`${CELL} whitespace-nowrap text-xs text-muted-foreground tabular-nums`}>
                      {a.account?.createdAt ? formatDateTime(a.account.createdAt) : <Empty />}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AddCompanySheet open={adding} onOpenChange={setAdding} agents={agents} onCreated={onChanged} />

      <AlertDialog open={!!setupFor} onOpenChange={(open) => !open && !settingUp && setSetupFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up B. Buddy</AlertDialogTitle>
            <AlertDialogDescription>
              Create B. Buddy for {setupFor?.companyName}? Support staff can then be assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settingUp}>Cancel</AlertDialogCancel>
            <Button onClick={setUpBBuddy} disabled={settingUp}>
              {settingUp ? "Setting up…" : "Set up B. Buddy"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Who can sign in to this company's B. Buddy (each staff member has one company)
function StaffAccess({ account }) {
  const assigned = account.assignedAgents || [];

  if (assigned.length === 0) {
    return <span className="text-muted-foreground">No one</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assigned.map((a) => (
        <Badge
          key={a.id}
          variant="outline"
          className={`font-normal ${a.active ? "" : "opacity-60"}`}
          title={a.active ? a.name : `${a.name} (suspended)`}
        >
          {a.code}
        </Badge>
      ))}
    </div>
  );
}
