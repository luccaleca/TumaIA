"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CREDITS, FOOTER_DESCRICAO, INSTAGRAM_URL, NAV_LINKS } from "./content";
import Icon from "./Icons";

export default function Footer() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__grid">
            <div className="lp-footer__brand">
              <a href="#inicio" className="lp-logo" aria-label="TumaIA, voltar ao início">
                Tuma<span>IA</span>
              </a>
              <p>{FOOTER_DESCRICAO}</p>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-footer__social"
                aria-label="TumaIA no Instagram (abre em nova aba)"
              >
                <Icon name="instagram" size={20} />
                <span>Instagram</span>
                <Icon name="arrowUpRight" size={16} />
              </a>
            </div>
            <nav aria-label="Rodapé: navegação">
              <h2>Navegação</h2>
              <ul>
                {NAV_LINKS.map((l) => (
                  <li key={l.id}>
                    <a href={`#${l.id}`}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Rodapé: conta">
              <h2>Conta</h2>
              <ul>
                <li>
                  <Link href="/login">Entrar</Link>
                </li>
                <li>
                  <Link href="/cadastro">Cadastrar</Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="lp-footer__bottom">
            <p>© {new Date().getFullYear()} TumaIA</p>
            {CREDITS.length ? <p className="lp-footer__credits">{CREDITS.join(" · ")}</p> : null}
          </div>
        </div>
      </footer>
      <button
        type="button"
        className={`lp-top ${showTop ? "is-visible" : ""}`}
        aria-label="Voltar ao topo"
        tabIndex={showTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Icon name="chevronUp" size={22} />
      </button>
    </>
  );
}
