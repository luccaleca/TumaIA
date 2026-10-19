"use client";

import Image from "next/image";
import { useRef } from "react";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import Button from "../ui/Button";
import Container from "../ui/Container";
import Mascot from "../ui/Mascot";
import Reveal from "../ui/Reveal";

export default function FinalCta() {
  const copy = landingCopy.cta;
  const bg = landingImages.ctaBackground;
  const ref = useRef(null);

  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <section className="pb-[clamp(4.5rem,8vw,8rem)] pt-4">
      <Container>
        <Reveal>
          <div
            ref={ref}
            onMouseMove={onMove}
            className="landing-cta-panel relative overflow-visible rounded-[32px]"
          >
            <div className="absolute inset-0 overflow-hidden rounded-[32px]">
              <Image
                src={bg.src}
                alt=""
                fill
                className="object-cover"
                style={{ objectPosition: bg.objectPosition }}
                sizes="(max-width:1280px) 100vw, 1240px"
              />
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(6,18,12,0.88),rgba(14,42,28,0.72)_55%,rgba(6,18,12,0.82))]" aria-hidden />
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(420px circle at var(--mx,70%) var(--my,40%), rgba(0,179,65,0.35), transparent 55%)",
                }}
                aria-hidden
              />
            </div>

            <Mascot
              image={landingImages.ctaMascot}
              className="pointer-events-none absolute -top-16 left-6 z-20 h-28 w-28 sm:left-10 sm:h-32 sm:w-32 md:-top-20 md:h-36 md:w-36"
              sizes="144px"
            />

            <div className="relative z-10 px-6 py-16 text-center md:px-12 md:py-20">
              <h2 className="mx-auto max-w-[18ch] text-balance font-[family-name:var(--font-display)] text-[clamp(1.8rem,1.2rem+2vw,2.75rem)] font-bold tracking-tight text-white">
                {copy.title}
              </h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-pretty text-base leading-relaxed text-white/85">
                {copy.description}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href="/cadastro" variant="primary" size="lg">
                  {copy.primary}
                </Button>
                <Button href="/login" variant="outlineLight" size="lg">
                  {copy.secondary}
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
