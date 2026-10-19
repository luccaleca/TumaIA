"use client";

import { landingCopy } from "../../content/landing-copy";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Avatar({ name }) {
  return (
    <span
      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-500),var(--forest-800))] text-sm font-bold text-white"
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export default function Testimonials() {
  const copy = landingCopy.testimonials;
  const [featured, ...rest] = copy.items;

  return (
    <Section id="depoimentos" tone="paper">
      <Reveal>
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      </Reveal>

      <div className="mt-10 hidden gap-5 md:grid md:grid-cols-12">
        <Reveal className="md:col-span-7">
          <article className="h-full rounded-[28px] border border-[var(--line)] bg-[var(--surface-elevated)] p-8 shadow-[var(--shadow-sm)]">
            <p className="font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--brand-400)]" aria-hidden>
              “
            </p>
            <p className="mt-2 text-balance text-[1.35rem] font-medium leading-snug text-[var(--text)] md:text-[1.5rem]">
              {featured.texto}
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Avatar name={featured.nome} />
              <div>
                <p className="font-semibold text-[var(--text)]">{featured.nome}</p>
                <p className="text-sm text-[var(--muted)]">{featured.cargo}</p>
              </div>
            </div>
          </article>
        </Reveal>
        <div className="flex flex-col gap-5 md:col-span-5">
          {rest.map((d, i) => (
            <Reveal key={d.nome} delay={(i + 1) * 80}>
              <article className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-sm)]">
                <p className="text-[0.95rem] leading-relaxed text-[var(--muted)]">&ldquo;{d.texto}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <Avatar name={d.nome} />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{d.nome}</p>
                    <p className="text-xs text-[var(--muted)]">{d.cargo}</p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="mt-8 md:hidden">
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {copy.items.map((d) => (
            <article
              key={d.nome}
              className="w-[85%] shrink-0 snap-center rounded-[24px] border border-[var(--line)] bg-[var(--surface-elevated)] p-6 shadow-[var(--shadow-sm)]"
            >
              <p className="text-[0.95rem] leading-relaxed text-[var(--muted)]">&ldquo;{d.texto}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <Avatar name={d.nome} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{d.nome}</p>
                  <p className="text-xs text-[var(--muted)]">{d.cargo}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
