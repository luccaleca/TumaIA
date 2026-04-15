"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const menuItems = [
  { href: "/produto", label: "Produto" },
  { href: "/sobre", label: "Sobre" },
  { href: "/planos", label: "Planos" },
  { href: "/simulacao", label: "Simulação" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-2 md:px-8 md:py-3">
        <div className="relative flex items-center justify-end md:grid md:grid-cols-[1fr_auto_1fr] md:items-center">
          <Link
            href="/produto"
            onClick={closeMenu}
            className="absolute left-1/2 -translate-x-1/2 inline-flex items-center justify-center bg-transparent md:static md:left-auto md:translate-x-0 md:justify-self-start"
          >
            <Image
              src="/images/tumaia-logo-transparent.png"
              alt="Logo TumaIA"
              width={240}
              height={74}
              className="h-9 w-auto max-h-9 object-contain object-center md:h-11 md:max-h-11 bg-transparent"
              priority
            />
          </Link>

          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-transparent text-slate-800 transition-all duration-300 hover:border-green-600 hover:text-green-700 md:hidden"
          >
            <span className="sr-only">Menu</span>
            <div className="space-y-1.5">
              <span className={`block h-0.5 w-5 bg-current transition-transform duration-300 ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-5 bg-current transition-opacity duration-300 ${isOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`block h-0.5 w-5 bg-current transition-transform duration-300 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </div>
          </button>

          <nav className="hidden items-center justify-center gap-1 md:flex md:justify-self-center">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-slate-800 transition-all duration-300 hover:border-green-600/40 hover:text-green-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex md:justify-self-end">
            <Link
              href="/auth/login"
              className="rounded-full border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-all duration-300 hover:bg-green-600 hover:text-white"
            >
              Login
            </Link>
          </div>
        </div>

        {isOpen && (
          <nav className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition-all duration-200 hover:border-green-600/40 hover:text-green-700"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/auth/login"
              onClick={closeMenu}
              className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 transition-all duration-200 hover:bg-green-50"
            >
              Login
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
