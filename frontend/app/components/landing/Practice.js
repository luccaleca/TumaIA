import Image from "next/image";
import { PRATICA } from "./content";
import { landingImages } from "./images";
import Spot from "./Spot";
import { Section, SectionHeader } from "./ui";

export default function Practice() {
  return (
    <Section tone="paper" aria-labelledby="lp-pratica-title">
      <div>
        <SectionHeader
          eyebrow={PRATICA.eyebrow}
          title={PRATICA.titulo}
          text={PRATICA.texto}
          titleId="lp-pratica-title"
        />
      </div>
      <div className="lp-bento">
        {PRATICA.cards.map((card, i) => {
          const img = landingImages[card.slot];
          return (
            <div key={card.slot} className={`lp-bento__item lp-bento__item--${i + 1}`}>
              <Spot as="article" className="lp-photo-card">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes={i === 0 ? "(max-width: 900px) 100vw, 700px" : "(max-width: 900px) 100vw, 500px"}
                  style={{ objectPosition: img.objectPosition }}
                />
                <div className="lp-photo-card__tint" aria-hidden="true" />
                <div className="lp-photo-card__caption">
                  <h3>{card.titulo}</h3>
                  <p>{card.texto}</p>
                </div>
              </Spot>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
