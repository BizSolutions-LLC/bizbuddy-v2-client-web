// components/Dashboard/DashboardContent/EmployeePanel/Documentation/Documentation.jsx
// BB-097 — BizBuddy documentation (static). Employee guide for everyone, plus
// Company Panel / Company Settings guides gated by role and plan exactly like
// the sidebar (shares CompanyPanelItems / filterCompanyPanelByRole / lockChildByPlan).
// Content tagged with companyType ("DAYCARE" = PadPro, "BNC" = B&C) is shown only to
// that company type; if the type can't be resolved, both variants show with a label.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ArrowRight, Lightbulb, ListOrdered, Lock, User, Building2, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import useAuthStore from "@/store/useAuthStore";
import { CompanyPanelItems, filterCompanyPanelByRole, lockChildByPlan } from "@/components/Dashboard/sidebar";
import docsContent from "./docsContent";
import companyDocsContent from "./companyDocsContent";
import settingsDocsContent from "./settingsDocsContent";

const TONE_CLASSES = {
  success: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger:  "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  info:    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  neutral: "bg-muted text-muted-foreground",
};

const TABS = [
  {
    id: "employee",
    label: "Employee",
    icon: User,
    title: "BizBuddy Employee Guide",
    description: "Learn how to use the Employee Panel: clocking in and out, reviewing your logs, filing requests, and managing your leaves and payslips.",
    content: docsContent,
  },
  {
    id: "company",
    label: "Company Panel",
    icon: Building2,
    title: "Company Panel Guide",
    description: "Manage your people, review requests and punch logs, run cutoffs, and set up shifts, schedules and locations.",
    content: companyDocsContent,
  },
  {
    id: "settings",
    label: "Company Settings",
    icon: Settings,
    title: "Company Settings Guide",
    description: "Configure your company profile, time-keeping rules, leave policies, notifications and subscription.",
    content: settingsDocsContent,
  },
];

const COMPANY_TYPE_LABELS = { DAYCARE: "PadPro", BNC: "B&C" };

// company-settings is the authoritative source (same as CutoffReview.jsx / PunchLogs.jsx).
function resolveCompanyType(data) {
  if (data?.companyType === "DAYCARE" || data?.companyType === "BNC") return data.companyType;
  if (data?.isBNC === true) return "BNC";
  if (data?.isBNC === false) return "DAYCARE";
  return null;
}

const matchesCompanyType = (item, companyType) =>
  !item.companyType || !companyType || item.companyType === companyType;

const GROUP_LABELS = Object.fromEntries(CompanyPanelItems.map((g) => [g.id, g.label]));

// Groups consecutive sections by groupId so the TOC and section list can show
// the same headings as the sidebar. Sections without a groupId get no heading.
function groupSections(sections) {
  const groups = [];
  sections.forEach((section) => {
    const last = groups[groups.length - 1];
    if (last && last.groupId === (section.groupId ?? null)) last.sections.push(section);
    else groups.push({ groupId: section.groupId ?? null, sections: [section] });
  });
  return groups;
}

function TableOfContents({ groups }) {
  return (
    <nav aria-label="Documentation sections">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">On this page</p>
      <div className="space-y-3">
        {groups.map((group, gi) => (
          <div key={group.groupId ?? `general-${gi}`}>
            {group.groupId && (
              <p className="mb-1 px-2 text-xs font-semibold text-foreground">{GROUP_LABELS[group.groupId]}</p>
            )}
            <ul className="space-y-1">
              {group.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950 dark:hover:text-orange-400"
                  >
                    <span className="truncate">{section.title}</span>
                    {section.lock?.locked && <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function CompanyTypeBadge({ type }) {
  return (
    <Badge variant="outline" className="w-fit shrink-0 border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
      {COMPANY_TYPE_LABELS[type]} only
    </Badge>
  );
}

function TopicBody({ topic }) {
  return (
    <div className="space-y-3 text-muted-foreground">
      {topic.body && <p className="leading-relaxed">{topic.body}</p>}

      {topic.steps?.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
            <ListOrdered className="h-3.5 w-3.5 text-orange-500" /> Steps
          </p>
          <ol className="list-decimal space-y-1 pl-5 leading-relaxed">
            {topic.steps.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
      )}

      {topic.statuses?.length > 0 && (
        <div className="space-y-2">
          {topic.statuses.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <Badge className={`w-fit shrink-0 border-transparent shadow-none hover:bg-inherit ${TONE_CLASSES[s.tone] || TONE_CLASSES.neutral}`}>
                {s.label}
              </Badge>
              <span className="leading-relaxed">{s.meaning}</span>
            </div>
          ))}
        </div>
      )}

      {topic.tips?.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950/40">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
            <Lightbulb className="h-3.5 w-3.5" /> Tips
          </p>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed">
            {topic.tips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// Same look as the plan badge on locked sidebar items (sidebar.jsx).
function PlanLockBadge({ requiredPlan }) {
  return (
    <Badge
      variant="outline"
      className="flex w-fit items-center gap-1 whitespace-nowrap border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    >
      <span>{requiredPlan}</span>
      <Lock className="h-3 w-3" />
    </Badge>
  );
}

function DocSection({ section, showTypeLabels }) {
  const locked = section.lock?.locked;
  return (
    <Card id={section.id} className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {section.title}
            {locked && section.lock.requiredPlan && <PlanLockBadge requiredPlan={section.lock.requiredPlan} />}
            {showTypeLabels && section.companyType && <CompanyTypeBadge type={section.companyType} />}
          </CardTitle>
          <CardDescription>
            {section.summary}
            {locked && ` Requires the ${section.lock.requiredPlan} plan or higher.`}
          </CardDescription>
        </div>
        {section.href && (
          locked ? (
            <Button variant="outline" size="sm" className="w-fit shrink-0" disabled>
              Open this page <Lock />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-fit shrink-0">
              <Link href={section.href}>
                Open this page <ArrowRight />
              </Link>
            </Button>
          )
        )}
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {section.topics.map((topic, i) => (
            <AccordionItem key={`${section.id}-${i}`} value={`${section.id}-${i}`}>
              <AccordionTrigger className="text-left">
                <span className="flex flex-wrap items-center gap-2">
                  {topic.title}
                  {showTypeLabels && topic.companyType && <CompanyTypeBadge type={topic.companyType} />}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <TopicBody topic={topic} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function TabBar({ tabs, activeId, onSelect }) {
  return (
    <div role="tablist" aria-label="Documentation guides" className="flex w-fit max-w-full overflow-x-auto rounded-md border">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            role="tab"
            aria-selected={active}
            size="sm"
            variant={active ? "default" : "ghost"}
            className={`h-9 shrink-0 rounded-none ${active ? "bg-orange-500 text-white hover:bg-orange-600" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            <Icon className="mr-1.5 h-4 w-4" />
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function Documentation() {
  const { token } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "employee";

  const [role, setRole] = useState(null);
  const [plan, setPlan] = useState("free");
  // undefined = still loading, null = couldn't be resolved (show both variants, labelled)
  const [companyType, setCompanyType] = useState(undefined);

  // Live role/plan from the profile endpoint, same as sidebar.jsx — the decoded
  // JWT doesn't reliably carry role.
  useEffect(() => {
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setRole(d.data?.user?.role || "employee");
        setPlan(d.data?.subscription?.plan?.name?.toLowerCase() || "free");
      })
      .catch(() => setRole("employee"));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/company-settings/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setCompanyType(resolveCompanyType(j?.data)))
      .catch(() => setCompanyType(null));
  }, [token]);

  const loading = role === null || companyType === undefined;
  const showTypeLabels = !loading && companyType === null;

  const visibleTabs = useMemo(() => {
    if (loading) return [];
    const allowedGroups = new Set(filterCompanyPanelByRole(CompanyPanelItems, role).map((g) => g.id));

    return TABS.map((tab) => {
      const sections = tab.content
        // Employee guide is ungrouped; company/settings sections follow the sidebar's role filter.
        .filter((s) => !s.groupId || allowedGroups.has(s.groupId))
        .filter((s) => matchesCompanyType(s, companyType))
        .map((s) => ({
          ...s,
          topics: s.topics.filter((t) => matchesCompanyType(t, companyType)),
          href: s.href ?? (s.routeId ? `/dashboard/${s.routeId}` : null),
          lock: s.routeId ? lockChildByPlan({ id: s.routeId }, plan) : null,
        }))
        .filter((s) => s.topics.length > 0);
      return { ...tab, sections };
    }).filter((tab) => tab.id === "employee" || tab.sections.some((s) => s.groupId));
  }, [loading, role, plan, companyType]);

  const activeTab = visibleTabs.find((t) => t.id === requestedTab) || visibleTabs[0];
  const groups = activeTab ? groupSections(activeTab.sections) : [];

  const selectTab = (id) => {
    router.replace(id === "employee" ? pathname : `${pathname}?tab=${id}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-4">
        {loading ? (
          <Skeleton className="h-9 w-72 max-w-full" />
        ) : (
          visibleTabs.length > 1 && <TabBar tabs={visibleTabs} activeId={activeTab.id} onSelect={selectTab} />
        )}
        {!loading && (
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <BookOpen className="h-7 w-7 text-orange-500" />
              {activeTab.title}
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">{activeTab.description}</p>
          </div>
        )}
      </header>

      <Separator />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="p-3 lg:border-0 lg:bg-transparent lg:dark:bg-transparent lg:p-0 lg:shadow-none">
              <TableOfContents groups={groups} />
            </Card>
          </aside>

          <div className="space-y-6">
            {groups.map((group, gi) => (
              <div key={group.groupId ?? `general-${gi}`} className="space-y-6">
                {group.groupId && (
                  <h2 className="pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABELS[group.groupId]}
                  </h2>
                )}
                {group.sections.map((section) => (
                  <DocSection key={section.id} section={section} showTypeLabels={showTypeLabels} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
