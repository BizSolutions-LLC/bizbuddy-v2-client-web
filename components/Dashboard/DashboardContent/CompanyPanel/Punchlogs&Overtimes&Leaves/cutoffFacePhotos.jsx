"use client";
// components/Dashboard/DashboardContent/CompanyPanel/Punchlogs&Overtimes&Leaves/cutoffFacePhotos.jsx
//
// BB-141: face photos (proof of the punch) on the cutoff approvals page.
// - GET /api/face-photos/cutoff/:cutoffPeriodId → one item per punch that has a photo,
//   matched to approval rows by timeLogId. Loaded once with the page and again after
//   approve / bulk approve / reset (the server hides a photo once its punch is approved,
//   and shows it again if the approval is reset).
// - GET /api/face-photos/:id/url → a 5-minute link, fetched each time the viewer opens
//   and never stored.
// The server owns every rule (who can see, hidden after approval, deleted after 90 days).
// Rows read the photos through FacePhotoContext so the row components need no new props.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Camera, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API = process.env.NEXT_PUBLIC_API_URL;

const KIND_LABEL = { in: "Clock-in", out: "Clock-out" };
const UNAVAILABLE_TIP = {
  approved: "Hidden after approval",
  expired: "Deleted after 90 days",
};

const fmtInZone = (value, timeZone) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
      timeZone: timeZone || undefined,
    });
  } catch { return "—"; }
};

// ── Data ─────────────────────────────────────────────────────────────────────
// items: Map timeLogId → { timeLogId, userId, approved, in, out }
export function useCutoffFacePhotos(cutoffId, token) {
  const [items, setItems] = useState(() => new Map());
  const [viewing, setViewing] = useState(null); // photo object ({ id, kind, capturedAt, … }) or null

  const reload = useCallback(async () => {
    if (!token || !cutoffId) return;
    try {
      const res = await fetch(`${API}/api/face-photos/cutoff/${encodeURIComponent(cutoffId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      // A server without BB-141 (404) or no access: just no camera icons
      if (!res.ok) return;
      const j = await res.json().catch(() => ({}));
      const next = new Map();
      (j.data?.items || []).forEach((it) => { if (it?.timeLogId) next.set(it.timeLogId, it); });
      setItems(next);
    } catch {
      // silent: photos are extra; the approvals page works without them
    }
  }, [token, cutoffId]);

  const open = useCallback((photo) => setViewing(photo || null), []);
  const close = useCallback(() => setViewing(null), []);

  return { items, reload, viewing, open, close };
}

const FacePhotoContext = createContext(null);

export function FacePhotoProvider({ value, children }) {
  return <FacePhotoContext.Provider value={value}>{children}</FacePhotoContext.Provider>;
}

// ── Row icons ────────────────────────────────────────────────────────────────
// Camera "In" / "Out" for one punch. Renders nothing when the punch has no photo.
export function FacePhotoIcons({ timeLogId, className = "" }) {
  const fp = useContext(FacePhotoContext);
  const item = fp && timeLogId ? fp.items.get(timeLogId) : null;
  if (!item || (!item.in && !item.out)) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {["in", "out"].map((kind) => {
          const photo = item[kind];
          if (!photo) return null;
          const blocked = Boolean(photo.unavailable);
          const tip = blocked
            ? UNAVAILABLE_TIP[photo.unavailable] || "Photo not available"
            : `View ${KIND_LABEL[kind].toLowerCase()} photo`;
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                {/* span wrapper so the tooltip still shows on a disabled button */}
                <span className="inline-flex">
                  <button
                    type="button"
                    onClick={() => fp.open(photo)}
                    disabled={blocked}
                    aria-label={tip}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <Camera className="w-3 h-3" />
                    {kind === "in" ? "In" : "Out"}
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{tip}</TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

// ── Viewer ───────────────────────────────────────────────────────────────────
export function FacePhotoViewer({ fp, token, timeZone }) {
  const photo = fp?.viewing || null;
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0); // "Reload photo" asks for a new link

  useEffect(() => {
    if (!photo?.id || !token) { setUrl(null); setError(null); return undefined; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setUrl(null);
      setError(null);
      try {
        const res = await fetch(`${API}/api/face-photos/${encodeURIComponent(photo.id)}/url`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Approved or deleted since the list loaded: refresh the icons too
          if (j.code === "FACE_PHOTO_HIDDEN" || j.code === "FACE_PHOTO_EXPIRED") fp.reload();
          throw new Error(
            j.message ||
            (res.status === 403 ? "This photo is hidden because the punch is approved."
              : res.status === 410 ? "This photo was deleted after 90 days."
              : res.status === 404 ? "Photo not found."
              : "The photo can't be opened right now. Try again later.")
          );
        }
        if (!cancelled) setUrl(j.data?.url || null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, token, attempt]);

  const hasCoords = photo && photo.latitude != null && photo.longitude != null;
  const mapUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${photo.latitude},${photo.longitude}`)}`
    : null;

  return (
    <Dialog open={Boolean(photo)} onOpenChange={(v) => { if (!v) fp.close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{KIND_LABEL[photo?.kind] || "Punch"} photo</DialogTitle>
          <DialogDescription>Live photo taken in the mobile app as proof of the punch.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center rounded-md border border-border bg-muted/40 min-h-[240px] overflow-hidden">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : error ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw /> Try again
              </Button>
            </div>
          ) : url ? (
            // Plain <img>: the link is a short-lived signed S3 URL (no auth header, no CORS needed)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${KIND_LABEL[photo?.kind] || "Punch"} photo`}
              className="block w-full max-w-[480px] h-auto"
              onError={() => setError("The photo link expired. Reload to get a new one.")}
            />
          ) : null}
        </div>

        {photo && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Taken (phone time)</dt>
              <dd>{fmtInZone(photo.capturedAt, timeZone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Received by server</dt>
              <dd>{fmtInZone(photo.receivedAt, timeZone)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Location at the punch</dt>
              <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {hasCoords ? (
                  <>
                    <span className="font-mono text-xs">
                      {Number(photo.latitude).toFixed(5)}, {Number(photo.longitude).toFixed(5)}
                      {photo.accuracy != null && ` (±${Math.round(photo.accuracy)} m)`}
                    </span>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline"
                    >
                      Open in map <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                ) : (
                  <span className="text-muted-foreground">No location recorded</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
