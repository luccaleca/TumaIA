"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import Container from "../ui/Container";

function InstagramIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
    </svg>
  );
}

export default function Footer() {
  const [showTop, setShowTop] = useState(false);
  const year = new Date().getFullYear();
  const ig = landingCopy.footer.instagram;

  useEffect(() => {
    function onScroll() {
      setShowTop(window.scrollY > 600);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <footer className="border-t border-white/10 bg-[var(--ink-950)] text-white">
      <Container className="py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="#inicio" className="text-xl font-bold tracking-tight">
              {landingCopy.brand.name}
              <span className="text-[var(--brand-500)]">{landingCopy.brand.suffix}</span>
            </a>
            <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-white/65">{landingCopy.footer.blurb}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">Navegação</p>
            <ul className="mt-3 space-y-2">
              {landingCopy.nav.map((item) => (
                <li key={item.id}>
                  <a href={item.href} className="text-sm text-white/65 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">Conta</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/login" className="text-sm text-white/65 transition hover:text-white">
                  {landingCopy.auth.entrar}
                </Link>
              </li>
              <li>
                <Link href="/cadastro" className="text-sm text-white/65 transition hover:text-white">
                  {landingCopy.auth.cadastrar}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-white/90">{landingCopy.footer.socialTitle}</p>
            <a
              href={ig.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/80 transition hover:border-[var(--brand-500)]/50 hover:bg-white/10 hover:text-white"
              aria-label={`Instagram ${ig.label}`}
            >
              <InstagramIcon size={18} />
              {ig.label}
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <p className="text-xs text-white/45">© {year} TumaIA</p>
          {showTop ? (
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
            >
              <ArrowUp size={14} aria-hidden />
              {landingCopy.footer.backToTop}
            </button>
          ) : (
            <span className="h-9" aria-hidden />
          )}
        </div>
      </Container>
    </footer>
  );
}
