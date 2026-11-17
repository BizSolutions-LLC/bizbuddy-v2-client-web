// components/system-admin/subscription-plans/PlanCards.jsx
//
// BB-132: one card per plan, in the server's order (price, then name).
// Clicking a card opens its detail drawer. View only.

"use client";

import { Building2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionCard, formatNumber } from "../shared";
import { formatPrice, formatUserRange } from "./format";

export default function PlanCards({ section, onSelect }) {
  const plans = section.data?.plans || [];

  return (
    <SectionCard
      title="Plans"
      description="Active companies and employees on each plan. Select a plan to see its companies."
      section={section}
      skeletonRows={3}
      asOf={false}
    >
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subscription plans yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className="text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full shadow-none transition-colors hover:border-neutral-400">
                <CardHeader className="pb-3 space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <span className="text-base font-semibold text-foreground whitespace-nowrap">
                      {formatPrice(plan.price)}
                      {Number(plan.price) > 0 && <span className="text-xs font-normal text-muted-foreground"> /month</span>}
                    </span>
                  </div>
                  {plan.rangeOfUsers && <p className="text-xs text-muted-foreground">{formatUserRange(plan.rangeOfUsers)}</p>}
                  {plan.description && <CardDescription className="line-clamp-2">{plan.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {formatNumber(plan.companies?.active)} active
                    {plan.companies?.retired > 0 && (
                      <span className="text-muted-foreground">+ {formatNumber(plan.companies.retired)} retired</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {formatNumber(plan.activeEmployees)} employees
                  </span>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
