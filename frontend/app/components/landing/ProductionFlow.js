"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PRODUTO } from "./content";
import { useInView, usePrefersReducedMotion } from "./hooks";
import Icon from "./Icons";
import { landingImages } from "./images";
import Spot from "./Spot";

const STEP_MS = 3500;

function ScreenRequest() {
  return (
    <div className="lp-screen lp-screen--chat">
      <div className="lp-msg lp-msg--out lp-msg--text">
        <span>Quero um post da promoção de sexta, pizza grande por R$ 59</span>
      </div>
      <p className="lp-screen__status">Enviado</p>
    </div>
  );
}

function ScreenProcessing() {
  return (
    <div className="lp-screen lp-screen--chat">
      <div className="lp-msg lp-msg--in lp-typing" aria-hidden="true">
        <b />
        <b />
        <b />
      </div>
      <div className="lp-shimmer" aria-hidden="true" />
      <p className="lp-screen__status">Criando arte e legenda…</p>
    </div>
  );
}

function ScreenPreview() {
  const img = landingImages.flowPreview;
  return (
    <div className="lp-screen lp-screen--chat">
      <div className="lp-msg lp-msg--in lp-msg--card">
        <div className="lp-msg__img">
          <Image src={img.src} alt={img.alt} fill sizes="240px" style={{ objectPosition: img.objectPosition }} />
        </div>
        <p>Sua legenda está pronta. Quer publicar?</p>
        <span className="lp-msg__btn">Aprovar</span>
      </div>
    </div>
  );
}

function ScreenPublished() {
  const img = landingImages.flowPreview;
  return (
    <div className="lp-screen lp-screen--post">
      <div className="lp-post__head">
        <span className="lp-post__avatar" aria-hidden="true" />
        <strong>sua.marca</strong>
      </div>
      <div className="lp-post__img">
        <Image src={img.src} alt={img.alt} fill sizes="240px" style={{ objectPosition: img.objectPosition }} />
      </div>
      <div className="lp-post__actions">
        <Icon name="heart" size={22} className="lp-post__heart" />
        <span>Publicado</span>
      </div>
    </div>
  );
}

const SCREENS = [ScreenRequest, ScreenProcessing, ScreenPreview, ScreenPublished];

export default function ProductionFlow() {
  const passos = PRODUTO.fluxo.passos;
  const [active, setActive] = useState(0);
  const [userControlled, setUserControlled] = useState(false);
  const [ref, inView] = useInView({ once: false, threshold: 0.3, rootMargin: "0px" });
  const reduced = usePrefersReducedMotion();
  const autoplay = inView && !userControlled && !reduced;

  useEffect(() => {
    if (!autoplay) return undefined;
    const t = setTimeout(() => setActive((a) => (a + 1) % passos.length), STEP_MS);
    return () => clearTimeout(t);
  }, [autoplay, active, passos.length]);

  const Screen = SCREENS[active];
  const mascot = landingImages.mascot;

  return (
    <Spot className="lp-flow" ref={ref} aria-labelledby="lp-flow-title">
      <div className="lp-flow__list">
        <h3 id="lp-flow-title">{PRODUTO.fluxo.titulo}</h3>
        <ol>
          {passos.map((texto, i) => (
            <li key={texto} className={i === active ? "is-active" : i < active ? "is-done" : ""}>
              <button
                type="button"
                onClick={() => {
                  setUserControlled(true);
                  setActive(i);
                }}
                aria-current={i === active ? "step" : undefined}
              >
                <span className="lp-flow__n">{i + 1}</span>
                <span className="lp-flow__t">{texto}</span>
                <span className="lp-flow__bar" aria-hidden="true">
                  <i
                    key={`${active}-${autoplay}`}
                    className={i === active && autoplay ? "is-running" : i === active ? "is-full" : ""}
                    style={{ "--ms": `${STEP_MS}ms` }}
                  />
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="lp-flow__device">
        <div className="lp-phone lp-phone--sm">
          <div className="lp-phone__body">
            <span className="lp-phone__island" aria-hidden="true" />
            <div className="lp-phone__screen lp-phone__screen--app" aria-live="polite">
              <Screen key={active} />
            </div>
          </div>
        </div>
        <Image
          src={mascot.src}
          alt={mascot.alt}
          width={mascot.width}
          height={mascot.height}
          sizes="150px"
          className="lp-flow__mascot"
        />
      </div>
    </Spot>
  );
}
