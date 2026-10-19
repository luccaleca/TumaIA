"use client";

import { ImageIcon, Share2, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import { useInView } from "../../hooks/useInView";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import Card from "../ui/Card";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";
import ProductionFlow from "./ProductionFlow";

const stepIcons = [Wifi, ImageIcon, Share2];

export default function HowItWorks() {
  const copy = landingCopy.product;
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ threshold: 0.25 });
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (inView) setDrawn(true);
  }, [inView]);

  return (
    <Section id="produto" tone="paper">
      <Reveal>
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      </Reveal>

      <div ref={ref} className="relative mt-12">
        <div
          className="pointer-events-none absolute left-[8%] right-[8%] top-8 hidden h-px bg-[var(--line)] md:block"
          aria-hidden
        >
          <div
            className={`h-full origin-left bg-[var(--brand-500)] transition-transform duration-1000 ease-[cubic-bezier(.22,.8,.2,1)] ${
              drawn && !reduced ? "scale-x-100" : "scale-x-0"
            }`}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {copy.steps.map((passo, i) => {
            const Icon = stepIcons[i] || Wifi;
            return (
              <Reveal key={passo.num} delay={i * 90}>
                <article className="relative rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--brand-500)]/35">
                      {passo.num}
                    </span>
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[var(--brand-700)]">
                      <Icon size={18} aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[var(--text)]">{passo.titulo}</h3>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--muted)]">{passo.texto}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal>
          <Card variant="flat" className="h-full bg-[var(--paper)] p-7 md:p-8">
            <div className="mb-4 h-1.5 w-16 rounded-full bg-[var(--brand-500)]" aria-hidden />
            <h3 className="text-xl font-semibold text-[var(--text)] md:text-2xl">{copy.automation.title}</h3>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--muted)] md:text-[1.05rem]">
              {copy.automation.text}
            </p>
          </Card>
        </Reveal>
        <Reveal delay={100}>
          <ProductionFlow />
        </Reveal>
      </div>
    </Section>
  );
}
