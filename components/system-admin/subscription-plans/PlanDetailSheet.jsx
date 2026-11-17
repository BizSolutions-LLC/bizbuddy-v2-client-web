// components/system-admin/subscription-plans/PlanDetailSheet.jsx
//
// BB-132: right-side drawer for one plan and its companies.
// GET /subscription-plans/:id, plus ?includeRetired=true when "Show retired" is on.
// View only — no edit / change-plan actions.

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard, formatNumber, useSystemAdminSection } from "../shared";
import { formatPrice, formatUserRange } from "./format";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function PlanDetailSheet({ planId, fallbackName, onClose }) {
  return (
    <Sheet open={!!planId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {/* Keyed so each plan starts with "Show retired" off */}
        {planId && <PlanDetail key={planId} planId={planId} fallbackName={fallbackName} />}
      </SheetContent>
    </Sheet>
  );
}

function PlanDetail({ planId, fallbackName }) {
  const [showRetired, setShowRetired] = useState(false);
  const section = useSystemAdminSection(`/api/system-admin/subscription-plans/${encodeURIComponent(planId)}`, {
    includeRetired: showRetired,
  });
  const plan = section.data;
  const companies = plan?.companyList || [];
  const retiredCount = plan?.companies?.retired || 0;

  return (
    <div className="space-y-5">
      <SheetHeader className="text-left space-y-1">
        <SheetTitle>{plan?.name || fallbackName || "Subscription plan"}</SheetTitle>
        <SheetDescription>
          {plan
            ? [formatPrice(plan.price) + (Number(plan.price) > 0 ? " /month" : ""), formatUserRange(plan.rangeOfUsers)]
                .filter(Boolean)
                .join(" · ")
            : "Plan details"}
        </SheetDescription>
      </SheetHeader>

      {plan && (
        <dl className="grid grid-cols-3 gap-3 border-y border-border py-3">
          <Stat label="Active companies" value={formatNumber(plan.companies?.active)} />
          <Stat label="Retired" value={formatNumber(retiredCount)} />
          <Stat label="Active employees" value={formatNumber(plan.activeEmployees)} />
        </dl>
      )}

      {plan?.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}

      <SectionCard
        title="Companies"
        section={section}
        asOf={false}
        actions={
          retiredCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox id="show-retired" checked={showRetired} onCheckedChange={(v) => setShowRetired(v === true)} />
              <Label htmlFor="show-retired" className="text-xs font-normal">
                Show {formatNumber(retiredCount)} retired
              </Label>
            </div>
          )
        }
      >
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active companies on this plan.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="whitespace-nowrap">Subscribed since</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Active employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id} className={c.isActive ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${c.isActive ? "text-foreground" : "text-muted-foreground"}`}>
                          {c.name || c.id}
                        </span>
                        {!c.isActive && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            Retired
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(c.subscribedAt)}</TableCell>
                    <TableCell className="text-sm text-right">{formatNumber(c.activeEmployees)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}
