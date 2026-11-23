// components/Home/landing/DownloadSection.jsx
// BB-145 — "Get BizBuddy on every device" + the download pop-up. Both use the store QR codes
// from BB-144 (public/app-qr). There are no store URLs yet, so the pop-up has no store button.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Smartphone, TabletSmartphone, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { QR } from "./content";

const STEPS = (store) => [
  { title: "Open your camera", body: "Point it at the code." },
  { title: "Tap the link", body: `It opens BizBuddy in the ${store}.` },
  { title: "Install and sign in", body: "Setup takes about two minutes." },
];

function DownloadDialog({ os, onClose }) {
  const app = os ? QR[os] : null;
  return (
    <Dialog open={!!os} onOpenChange={(v) => !v && onClose()}>
      {/* [&>button:last-child]:hidden hides the primitive's built-in close; this dialog has its own */}
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden rounded-brand border-0 bg-white p-0 font-landing text-brand-ink dark:bg-white [&>button:last-child]:hidden">
        {app && (
          <>
            <div className="h-1 bg-brand" />
            <div className="flex items-start justify-between gap-3 px-6 pt-[22px]">
              <div>
                <div className="text-[13px] font-bold text-neutral-600">Free download</div>
                <DialogTitle className="mt-0.5 font-display text-[26px] font-bold leading-tight tracking-[-0.01em]">
                  BizBuddy for {app.label}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Scan the QR code with your phone to open BizBuddy in the {app.store}.
                </DialogDescription>
              </div>
              <DialogClose
                aria-label="Close"
                className="flex size-11 flex-none items-center justify-center rounded-brand bg-brand-band"
              >
                <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
              </DialogClose>
            </div>
            <div className="flex flex-wrap items-center gap-6 px-6 pb-6 pt-5">
              <div className="size-44 flex-none rounded-brand border border-neutral-200 p-2">
                <img
                  src={app.src}
                  alt={`QR code to download BizBuddy for ${app.label}`}
                  width={160}
                  height={160}
                  className="size-full"
                />
              </div>
              <ol className="flex min-w-[220px] flex-1 flex-col gap-4">
                {STEPS(app.store).map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex size-[26px] flex-none items-center justify-center rounded-brand bg-black text-[13px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <strong>{s.title}</strong>
                      <br />
                      <span className="text-sm text-neutral-600">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StoreButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-14 items-center gap-3 rounded-brand bg-white px-5 text-left text-black transition-colors hover:bg-neutral-200"
    >
      <Icon className="size-[22px]" aria-hidden="true" />
      <span className="flex flex-col leading-[1.15]">
        <span className="text-[11px]">Download for</span>
        <strong className="text-base">{label}</strong>
      </span>
    </button>
  );
}

function QrTile({ app, className }) {
  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <div className="size-[132px] rounded-brand bg-white p-2">
        <img
          src={app.src}
          alt={`QR code to download BizBuddy for ${app.label}`}
          width={116}
          height={116}
          className="size-full"
        />
      </div>
      <figcaption className="text-[13px] font-semibold text-white">{app.label}</figcaption>
    </figure>
  );
}

export default function DownloadSection() {
  const [os, setOs] = useState(null);

  return (
    <section id="download" aria-labelledby="dl-h" className="scroll-mt-16 bg-black text-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-16 gap-y-12 px-4 py-16 sm:px-6 sm:py-[88px]">
        <div className="min-w-0 flex-[1_1_420px]">
          <h2
            id="dl-h"
            className="mb-4 font-display text-[clamp(32px,3.6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em]"
          >
            Get BizBuddy on every device. Free.
          </h2>
          <p className="mb-[30px] max-w-[520px] text-[17px] text-neutral-400">
            Track time on your phone or in the browser. Your punches follow you, even offline.
          </p>
          <div className="flex flex-wrap gap-3">
            <StoreButton icon={Smartphone} label="iPhone and iPad" onClick={() => setOs("ios")} />
            <StoreButton icon={TabletSmartphone} label="Android" onClick={() => setOs("android")} />
          </div>
          <div className="mt-[22px] text-[15px]">
            <Link href="/sign-in" className="border-b-2 border-brand font-semibold text-white">
              Open in the browser
            </Link>
          </div>
        </div>

        <div className="flex min-w-0 flex-[0_1_420px] flex-col gap-5">
          <div className="flex flex-wrap gap-5">
            <QrTile app={QR.ios} />
            <QrTile app={QR.android} />
          </div>
          <div className="text-[15px] text-neutral-400">
            <strong className="mb-1.5 block text-[17px] text-white">Scan to download</strong>
            Point your phone’s camera at the code for your phone.
          </div>
        </div>
      </div>

      <DownloadDialog os={os} onClose={() => setOs(null)} />
    </section>
  );
}
