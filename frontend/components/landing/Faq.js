"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import Mascot from "../ui/Mascot";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

export default function Faq() {
  const copy = landingCopy.faq;
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <Section id="faq" tone="surface">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SectionHeader eyebrow={copy.eyebrow} title={copy.title} />
            <Mascot
              image={landingImages.faqMascot}
              className="mt-8 hidden h-40 w-40 lg:block"
              sizes="160px"
            />
          </div>
        </Reveal>

        <div className="space-y-3 lg:col-span-8">
          {copy.items.map((item, i) => {
            const isOpen = open === i;
            const panelId = `${baseId}-panel-${i}`;
            const buttonId = `${baseId}-button-${i}`;
            return (
              <Reveal key={item.q} delay={i * 50}>
                <div className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
                  <h3>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[1.0625rem] font-medium text-[var(--text)]"
                      onClick={() => setOpen(isOpen ? -1 : i)}
                    >
                      <span>{item.q}</span>
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-[var(--brand-700)]">
                        {isOpen ? <Minus size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.22,.8,.2,1)] ${
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-[var(--line)] px-5 pb-5 pt-3 text-base leading-relaxed text-[var(--muted)]">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
