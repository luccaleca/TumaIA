"use client";

import { CheckCircle2, MessageCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import Button from "../ui/Button";
import Container from "../ui/Container";

const chipIcons = [MessageCircle, Sparkles, CheckCircle2];

export default function Hero() {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState(0);
  const photo = landingImages.heroPhoto;
  const copy = landingCopy.hero;

  useEffect(() => {
    if (reduced) return undefined;
    function onScroll() {
      const hero = document.getElementById("inicio");
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
      setOffset(progress * 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduced]);

  return (
    <section
      id="inicio"
      className="relative min-h-[min(100svh,900px)] overflow-hidden bg-[var(--ink-950)] pt-28 text-white md:pt-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_75%_35%,rgba(0,179,65,0.22),transparent_60%)]"
        aria-hidden
      />

      <Container className="relative pb-16 md:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h1 className="landing-hero-enter landing-hero-enter-d1 max-w-[16ch] text-balance font-[family-name:var(--font-display)] text-[clamp(2.5rem,1.4rem+4.6vw,5rem)] font-extrabold leading-[1.02] tracking-[-0.035em]">
              {copy.titleBefore}{" "}
              <span className="bg-gradient-to-r from-[var(--mint-300)] to-[var(--brand-400)] bg-clip-text text-transparent">
                {copy.titleHighlight}
              </span>
            </h1>
            <p className="landing-hero-enter landing-hero-enter-d2 mt-5 max-w-[52ch] text-pretty text-[1.0625rem] leading-[1.65] text-white/80 md:text-lg">
              {copy.description}
            </p>
            <div className="landing-hero-enter landing-hero-enter-d2 mt-7 flex flex-wrap gap-3">
              <Button href="/cadastro" variant="primary" size="lg">
                {copy.ctaPrimary}
              </Button>
              <Button href="#produto" variant="ghost" size="lg">
                {copy.ctaSecondary}
              </Button>
            </div>
            <ul className="landing-hero-enter landing-hero-enter-d3 mt-8 flex flex-wrap gap-3">
              {copy.chips.map((chip, i) => {
                const Icon = chipIcons[i] || CheckCircle2;
                return (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/85"
                  >
                    <Icon size={16} className="text-[var(--brand-400)]" aria-hidden />
                    {chip}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative lg:col-span-5">
            <div
              className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[999px_999px_32px_32px] shadow-[var(--glow)]"
              style={{ transform: reduced ? undefined : `translate3d(0, ${offset * 0.45}px, 0)` }}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 420px"
                className="object-cover"
                style={{ objectPosition: photo.objectPosition }}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--ink-950)]/55 via-transparent to-black/10"
                aria-hidden
              />
            </div>

            <div
              className="landing-float absolute -left-2 top-10 z-10 rounded-2xl border border-white/15 bg-[var(--ink-900)]/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur sm:left-0"
              style={{ transform: reduced ? undefined : `translate3d(0, ${-offset * 0.3}px, 0)` }}
            >
              <span className="inline-flex items-center gap-2">
                <MessageCircle size={14} className="text-[var(--brand-400)]" aria-hidden />
                {copy.floatAudio}
              </span>
            </div>
            <div
              className="landing-float absolute -right-1 top-[42%] z-10 rounded-2xl border border-white/15 bg-[var(--ink-900)]/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur sm:right-2"
              style={{ animationDelay: "0.8s", transform: reduced ? undefined : `translate3d(0, ${offset * 0.25}px, 0)` }}
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--mint-300)]" aria-hidden />
                {copy.floatPreview}
              </span>
            </div>
            <div
              className="landing-float absolute bottom-8 left-4 z-10 rounded-2xl border border-white/15 bg-[var(--ink-900)]/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur sm:left-8"
              style={{ animationDelay: "1.4s" }}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[var(--brand-400)]" aria-hidden />
                {copy.floatPublished}
              </span>
            </div>
          </div>
        </div>
      </Container>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--paper)] to-transparent" aria-hidden />
    </section>
  );
}
