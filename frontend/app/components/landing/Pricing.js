"use client";

import { useState } from "react";
import { PLANOS } from "./content";
import Icon from "./Icons";
import { Button, Section, SectionHeader } from "./ui";

function PlanCard({ plano, index }) {
  const itens = PLANOS.linhas.filter((l) => l.card).map((l) => `${l.recurso}: ${l.valores[index]}`);
  const variant = plano.destaque ? "primary" : index === 0 ? "outline" : "dark";
  return (
    <div className={`lp-plan-wrap ${plano.destaque ? "is-featured" : ""}`}>
      <article className={`lp-plan ${plano.destaque ? "lp-plan--pro" : ""}`}>
        {plano.destaque ? <span className="lp-plan__badge">Popular</span> : null}
        <p className="lp-plan__kicker">Plano</p>
        <h3>{plano.nome}</h3>
        <p className="lp-plan__price">
          <strong>{plano.preco}</strong>
          <span>/mês</span>
        </p>
        <p className="lp-plan__text">{plano.texto}</p>
        <ul className="lp-plan__list">
          {itens.map((t) => (
            <li key={t}>
              <Icon name="check" size={18} strokeWidth={2.4} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Button href="/cadastro" variant={variant} size="lg" className="lp-plan__cta">
          Começar agora
        </Button>
      </article>
    </div>
  );
}

export default function Pricing() {
  const [selected, setSelected] = useState(1);

  return (
    <Section id="planos" tone="paper" aria-labelledby="lp-planos-title">
      <div>
        <SectionHeader eyebrow={PLANOS.eyebrow} title={PLANOS.titulo} text={PLANOS.texto} titleId="lp-planos-title" />
      </div>

      <div className="lp-plans">
        {PLANOS.planos.map((p, i) => (
          <PlanCard key={p.id} plano={p} index={i} />
        ))}
      </div>

      <div className="lp-compare">
        <h3 className="lp-compare__title">{PLANOS.tabelaTitulo}</h3>

        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th scope="col">Recurso</th>
                {PLANOS.planos.map((p) => (
                  <th key={p.id} scope="col" className={p.destaque ? "is-pro" : ""}>
                    {p.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANOS.linhas.map((l) => (
                <tr key={l.recurso}>
                  <th scope="row">{l.recurso}</th>
                  {l.valores.map((v, i) => (
                    <td key={v} className={PLANOS.planos[i].destaque ? "is-pro" : ""}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lp-compare-m">
          <div className="lp-seg" role="tablist" aria-label="Escolha um plano para comparar">
            {PLANOS.planos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`lp-seg-${p.id}`}
                aria-selected={selected === i}
                aria-controls="lp-seg-panel"
                className={selected === i ? "is-on" : ""}
                onClick={() => setSelected(i)}
              >
                {p.nome}
              </button>
            ))}
          </div>
          <dl id="lp-seg-panel" role="tabpanel" aria-labelledby={`lp-seg-${PLANOS.planos[selected].id}`}>
            {PLANOS.linhas.map((l) => (
              <div key={l.recurso}>
                <dt>{l.recurso}</dt>
                <dd>{l.valores[selected]}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="lp-compare__note">{PLANOS.nota}</p>
      </div>

      <div className="lp-tokens">
        <div className="lp-tokens__intro">
          <h3>{PLANOS.tokens.titulo}</h3>
          <p>{PLANOS.tokens.texto}</p>
        </div>
        <ul className="lp-tokens__grid">
          {PLANOS.tokens.pacotes.map((p) => (
            <li key={p.tokens} className="lp-token">
              <span className="lp-token__qty">
                {p.tokens} {p.tokens === 1 ? "token" : "tokens"}
              </span>
              <strong className="lp-token__price">{p.preco}</strong>
              <span className="lp-token__per">{p.porToken} por token</span>
              {p.desconto ? <span className="lp-token__off">{p.desconto} de desconto</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
