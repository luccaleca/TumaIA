import { PRODUTO } from "./content";
import Icon from "./Icons";
import ProductionFlow from "./ProductionFlow";
import { Section, SectionHeader } from "./ui";

function Stepper() {
  return (
    <ol className="lp-stepper">
      <span className="lp-stepper__line" aria-hidden="true" />
      {PRODUTO.passos.map((p, i) => (
        <li key={p.num} className="lp-step" style={{ "--i": i }}>
          <span className="lp-step__num">{p.num}</span>
          <span className="lp-step__icon">
            <Icon name={p.icon} size={22} />
          </span>
          <h3>{p.titulo}</h3>
          <p>{p.texto}</p>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorks() {
  return (
    <Section id="produto" tone="white" aria-labelledby="lp-produto-title">
      <div>
        <SectionHeader
          eyebrow={PRODUTO.eyebrow}
          title={PRODUTO.titulo}
          text={PRODUTO.texto}
          titleId="lp-produto-title"
        />
      </div>

      <Stepper />

      <div className="lp-product-grid">
        <div className="lp-auto-wrap">
          <article className="lp-auto">
            <span className="lp-auto__tag">
              <Icon name="sparkles" size={16} />
              Identidade da marca
            </span>
            <h3>{PRODUTO.automacao.titulo}</h3>
            <p>{PRODUTO.automacao.texto}</p>
            <div className="lp-auto__art" aria-hidden="true">
              <span className="lp-auto__swatches">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="lp-auto__lines">
                <i />
                <i />
              </span>
            </div>
          </article>
        </div>
        <div className="lp-flow-wrap">
          <ProductionFlow />
        </div>
      </div>
    </Section>
  );
}
