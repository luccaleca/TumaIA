"use client";

import { useRef, useState } from "react";
import { DEPOIMENTOS } from "./content";
import Icon from "./Icons";
import { Section, SectionHeader } from "./ui";

function iniciais(nome) {
  const partes = nome.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes.length > 1 ? partes[partes.length - 1][0] : ""}`.toUpperCase();
}

export default function Testimonials() {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth;
    setIndex(Math.min(DEPOIMENTOS.itens.length - 1, Math.round(el.scrollLeft / step)));
  }

  function goTo(i) {
    const el = trackRef.current;
    const card = el?.children[i];
    if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  return (
    <Section id="depoimentos" tone="white" aria-labelledby="lp-depo-title">
      <div>
        <SectionHeader
          eyebrow={DEPOIMENTOS.eyebrow}
          title={DEPOIMENTOS.titulo}
          text={DEPOIMENTOS.texto}
          titleId="lp-depo-title"
        />
      </div>

      <div className="lp-quotes" ref={trackRef} onScroll={onScroll}>
        {DEPOIMENTOS.itens.map((d, i) => (
          <figure key={d.nome} className={`lp-quote ${i === 0 ? "lp-quote--lead" : ""}`}>
            <Icon name="quote" size={i === 0 ? 44 : 30} className="lp-quote__mark" />
            <blockquote>
              <p>{d.texto}</p>
            </blockquote>
            <figcaption>
              <span className="lp-avatar" aria-hidden="true">
                {iniciais(d.nome)}
              </span>
              <span>
                <strong>{d.nome}</strong>
                <small>{d.cargo}</small>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="lp-dots" role="group" aria-label="Depoimentos">
        {DEPOIMENTOS.itens.map((d, i) => (
          <button
            key={d.nome}
            type="button"
            className={i === index ? "is-on" : ""}
            aria-label={`Ver depoimento de ${d.nome}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </Section>
  );
}
