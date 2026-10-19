"use client";

import { ExternalLink, Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import Button from "../ui/Button";
import PhoneFrame from "../ui/PhoneFrame";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

export default function Demo() {
  const [playing, setPlaying] = useState(false);
  const copy = landingCopy.demo;
  const cover = landingImages.demoCover;

  return (
    <Section id="video" tone="paper">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
          <div className="mt-6">
            <Button
              href={copy.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              icon={<ExternalLink size={16} aria-hidden />}
            >
              {copy.youtubeLabel}
            </Button>
          </div>
        </Reveal>

        <Reveal delay={120} className="relative">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,179,65,0.22),transparent_70%)]"
            aria-hidden
          />
          <PhoneFrame>
            {playing ? (
              <iframe
                className="absolute inset-0 h-full w-full border-0"
                src={`https://www.youtube-nocookie.com/embed/${copy.youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title="Vídeo explicativo do TumaIA"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                className="group absolute inset-0"
                onClick={() => setPlaying(true)}
                aria-label="Reproduzir vídeo de demonstração"
              >
                {/* TODO: trocar capa */}
                <Image
                  src={cover.src}
                  alt={cover.alt}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  style={{ objectPosition: cover.objectPosition }}
                  sizes="280px"
                />
                <div className="absolute inset-0 bg-[var(--ink-950)]/35" aria-hidden />
                <span className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--brand-500)] text-[var(--ink-950)] shadow-[var(--glow)] transition group-hover:scale-110">
                  <Play size={28} fill="currentColor" aria-hidden />
                </span>
              </button>
            )}
          </PhoneFrame>
        </Reveal>
      </div>
    </Section>
  );
}
