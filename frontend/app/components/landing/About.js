import { SOBRE } from "./content";
import { Section, SectionHeader } from "./ui";

export default function About() {
  return (
    <Section id="quem-somos" tone="white" aria-labelledby="lp-sobre-title">
      <div className="lp-about">
        <div>
          <SectionHeader eyebrow={SOBRE.eyebrow} title={SOBRE.titulo} text={SOBRE.texto} titleId="lp-sobre-title" />
        </div>
        <ol className="lp-values">
          {SOBRE.valores.map(([titulo, texto], i) => (
            <li key={titulo}>
              <span className="lp-values__n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
