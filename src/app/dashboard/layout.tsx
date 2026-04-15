"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const sidebarItems = [
  { label: "Visão Geral", href: "/dashboard" },
  { label: "Meu Perfil", href: "/dashboard/perfil" },
  { label: "Minhas Empresas", href: "/dashboard/empresas" },
  { label: "Meus Planos", href: "/dashboard" },
];

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/dashboard/perfil")) return "Meu Perfil";
  if (pathname.startsWith("/dashboard/empresas")) return "Minhas Empresas";
  return "Visão Geral";
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const title = pageTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-black px-6 py-7 text-white transition-transform duration-300 md:static md:translate-x-0 ${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Link
            href="/dashboard"
            className="block outline-none"
            onClick={() => setIsMenuOpen(false)}
          >
            <Image
              src="/images/tumaia-logo-transparent.png"
              alt="TumaIA"
              width={160}
              height={44}
              className="h-9 w-auto object-contain brightness-0 invert"
            />
          </Link>

          <nav className="mt-10 space-y-2">
            {sidebarItems.map((item) => {
              const active = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-[#00B341] text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {isMenuOpen ? (
          <button
            aria-label="Fechar menu"
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
            <button
              aria-label="Abrir menu"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 md:hidden"
            >
              <span className="text-lg">☰</span>
            </button>

            <div className="hidden md:block">
              <p className="text-sm text-slate-500">Painel do usuário</p>
              <p className="text-base font-semibold text-slate-900">{title}</p>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                DU
              </div>
              <span className="hidden text-sm font-medium text-slate-700 sm:block">
                Diego
              </span>
              <Link
                href="/auth/login"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-200 hover:border-slate-400"
              >
                Sair
              </Link>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
