// app/system-admin/bbuddy/page.jsx
//
// BB-110: B. Buddy Activity — policing what support staff do through the
// hidden per-company B. Buddy accounts, and managing who those staff are.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ActivityTab from "@/components/system-admin/bbuddy/ActivityTab";
import SummaryTab from "@/components/system-admin/bbuddy/SummaryTab";
import AccountsTab from "@/components/system-admin/bbuddy/AccountsTab";
import StaffTab from "@/components/system-admin/bbuddy/StaffTab";
import AdminActivityTab from "@/components/system-admin/bbuddy/AdminActivityTab";
import { bbuddyFetch } from "@/components/system-admin/bbuddy/api";

const TABS = [
  { id: "activity", label: "Activity" },
  { id: "summary", label: "Summary" },
  { id: "accounts", label: "Companies" },
  { id: "staff", label: "Staff" },
  { id: "admin-activity", label: "Admin activity" },
];

export default function BBuddyActivityPage() {
  const [tab, setTab] = useState("activity");
  // Bumped by Refresh; each tab reloads with its current filters and page
  const [refreshKey, setRefreshKey] = useState(0);

  // Companies + staff feed the activity filters as well as their own tabs
  const [accounts, setAccounts] = useState({ data: [], loading: true, error: "" });
  const [agents, setAgents] = useState({ data: [], loading: true, error: "" });

  const loadAccounts = useCallback(async () => {
    setAccounts((p) => ({ ...p, loading: true, error: "" }));
    try {
      const json = await bbuddyFetch("/accounts");
      setAccounts({ data: json.data || [], loading: false, error: "" });
    } catch (err) {
      setAccounts((p) => ({ ...p, loading: false, error: err.message }));
    }
  }, []);

  const loadAgents = useCallback(async () => {
    setAgents((p) => ({ ...p, loading: true, error: "" }));
    try {
      // Include removed staff: the Activity filter still needs them for past activity,
      // and the Staff tab hides them unless "Show removed" is on
      const json = await bbuddyFetch("/agents", { query: { includeArchived: "true" } });
      setAgents({ data: json.data || [], loading: false, error: "" });
    } catch (err) {
      setAgents((p) => ({ ...p, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadAgents();
  }, [loadAccounts, loadAgents]);

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    loadAccounts();
    loadAgents();
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8">
      <Toaster position="top-right" richColors />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-1">B. Buddy Activity</h1>
        <p className="text-sm text-neutral-600">
          Everything support staff do through company B. Buddy accounts, and who those staff are
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "ghost"} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={refresh}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {tab === "activity" && (
        <ActivityTab
          companies={accounts.data.filter((a) => a.hasBBuddy)}
          agents={agents.data}
          refreshKey={refreshKey}
        />
      )}
      {tab === "summary" && <SummaryTab refreshKey={refreshKey} />}
      {tab === "admin-activity" && <AdminActivityTab refreshKey={refreshKey} />}
      {tab === "accounts" && (
        <AccountsTab
          accounts={accounts.data}
          agents={agents.data}
          loading={accounts.loading}
          error={accounts.error}
          onChanged={() => {
            loadAccounts();
            loadAgents();
          }}
        />
      )}
      {tab === "staff" && (
        <StaffTab
          agents={agents.data}
          accounts={accounts.data}
          loading={agents.loading}
          error={agents.error}
          onChanged={() => {
            loadAgents();
            loadAccounts();
          }}
        />
      )}
    </div>
  );
}
