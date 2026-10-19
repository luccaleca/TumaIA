import Image from "next/image";
import { CTA_FINAL } from "./content";
import { landingImages } from "./images";
import Spot from "./Spot";
import { Button } from "./ui";

export default function FinalCta() {
  const bg = landingImages.ctaBackground;
  const mascot = landingImages.mascot;
  return (
    <section className="lp-section lp-section--paper lp-cta-section" aria-labelledby="lp-cta-title">
      <div className="lp-container">
        <div>
          <Spot className="lp-cta">
            <Image
              src={bg.src}
              alt={bg.alt}
              fill
              sizes="1240px"
              className="lp-cta__bg"
              style={{ objectPosition: bg.objectPosition }}
            />
            <div className="lp-cta__tint" aria-hidden="true" />
            <div className="lp-cta__noise" aria-hidden="true" />
            <Image
              src={mascot.src}
              alt={mascot.alt}
              width={mascot.width}
              height={mascot.height}
              sizes="140px"
              className="lp-cta__mascot"
            />
            <div className="lp-cta__body">
              <h2 id="lp-cta-title" className="lp-h2">
                {CTA_FINAL.titulo}
              </h2>
              <p>{CTA_FINAL.texto}</p>
              <div className="lp-cta__actions">
                <Button href="/cadastro" size="lg" icon="arrowRight">
                  Começar agora
                </Button>
                <Button href="/login" variant="outline-light" size="lg">
                  Já tenho conta
                </Button>
              </div>
            </div>
          </Spot>
        </div>
      </div>
    </section>
  );
}
