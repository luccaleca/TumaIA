 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, fetchMe } from "../lib/auth";

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("");

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

  function onLogout() {
    clearToken();
    setUsuarioNome("");
  }

  return (
    <div className="bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a href="#inicio" className="text-xl font-bold tracking-tight">
            TumaIA
          </a>
          <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
            <a href="#produto" className="text-zinc-700 hover:text-zinc-900">
              Produto
            </a>
            <a href="#planos" className="text-zinc-700 hover:text-zinc-900">
              Planos
            </a>
            <a href="#quem-somos" className="text-zinc-700 hover:text-zinc-900">
              Quem somos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {authReady && usuarioNome ? (
              <>
                <span className="hidden text-sm text-zinc-700 md:inline">
                  Olá, <strong>{usuarioNome}</strong>
                </span>
                <Link className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" href="/painel">
                  Área do usuário
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm" href="/login">
                  Entrar
                </Link>
                <Link className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white" href="/cadastro">
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="scroll-smooth">
        <section id="inicio" className="mx-auto w-full max-w-6xl px-6 pb-14 pt-20">
          <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Plataforma TumaIA</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </h1>
            <p className="mt-4 max-w-3xl text-zinc-600">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
              ex ea commodo consequat.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#produto" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                Ver produto
              </a>
              <a href="#planos" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium">
                Ver planos
              </a>
            </div>
          </div>
        </section>

        <section id="produto" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold md:text-5xl">Produto</h2>
          <p className="mt-3 max-w-4xl text-zinc-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
            ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
            fugiat nulla pariatur.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {["Lorem ipsum", "Dolor sit amet", "Consectetur elit"].map((title) => (
              <article key={title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.
                </p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Automação inteligente</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum lacinia arcu eget nulla. Class
                aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                Curabitur sodales ligula in libero. Sed dignissim lacinia nunc. Curabitur tortor. Pellentesque nibh.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Fluxo de produção</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus
                ante dapibus diam. Sed nisi.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
                <li>Lorem ipsum dolor sit amet, consectetur.</li>
                <li>Sed do eiusmod tempor incididunt ut labore.</li>
                <li>Ut enim ad minim veniam quis nostrud.</li>
                <li>Duis aute irure dolor in reprehenderit.</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="planos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold md:text-5xl">Planos</h2>
          <p className="mt-3 max-w-4xl text-zinc-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus
            ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">Plano Inicial</p>
              <h3 className="mt-1 text-2xl font-semibold">Lorem Ipsum</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.
              </p>
            </article>
            <article className="rounded-xl border border-zinc-900 bg-zinc-900 p-6 text-white shadow-sm">
              <p className="text-sm font-medium text-zinc-300">Plano Pro</p>
              <h3 className="mt-1 text-2xl font-semibold">Dolor Sit Amet</h3>
              <p className="mt-2 text-sm text-zinc-300">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.
              </p>
            </article>
          </div>
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Comparativo de benefícios</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-zinc-200 py-2 pr-4 font-semibold text-zinc-700">Recurso</th>
                    <th className="border-b border-zinc-200 py-2 pr-4 font-semibold text-zinc-700">Inicial</th>
                    <th className="border-b border-zinc-200 py-2 pr-4 font-semibold text-zinc-700">Pro</th>
                    <th className="border-b border-zinc-200 py-2 font-semibold text-zinc-700">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Lorem ipsum generator", "Básico", "Avançado", "Completo"],
                    ["Dolor sit analytics", "Limitado", "Ilimitado", "Ilimitado+"],
                    ["Consectetur workspace", "1 equipe", "5 equipes", "Multi-equipe"],
                    ["Amet suporte", "E-mail", "Prioritário", "Dedicado"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="border-b border-zinc-100 py-2 pr-4 text-zinc-700">{row[0]}</td>
                      <td className="border-b border-zinc-100 py-2 pr-4 text-zinc-600">{row[1]}</td>
                      <td className="border-b border-zinc-100 py-2 pr-4 text-zinc-600">{row[2]}</td>
                      <td className="border-b border-zinc-100 py-2 text-zinc-600">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="depoimentos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold md:text-5xl">Depoimentos</h2>
          <p className="mt-3 max-w-4xl text-zinc-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse potenti. Nunc feugiat mi a tellus
            consequat imperdiet. Vestibulum sapien.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus luctus urna sed urna ultricies.",
              "Curabitur tortor. Pellentesque nibh. Aenean quam. In scelerisque sem at dolor.",
              "Maecenas mattis. Sed convallis tristique sem. Proin ut ligula vel nunc egestas porttitor.",
            ].map((text, idx) => (
              <article key={idx} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-zinc-600">“{text}”</p>
                <p className="mt-3 text-sm font-medium text-zinc-800">Pessoa Exemplo {idx + 1}</p>
                <p className="text-xs text-zinc-500">Cargo Lorem Ipsum</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold md:text-5xl">Perguntas frequentes</h2>
          <div className="mt-6 space-y-3">
            {[
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit?",
              "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua?",
              "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris?",
              "Duis aute irure dolor in reprehenderit in voluptate velit esse?",
              "Excepteur sint occaecat cupidatat non proident, sunt in culpa?",
            ].map((question, idx) => (
              <details key={question} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none font-medium text-zinc-900">
                  {idx + 1}. {question}
                </summary>
                <p className="mt-2 text-sm text-zinc-600">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
                  et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                  aliquip ex ea commodo consequat.
                </p>
              </details>
            ))}
          </div>
        </section>

        <section id="quem-somos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold md:text-5xl">Quem somos</h2>
          <p className="mt-3 max-w-4xl text-zinc-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sodales ligula in libero. Sed dignissim
            lacinia nunc. Curabitur tortor. Pellentesque nibh. Aenean quam. In scelerisque sem at dolor. Maecenas
            mattis.
          </p>
          <p className="mt-3 max-w-4xl text-zinc-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam nec ante. Sed lacinia, urna non tincidunt
            mattis, tortor neque adipiscing diam, a cursus ipsum ante quis turpis.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {["Missão", "Visão", "Valores"].map((item) => (
              <article key={item} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold">{item}</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec eu libero sit amet quam egestas semper.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white shadow-sm">
            <h2 className="text-3xl font-semibold">Lorem ipsum call to action</h2>
            <p className="mt-3 max-w-3xl text-zinc-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900" href="/cadastro">
                Começar agora
              </Link>
              <Link className="rounded-lg border border-zinc-500 px-4 py-2 text-sm font-medium text-white" href="/login">
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
