"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { landingCopy } from "../../content/landing-copy";
import Container from "../ui/Container";

export default function Footer() {
  const [showTop, setShowTop] = useState(false);
  const year = new Date().getFullYear();

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
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
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
