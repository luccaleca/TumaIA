import Image from "next/image";
import { landingCopy } from "../../content/landing-copy";
import { landingImages } from "../../content/landing-images";
import Reveal from "../ui/Reveal";
import Section from "../ui/Section";
import SectionHeader from "../ui/SectionHeader";

export default function Practice() {
  const copy = landingCopy.practice;
  const cards = copy.cards.map((card) => ({ ...card, image: landingImages[card.slot] }));

  return (
    <Section tone="surface">
      <Reveal>
        <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      </Reveal>

      <div className="mt-10 grid auto-rows-[minmax(240px,auto)] grid-cols-1 gap-4 md:h-[540px] md:auto-rows-fr md:grid-cols-2 md:grid-rows-2 md:gap-5">
        {cards.map((card, i) => {
          const large = i === 0;
          return (
            <Reveal
              key={card.titulo}
              delay={i * 80}
              className={`h-full min-h-[240px] ${large ? "md:row-span-2" : ""}`}
            >
              <article className="landing-spotlight group relative h-full min-h-[240px] overflow-hidden rounded-[24px]">
                <Image
                  src={card.image.src}
                  alt={card.image.alt}
                  fill
                  className="object-cover transition duration-700 ease-out group-hover:scale-105"
                  style={{ objectPosition: card.image.objectPosition }}
                  sizes={large ? "(max-width:768px) 100vw, 50vw" : "(max-width:768px) 100vw, 50vw"}
                />
                <div
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,18,12,0.2)_0%,rgba(6,18,12,0.82)_100%)]"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 p-5 transition duration-500 group-hover:-translate-y-1 md:p-6">
                  <h3 className="text-xl font-semibold text-white">{card.titulo}</h3>
                  <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-white/85 md:text-[0.95rem]">
                    {card.texto}
                  </p>
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
