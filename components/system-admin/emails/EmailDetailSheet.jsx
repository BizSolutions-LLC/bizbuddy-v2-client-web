// components/system-admin/emails/EmailDetailSheet.jsx
//
// BB-140: one logged email — GET /api/system-admin/emails/:id. Header (from, to, subject,
// time, status, message id, server reply, triggered by, hidden values), the email as it
// was sent, its text version, and a check of every image in it.
// Safety: the HTML is shown ONLY in an <iframe sandbox=""> (no scripts, forms, navigation
// or same-origin access); never with dangerouslySetInnerHTML. Images still load, so a
// broken image shows broken, as in the recipient's inbox. Passwords, codes and reset links
// are already replaced with •••••• by the server.

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleHelp, RefreshCw, XCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { systemAdminFetch } from "@/lib/systemAdminFetch";
import { formatDateTime, formatBytes } from "@/components/system-admin/shared";
import { StatusBadge, typeLabel, triggeredByLabel, COPY_LABEL } from "./format";

const VIEWS = [
  { id: "preview", label: "Preview" },
  { id: "text", label: "Text version" },
];

export default function EmailDetailSheet({ emailId, templates, onOpenChange }) {
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [view, setView] = useState("preview");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!emailId) { setState({ loading: false, error: "", data: null }); return undefined; }
    let cancelled = false;
    setView("preview");
    setState({ loading: true, error: "", data: null });
    systemAdminFetch(`/api/system-admin/emails/${encodeURIComponent(emailId)}`)
      .then((json) => { if (!cancelled) setState({ loading: false, error: "", data: json.data }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err.message, data: null }); });
    return () => { cancelled = true; };
  }, [emailId, attempt]);

  const d = state.data;
  const content = d?.content || null;
  const hasText = Boolean(content?.text);

  return (
    <Sheet open={Boolean(emailId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <div className="p-6 space-y-5">
          <SheetHeader className="space-y-1.5 pr-6 text-left">
            <SheetTitle className="break-words">{d?.subject || (state.loading ? "Loading…" : "Email")}</SheetTitle>
            <SheetDescription>
              {d ? `${typeLabel(d.type, templates)} · ${formatDateTime(d.sentAt)}` : "Email details"}
            </SheetDescription>
          </SheetHeader>

          {state.loading && !d ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : state.error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">{state.error}</p>
              <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw /> Retry
              </Button>
            </div>
          ) : d ? (
            <>
              {/* Header */}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="Status">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <StatusBadge status={d.status} error={d.errorMessage} />
                    {d.isTest && <Badge variant="outline" className="text-[10px]">TEST</Badge>}
                  </span>
                </Row>
                <Row label="Sent">{formatDateTime(d.sentAt)}</Row>
                <Row label="From">{content?.from || d.from || "—"}</Row>
                <Row label="To">{(content?.to?.length ? content.to.join(", ") : d.to) || "—"}</Row>
                <Row label="Company">{d.company?.name || "—"}</Row>
                <Row label="Triggered by">{triggeredByLabel(d.triggeredBy)}</Row>
                {d.status === "failed" && d.errorMessage && (
                  <Row label="Error" wide><span className="text-red-600">{d.errorMessage}</span></Row>
                )}
                <Row label="Mail server reply" wide mono>{d.smtpResponse || "—"}</Row>
                <Row label="Message ID" wide mono>{d.messageId || "—"}</Row>
                {(d.accepted?.length > 0 || d.rejected?.length > 0) && (
                  <Row label="Accepted / rejected" wide>
                    {(d.accepted || []).join(", ") || "—"}
                    {d.rejected?.length > 0 && <span className="text-red-600"> · rejected: {d.rejected.join(", ")}</span>}
                  </Row>
                )}
                <Row label="Size">{d.sizeBytes != null ? formatBytes(d.sizeBytes) : "—"}</Row>
                <Row label="Hidden values">
                  {d.redactedCount > 0 ? `${d.redactedCount} value${d.redactedCount === 1 ? "" : "s"} hidden (shown as ••••••)` : "None"}
                </Row>
              </dl>

              {/* The email itself */}
              {content ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">The email as it was sent</p>
                    {hasText && (
                      <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="group">
                        {VIEWS.map((v) => (
                          <Button
                            key={v.id}
                            type="button"
                            size="sm"
                            variant={view === v.id ? "secondary" : "ghost"}
                            className="h-7"
                            aria-pressed={view === v.id}
                            onClick={() => setView(v.id)}
                          >
                            {v.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {view === "text" && hasText ? (
                    <pre className="max-h-[700px] overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap break-words">
                      {content.text}
                    </pre>
                  ) : content.html ? (
                    // sandbox="" = no scripts, forms, popups, navigation or same-origin access
                    <iframe
                      title="Email preview"
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={content.html}
                      className="block w-full h-[700px] rounded-md border bg-white"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">This email has no HTML part.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                    {COPY_LABEL[d.copy] || "No copy of this email was kept."}
                  </p>
                  {d.legacyBody != null && (
                    <div>
                      <p className="text-sm font-medium mb-1">Details (older email, no preview)</p>
                      <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap break-all">
                        {typeof d.legacyBody === "string" ? d.legacyBody : JSON.stringify(d.legacyBody, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Image check (done by the server just now) */}
              {Array.isArray(d.images) && d.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Images <span className="font-normal text-muted-foreground">· checked just now</span>
                  </p>
                  <ul className="divide-y rounded-md border">
                    {d.images.map((img, i) => (
                      <li key={`${img.url}-${i}`} className="flex items-start gap-2 p-2.5 text-xs">
                        {img.ok === true ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-label="Loads" />
                        ) : img.ok === false ? (
                          <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-label="Broken" />
                        ) : (
                          <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Not checkable" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-mono break-all">{img.url}</p>
                          <p className="text-muted-foreground">
                            {img.ok === true
                              ? `Loads${img.contentType ? ` · ${img.contentType}` : ""}`
                              : img.ok === false
                                ? `Broken: ${img.reason || (img.status ? `HTTP ${img.status}` : "can't be loaded")}`
                                : "Not checkable (embedded attachment)"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children, wide = false, mono = false }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`break-all ${mono ? "font-mono text-xs" : ""}`}>{children}</dd>
    </div>
  );
}
