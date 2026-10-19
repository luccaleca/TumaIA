"use client";

import Image from "next/image";
import { useState } from "react";
import { FAQ } from "./content";
import Icon from "./Icons";
import { landingImages } from "./images";
import { Section, SectionHeader } from "./ui";

export default function Faq() {
  const [open, setOpen] = useState(0);
  const mascot = landingImages.mascot;

  return (
    <Section id="faq" tone="paper" aria-labelledby="lp-faq-title">
      <div className="lp-faq">
        <div className="lp-faq__side">
          <SectionHeader eyebrow={FAQ.eyebrow} title={FAQ.titulo} titleId="lp-faq-title" />
          <Image
            src={mascot.src}
            alt=""
            width={mascot.width}
            height={mascot.height}
            sizes="120px"
            className="lp-faq__mascot"
          />
        </div>

        <div className="lp-faq__list">
          {FAQ.itens.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`lp-acc ${isOpen ? "is-open" : ""}`}>
                <h3>
                  <button
                    type="button"
                    id={`lp-acc-b-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`lp-acc-p-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <Icon name="plus" size={22} className="lp-acc__icon" />
                  </button>
                </h3>
                <div id={`lp-acc-p-${i}`} role="region" aria-labelledby={`lp-acc-b-${i}`} className="lp-acc__panel">
                  <div>
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
