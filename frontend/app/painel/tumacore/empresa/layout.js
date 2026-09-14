"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EMPRESA_NAV = [
  { href: "/painel/tumacore/empresa/dashboard", label: "Dashboard" },
  { href: "/painel/tumacore/empresa/analytics", label: "Analytics" },
];

function Chevron({ open }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Nav do TumaCore Empresa — mesmo chrome da área TumaCore, só Dashboard + Analytics.
 */
export default function TumaCoreEmpresaLayout({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const current =
    EMPRESA_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) || EMPRESA_NAV[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Image
              src="/imagens/tumacore-mascote.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
              aria-hidden
            />
            <span className="font-medium tracking-tight">
              <span className="text-accent">Tuma</span>
              <span>Core</span>
            </span>
            <Chevron open={menuOpen} />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute left-0 z-30 mt-1.5 min-w-[11rem] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-sm"
            >
              {EMPRESA_NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    className={`block px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-accent/15 font-medium text-accent"
                        : "text-foreground hover:bg-muted"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-0.5" aria-label="Seção TumaCore">
          {EMPRESA_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent/15 font-medium text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <span className="sr-only">Seção atual: {current.label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
