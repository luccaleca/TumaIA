"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearToken, fetchMe } from "../../../lib/auth";
import { NAV_LINKS } from "./content";
import Icon from "./Icons";
import { Button } from "./ui";

export default function Header() {
  const [authReady, setAuthReady] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pill, setPill] = useState(null);
  const progressRef = useRef(null);
  const navRef = useRef(null);
  const drawerRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetchMe().then(({ ok, usuario }) => {
      if (!alive) return;
      if (ok && usuario) {
        const fallback = usuario?.email ? String(usuario.email).split("@")[0] : "usuário";
        setUsuarioNome(String(usuario.nome || "").trim() || fallback || "usuário");
      } else {
        setUsuarioNome("");
      }
      setAuthReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`;
      setScrolled(window.scrollY > 24);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const els = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean);
    if (!els.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
          else setActive((cur) => (cur === entry.target.id ? "" : cur));
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const measurePill = useCallback(() => {
    const nav = navRef.current;
    const link = nav?.querySelector(`[data-nav="${active}"]`);
    if (!nav || !link) {
      setPill(null);
      return;
    }
    setPill({ left: link.offsetLeft, width: link.offsetWidth });
  }, [active]);

  useLayoutEffect(() => {
    measurePill();
    window.addEventListener("resize", measurePill);
    return () => window.removeEventListener("resize", measurePill);
  }, [measurePill]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      drawerRef.current ? [...drawerRef.current.querySelectorAll("a[href], button:not([disabled])")] : [];
    focusables()[0]?.focus();
    function onKey(e) {
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, closeMenu]);

  function onLogout() {
    clearToken();
    setUsuarioNome("");
  }

  const logged = authReady && usuarioNome;

  const actions = logged ? (
    <>
      <Button href="/painel" variant="ghost" size="md">
        Área do usuário
      </Button>
      <Button variant="primary" size="md" onClick={onLogout}>
        Sair
      </Button>
    </>
  ) : (
    <>
      <Button href="/login" variant="ghost" size="md">
        Entrar
      </Button>
      <Button href="/cadastro" variant="primary" size="md">
        Cadastrar
      </Button>
    </>
  );

  return (
    <>
      <div className="lp-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>
      <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="lp-header__bar">
          <a href="#inicio" className="lp-logo" aria-label="TumaIA, voltar ao início">
            Tuma<span>IA</span>
          </a>

          <nav className="lp-nav" aria-label="Principal" ref={navRef}>
            {pill ? (
              <span className="lp-nav__pill" style={{ width: pill.width, transform: `translateX(${pill.left}px)` }} />
            ) : null}
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                data-nav={l.id}
                className={active === l.id ? "is-active" : ""}
                aria-current={active === l.id ? "location" : undefined}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="lp-header__actions">
            {logged ? (
              <span className="lp-header__hello">
                Olá, <strong>{usuarioNome}</strong>
              </span>
            ) : null}
            {actions}
          </div>

          <button
            type="button"
            ref={toggleRef}
            className="lp-burger"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="lp-drawer"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>
      </header>

      <div
        className={`lp-drawer-backdrop ${menuOpen ? "is-open" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <div
        id="lp-drawer"
        ref={drawerRef}
        className={`lp-drawer ${menuOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!menuOpen}
      >
        <nav aria-label="Menu móvel">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={() => setMenuOpen(false)}>
              {l.label}
              <Icon name="arrowRight" size={20} />
            </a>
          ))}
        </nav>
        <div className="lp-drawer__actions" onClick={(e) => e.target.closest("a") && setMenuOpen(false)}>
          {logged ? (
            <p className="lp-drawer__hello">
              Olá, <strong>{usuarioNome}</strong>
            </p>
          ) : null}
          {actions}
        </div>
      </div>
    </>
  );
}
