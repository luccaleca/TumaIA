"use client";

import { useState } from "react";
import { DEMO, YOUTUBE_DEMO_URL, YOUTUBE_VIDEO_ID } from "./content";
import Icon from "./Icons";
import { landingImages } from "./images";
import { Button, Section, SectionHeader } from "./ui";

function PhoneVideo() {
  const [playing, setPlaying] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = landingImages.demoCover;
  const embedSrc = `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className="lp-phone">
      <div className="lp-phone__body">
        <span className="lp-phone__island" aria-hidden="true" />
        <div className="lp-phone__screen">
          {playing ? (
            <iframe
              src={embedSrc}
              title="Vídeo explicativo do TumaIA"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <button type="button" className="lp-phone__facade" onClick={() => setPlaying(true)}>
              {!coverFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- capa externa do YouTube, carregada sob demanda
                <img
                  src={cover.src}
                  alt={cover.alt}
                  width={cover.width}
                  height={cover.height}
                  loading="lazy"
                  style={{ objectPosition: cover.objectPosition }}
                  onError={() => setCoverFailed(true)}
                />
              ) : null}
              <span className="lp-phone__shade" aria-hidden="true" />
              <span className="lp-phone__play">
                <Icon name="play" size={30} />
              </span>
              <span className="lp-sr">Reproduzir vídeo de demonstração</span>
            </button>
          )}
        </div>
        <span className="lp-phone__glare" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <Section id="video" tone="white" aria-labelledby="lp-demo-title">
      <div className="lp-demo">
        <div className="lp-demo__copy">
          <SectionHeader eyebrow={DEMO.eyebrow} title={DEMO.titulo} text={DEMO.texto} titleId="lp-demo-title" />
          <div className="lp-demo__btn">
            <Button href={YOUTUBE_DEMO_URL} external variant="dark" size="lg" icon="arrowUpRight">
              Abrir no YouTube
            </Button>
          </div>
        </div>
        <div className="lp-demo__stage">
          <div className="lp-demo__halo" aria-hidden="true" />
          <div className="lp-float lp-float--d" aria-hidden="true">
            <div className="lp-bubble lp-bubble--light">
              <Icon name="message" size={18} />
              <span>Quero um post da promoção</span>
            </div>
          </div>
          <PhoneVideo />
          <div className="lp-float lp-float--e" aria-hidden="true">
            <div className="lp-seal lp-seal--light">
              <Icon name="check" size={16} strokeWidth={2.4} />
              Post aprovado
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
