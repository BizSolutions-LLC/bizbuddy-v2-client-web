// components/Home/landing/HeroRail.jsx
// BB-145 — hero with the six-feature rail. Each feature swaps headline, copy and screen;
// it moves on every 7 seconds (not when the visitor prefers reduced motion) or on click.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORIES } from "./content";
import { ScreenCaption } from "./Sections";

const ROTATE_MS = 7000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function PhoneFrame({ src, className, priority = false }) {
  return (
    <div
      className={cn(
        "absolute aspect-[602/1306] overflow-hidden rounded-[30px] border-[6px] border-neutral-800 bg-white shadow-2xl",
        className
      )}
    >
      {/* Screenshots include the iOS status bar; the pill sits where the Dynamic Island is.
          next/image serves a copy sized for the frame: the browser shrinking the full 602px file ~4x looked blurry. */}
      <Image
        src={src}
        alt=""
        width={602}
        height={1306}
        quality={90}
        priority={priority}
        sizes="(min-width: 1280px) 220px, (min-width: 768px) 18vw, 30vw"
        className="block size-full object-cover object-top"
      />
      <span aria-hidden="true" className="absolute left-1/2 top-[1.6%] h-[2.6%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
    </div>
  );
}

// A smaller second screen in front of the main one (e.g. the Employee Map in Satellite view)
function InsetFrame({ src, size }) {
  return (
    <div className="absolute bottom-[5%] right-[3%] w-[46%] overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex h-4 items-center gap-1 bg-neutral-800 px-2">
        <span className="size-1.5 rounded-full bg-neutral-600" />
        <span className="size-1.5 rounded-full bg-neutral-600" />
        <span className="size-1.5 rounded-full bg-neutral-600" />
      </div>
      <Image
        src={src}
        alt=""
        width={size[0]}
        height={size[1]}
        quality={90}
        sizes="(min-width: 1280px) 300px, (min-width: 768px) 24vw, 46vw"
        priority
        className="block h-auto w-full"
      />
    </div>
  );
}

function ProductStage({ story }) {
  const hasWeb = story.stage !== "phone";
  const hasPhone = story.stage !== "web";
  const hasInset = Boolean(story.inset);

  return (
    <div role="img" aria-label={story.alt} className="relative aspect-[16/11] overflow-hidden rounded-brand bg-brand-stage">
      <div
        aria-hidden="true"
        className="absolute -right-[120px] -top-[120px] size-[440px] rounded-full bg-[radial-gradient(circle,rgba(246,133,37,.42),rgba(246,133,37,0)_70%)]"
      />

      {hasWeb && (
        <div
          className={cn(
            "absolute bottom-0 left-[6%] top-[7%] flex flex-col overflow-hidden rounded-t-md bg-white shadow-2xl",
            hasPhone ? "right-[24%]" : hasInset ? "right-[16%]" : "right-[6%]"
          )}
        >
          <div className="flex h-[26px] flex-none items-center gap-1.5 bg-neutral-800 px-2.5">
            <span className="size-2 rounded-full bg-neutral-600" />
            <span className="size-2 rounded-full bg-neutral-600" />
            <span className="size-2 rounded-full bg-neutral-600" />
            <span className="ml-2.5 h-3.5 flex-1 rounded-sm bg-neutral-700 pl-2 text-[9px] leading-[14px] text-neutral-400">
              mybizbuddy.co
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Image
              src={story.web}
              alt=""
              width={story.webSize[0]}
              height={story.webSize[1]}
              quality={90}
              sizes="(min-width: 1280px) 560px, (min-width: 768px) 45vw, 90vw"
              // Every hero screen is the largest thing on screen while it shows; only the current
              // one is rendered, so this fetches just that image early — no extra downloads.
              priority
              className="block h-auto w-full"
            />
          </div>
        </div>
      )}

      {hasInset && hasWeb && <InsetFrame src={story.inset} size={story.insetSize} />}
      {hasPhone && hasWeb && <PhoneFrame src={story.phone} priority className="bottom-[4%] right-[4%] h-[90%]" />}
      {hasPhone && !hasWeb && (
        <PhoneFrame
          src={story.phone}
          priority
          className="bottom-[5%] left-1/2 top-[5%] -translate-x-1/2 rounded-[34px] border-[7px]"
        />
      )}
    </div>
  );
}

export default function HeroRail() {
  const [tab, setTab] = useState(0);
  const [cycle, setCycle] = useState(0); // bumps on click so the timer restarts
  const reduced = usePrefersReducedMotion();
  const story = STORIES[tab];

  useEffect(() => {
    if (reduced) return undefined;
    const t = setTimeout(() => setTab((i) => (i + 1) % STORIES.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [tab, cycle, reduced]);

  const pick = (i) => {
    setTab(i);
    setCycle((c) => c + 1);
  };

  return (
    <section id="top" className="scroll-mt-16 bg-brand-band">
      <div className="mx-auto max-w-[1280px] px-4 pt-10 sm:px-6 sm:pt-14">
        <div className="flex flex-wrap items-center gap-x-14 gap-y-10">
          <div
            key={`copy-${story.id}`}
            id="hero-panel"
            role="tabpanel"
            aria-live="polite"
            className="min-w-0 max-w-[520px] flex-[1_1_400px] duration-500 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
          >
            <div className="mb-3.5 text-sm font-bold">{story.eyebrow}</div>
            <h1 className="mb-[18px] text-balance font-display text-[clamp(34px,4.2vw,48px)] font-bold leading-[1.08] tracking-[-0.02em]">
              {story.title}
            </h1>
            <p className="mb-7 text-lg leading-[1.7] text-neutral-700">{story.body}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="#download"
                className="inline-flex h-12 items-center gap-2 rounded-brand bg-brand px-[22px] text-[15px] font-bold text-black transition-colors hover:bg-brand-hover"
              >
                Download free
                <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
              <Link href="#pricing" className="border-b-2 border-brand pb-0.5 text-[15px] font-semibold text-brand-ink">
                See pricing
              </Link>
            </div>
            <div className="mt-[26px] text-[13px] text-neutral-600">Free on iPhone, Android and the web</div>
          </div>

          <div className="min-w-0 flex-[1_1_520px]">
            <div key={`stage-${story.id}`} className="duration-500 animate-in fade-in-0 motion-reduce:animate-none">
              <ProductStage story={story} />
            </div>
            <ScreenCaption>{story.caption}</ScreenCaption>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Features"
          className="mt-12 grid grid-cols-[repeat(6,minmax(140px,1fr))] gap-4 overflow-x-auto pb-9"
        >
          {STORIES.map((s, i) => {
            const selected = i === tab;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="hero-panel"
                onClick={() => pick(i)}
                className="group p-0 text-left text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="mb-3.5 block h-1 overflow-hidden bg-neutral-300">
                  {selected && (
                    <span
                      key={`bar-${cycle}-${tab}`}
                      className={cn("block h-full bg-brand", reduced ? "w-full" : "animate-rail-fill")}
                    />
                  )}
                </span>
                <span className="mb-1.5 block text-xs font-bold">{s.eyebrow}</span>
                <span
                  className={cn(
                    "block text-[15px] leading-[1.35]",
                    selected ? "font-semibold text-brand-ink" : "text-neutral-500 group-hover:text-brand-ink"
                  )}
                >
                  {s.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
