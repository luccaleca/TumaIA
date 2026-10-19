import { landingCopy } from "../../content/landing-copy";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

export default function About() {
  const copy = landingCopy.about;

  return (
    <Section id="quem-somos" tone="paper">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
        </Reveal>
        <div className="lg:col-span-7">
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {copy.pillars.map(([titulo, texto], i) => (
              <Reveal key={titulo} delay={i * 80} as="li">
                <div className="grid grid-cols-[auto_1fr] gap-5 py-6 md:gap-8 md:py-7">
                  <span className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--brand-500)]/40 md:text-4xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)]">{titulo}</h3>
                    <p className="mt-2 max-w-[52ch] text-[0.95rem] leading-relaxed text-[var(--muted)]">{texto}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
