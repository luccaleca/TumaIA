import Image from "next/image";
import { HERO } from "./content";
import Icon from "./Icons";
import { landingImages } from "./images";
import { Button } from "./ui";

const CHIP_ICONS = ["message", "sparkles", "shield"];

export default function Hero() {
  const photo = landingImages.heroPhoto;
  return (
    <section id="inicio" className="lp-hero" aria-labelledby="lp-hero-title">
      <div className="lp-hero__glow" aria-hidden="true" />
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__copy">
          <h1 id="lp-hero-title" className="lp-h1 lp-enter" style={{ "--i": 0 }}>
            {HERO.titulo} <span className="lp-h1__accent">{HERO.destaque}</span>
          </h1>
          <p className="lp-hero__text lp-enter" style={{ "--i": 1 }}>
            {HERO.texto}
          </p>
          <div className="lp-hero__cta lp-enter" style={{ "--i": 2 }}>
            <Button href="/cadastro" size="lg" icon="arrowRight">
              Começar agora
            </Button>
            <Button href="#produto" variant="outline-light" size="lg">
              Como funciona
            </Button>
          </div>
          <ul className="lp-hero__chips lp-enter" style={{ "--i": 3 }}>
            {HERO.chips.map((chip, i) => (
              <li key={chip}>
                <Icon name={CHIP_ICONS[i]} size={18} />
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-hero__stage lp-enter" style={{ "--i": 2 }}>
          <div className="lp-hero__frame-wrap">
            <div className="lp-hero__frame">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                priority
                sizes="(max-width: 900px) 80vw, 480px"
                style={{ objectPosition: photo.objectPosition }}
              />
            </div>
          </div>
          <div className="lp-float lp-float--a">
            <div className="lp-bubble">
              <Icon name="message" size={18} />
              <span>Pedido enviado</span>
            </div>
          </div>
          <div className="lp-float lp-float--b">
            <div className="lp-notice">
              <span className="lp-notice__dot" aria-hidden="true" />
              <div>
                <strong>Post pronto</strong>
                <span>Prévia pronta para aprovar</span>
              </div>
            </div>
          </div>
          <div className="lp-float lp-float--c">
            <div className="lp-seal">
              <Icon name="check" size={16} strokeWidth={2.4} />
              Aprovado e publicado
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
