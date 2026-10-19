"use client";

import { Check, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import { useInView } from "../../hooks/useInView";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import Mascot from "../ui/Mascot";
import PhoneFrame from "../ui/PhoneFrame";

function FlowPhone({ step }) {
  return (
    <PhoneFrame className="max-w-[230px]">
      <div className="flex h-full flex-col bg-[#07140f] p-4 pt-8 text-[11px] text-white">
        {step === 0 ? (
          <div className="mt-auto space-y-3">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#075E54] px-3 py-2">
              <div className="mb-1 flex items-end gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-block w-0.5 rounded-full bg-emerald-200/80"
                    style={{ height: `${6 + ((i * 7) % 14)}px` }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-emerald-50/90">Áudio · enviando…</p>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 space-y-3">
            <p className="text-white/50">TumaIA está digitando…</p>
            <div className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-emerald-900/50 to-slate-800/60" />
            <div className="h-3 w-[80%] rounded bg-white/10" />
            <div className="h-3 w-[60%] rounded bg-white/10" />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
              <div className="h-28 rounded-xl bg-gradient-to-br from-emerald-700/40 to-lime-600/30" />
              <p className="mt-2 text-[10px] leading-snug text-white/80">
                Prévia da arte + legenda prontas para você revisar.
              </p>
            </div>
            <button
              type="button"
              className="w-full rounded-full bg-[var(--brand-500)] py-2 text-[11px] font-semibold text-[var(--ink-950)]"
            >
              Aprovar
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 space-y-3">
            <div className="overflow-hidden rounded-2xl bg-white text-[var(--ink-950)]">
              <div className="h-32 bg-gradient-to-br from-emerald-400 to-lime-600" />
              <div className="space-y-2 p-2.5">
                <div className="flex items-center gap-1 text-rose-500">
                  <Heart size={14} fill="currentColor" className="animate-pulse" aria-hidden />
                  <span className="text-[10px] font-semibold">Publicado</span>
                </div>
                <p className="text-[10px] leading-snug text-zinc-600">Seu post já está no ar no Instagram.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PhoneFrame>
  );
}

export default function ProductionFlow() {
  const steps = landingCopy.product.flow.steps;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ once: false, threshold: 0.35 });

  useEffect(() => {
    if (reduced || paused || !inView) return undefined;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [reduced, paused, inView, steps.length]);

  return (
    <div
      ref={ref}
      className="relative overflow-visible rounded-[28px] bg-[var(--ink-900)] p-6 text-white shadow-[var(--shadow-lg)] md:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <h3 className="text-xl font-semibold md:text-2xl">{landingCopy.product.flow.title}</h3>
          <ol className="mt-6 space-y-3">
            {steps.map((text, i) => {
              const isActive = active === i;
              return (
                <li key={text}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setPaused(true);
                    }}
                    className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      isActive ? "bg-white/10 ring-1 ring-[var(--brand-400)]/40" : "hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isActive ? "bg-[var(--brand-500)] text-[var(--ink-950)]" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {isActive ? <Check size={14} aria-hidden /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-relaxed text-white/85">{text}</span>
                      {isActive && !reduced ? (
                        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
                          <span className="landing-flow-progress block h-full rounded-full bg-[var(--brand-500)]" />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="relative flex justify-center pb-10 pt-4 lg:pb-6">
          <FlowPhone step={active} />
          <Mascot
            image={landingImages.flowMascot}
            className="pointer-events-none absolute -bottom-2 -right-2 h-36 w-36 sm:h-44 sm:w-44 md:-right-4 md:h-52 md:w-52"
            sizes="208px"
          />
        </div>
      </div>
    </div>
  );
}
