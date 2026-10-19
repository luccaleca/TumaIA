"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, fetchMe } from "../../lib/auth";
import { landingCopy } from "../../content/landing-copy";
import { useActiveSection } from "../../hooks/useActiveSection";
import { useScrollProgress } from "../../hooks/useScrollProgress";
import Button from "../ui/Button";

const SECTION_IDS = landingCopy.nav.map((n) => n.id);

export default function Header() {
  const [authReady, setAuthReady] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeNav = useActiveSection(SECTION_IDS);
  const progress = useScrollProgress();

  useEffect(() => {
    let active = true;
    fetchMe().then(({ ok, usuario }) => {
      if (!active) return;
      if (ok && usuario) {
        const fallback = usuario?.email ? String(usuario.email).split("@")[0] : "usuário";
        setUsuarioNome(String(usuario.nome || "").trim() || fallback || "usuário");
      } else {
        setUsuarioNome("");
      }
      setAuthReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
      const hero = document.getElementById("inicio");
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - 80 : 720;
      setOnHero(window.scrollY < heroEnd);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onLogout() {
    clearToken();
    setUsuarioNome("");
    setMenuOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  const barTone = onHero && !scrolled
    ? "bg-transparent border-transparent shadow-none"
    : onHero
      ? "border-white/15 bg-black/35 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      : "border-[var(--line)] bg-white/90 shadow-[var(--shadow-sm)] backdrop-blur-xl";

  const linkIdle = onHero ? "text-white/75 hover:text-white" : "text-[var(--muted)] hover:text-[var(--text)]";
  const linkActive = onHero
    ? "bg-white/15 text-white ring-1 ring-white/20"
    : "bg-[var(--brand-500)] text-[var(--ink-950)]";

  return (
    <>
      <div
        className="pointer-events-none fixed left-0 top-0 z-[60] h-0.5 bg-[var(--brand-500)] transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6 md:pt-4">
        <div
          className={`pointer-events-auto mx-auto flex w-full max-w-[1100px] items-center justify-between gap-3 rounded-full border px-4 transition-all duration-300 ${
            scrolled ? "py-2.5" : "py-3"
          } ${barTone}`}
        >
          <a href="#inicio" className="text-xl font-bold tracking-tight" onClick={closeMenu}>
            <span className={onHero ? "text-white" : "text-[var(--text)]"}>{landingCopy.brand.name}</span>
            <span className="text-[var(--brand-500)]">{landingCopy.brand.suffix}</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
            {landingCopy.nav.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  activeNav === item.id ? linkActive : linkIdle
                }`}
                aria-current={activeNav === item.id ? "true" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {authReady && usuarioNome ? (
              <>
                <span className={`text-sm ${onHero ? "text-white/80" : "text-[var(--muted)]"}`}>
                  Olá, <strong className={onHero ? "text-white" : "text-[var(--text)]"}>{usuarioNome}</strong>
                </span>
                <Button href="/painel" variant={onHero ? "ghost" : "secondary"} size="md">
                  {landingCopy.auth.areaUsuario}
                </Button>
                <Button type="button" onClick={onLogout} variant="primary" size="md">
                  {landingCopy.auth.sair}
                </Button>
              </>
            ) : (
              <>
                <Button href="/login" variant={onHero ? "ghost" : "secondary"} size="md">
                  {landingCopy.auth.entrar}
                </Button>
                <Button href="/cadastro" variant="primary" size="md">
                  {landingCopy.auth.cadastrar}
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full md:hidden ${
              onHero ? "text-white" : "text-[var(--text)]"
            }`}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-drawer"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[55] md:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar menu" onClick={closeMenu} />
          <div
            id="landing-mobile-drawer"
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col gap-6 bg-[var(--ink-950)] p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">
                {landingCopy.brand.name}
                <span className="text-[var(--brand-500)]">{landingCopy.brand.suffix}</span>
              </span>
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center" onClick={closeMenu} aria-label="Fechar">
                <X size={22} />
              </button>
            </div>
            <nav className="flex flex-col gap-2" aria-label="Mobile">
              {landingCopy.nav.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-xl px-3 py-3 text-lg font-medium text-white/90 hover:bg-white/10"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3">
              {authReady && usuarioNome ? (
                <>
                  <Link href="/painel" onClick={closeMenu} className="rounded-full border border-white/25 px-4 py-3 text-center font-semibold">
                    {landingCopy.auth.areaUsuario}
                  </Link>
                  <button type="button" onClick={onLogout} className="rounded-full bg-[var(--brand-500)] px-4 py-3 font-semibold text-[var(--ink-950)]">
                    {landingCopy.auth.sair}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={closeMenu} className="rounded-full border border-white/25 px-4 py-3 text-center font-semibold">
                    {landingCopy.auth.entrar}
                  </Link>
                  <Link href="/cadastro" onClick={closeMenu} className="rounded-full bg-[var(--brand-500)] px-4 py-3 text-center font-semibold text-[var(--ink-950)]">
                    {landingCopy.auth.cadastrar}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
