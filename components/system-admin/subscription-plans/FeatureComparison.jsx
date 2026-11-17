// components/system-admin/subscription-plans/FeatureComparison.jsx
//
// BB-132: which plan includes which feature. Rows come from the server's
// featureKeys (nothing hard-coded); a plan missing a key doesn't include it.

"use client";

import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "../shared";
import { featureLabel } from "./format";

export default function FeatureComparison({ section }) {
  const plans = section.data?.plans || [];
  const featureKeys = section.data?.featureKeys || [];

  return (
    <SectionCard title="Feature comparison" description="What each plan includes." section={section} asOf={false}>
      {featureKeys.length === 0 || plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plan features to compare.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[12rem]">Feature</TableHead>
                {plans.map((plan) => (
                  <TableHead key={plan.id} className="text-center whitespace-nowrap">
                    {plan.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureKeys.map((key) => (
                <TableRow key={key}>
                  <TableCell className="text-sm" title={key}>
                    {featureLabel(key)}
                  </TableCell>
                  {plans.map((plan) => {
                    const included = plan.features?.[key] === true;
                    return (
                      <TableCell key={plan.id} className="text-center">
                        {included ? (
                          <Check className="w-4 h-4 mx-auto text-foreground" aria-label="Included" />
                        ) : (
                          <Minus className="w-4 h-4 mx-auto text-muted-foreground/60" aria-label="Not included" />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
