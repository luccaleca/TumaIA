"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, fetchMe } from "../lib/auth";

const NAV_SECTION_IDS = ["produto", "planos", "quem-somos"];

function navLinkClass(active) {
  return [
    "inline-flex rounded-md px-3 py-1 text-sm font-medium transition-colors",
    active ? "bg-accent text-accent-foreground" : "text-slate-600 hover:text-slate-900",
  ].join(" ");
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("");
  const [activeNav, setActiveNav] = useState("");

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
    const offset = 120;

    function updateActiveNav() {
      const y = window.scrollY + offset;
      let current = "";
      for (const id of NAV_SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.offsetTop <= y) current = id;
      }
      setActiveNav(current);
    }

    updateActiveNav();
    window.addEventListener("scroll", updateActiveNav, { passive: true });
    window.addEventListener("resize", updateActiveNav);
    return () => {
      window.removeEventListener("scroll", updateActiveNav);
      window.removeEventListener("resize", updateActiveNav);
    };
  }, []);

  function onLogout() {
    clearToken();
    setUsuarioNome("");
  }

  const faqItems = [
    {
      q: "Como funciona a integração com o WhatsApp?",
      a: "Você conecta o número do seu negócio ao fluxo do TumaIA. A partir daí, pedidos de conteúdo podem ser feitos por mensagem, áudio ou foto no WhatsApp, e o sistema responde com prévias e próximos passos no mesmo canal.",
    },
    {
      q: "Preciso saber de design ou edição de imagem?",
      a: "Não. O TumaIA gera sugestões de legenda e arte com base no contexto da sua marca. Você só revisa e aprova quando estiver satisfeito.",
    },
    {
      q: "Meus dados e mídias ficam seguros?",
      a: "Sim. O fluxo foi pensado para uso comercial, com armazenamento e tráfego adequados ao painel e à automação. Evite compartilhar senhas e use sempre o cadastro oficial da sua equipe.",
    },
    {
      q: "Quanto tempo leva para publicar no Instagram?",
      a: "Depois que a IA processa seu pedido e você aprova a prévia, a publicação segue o fluxo configurado para o seu Instagram. Em geral, são poucos minutos do pedido à entrega da arte para aprovação.",
    },
    {
      q: "Posso cancelar ou mudar de plano depois?",
      a: "Sim. Os planos foram pensados sem fidelidade forçada: você escolhe o pacote que faz sentido hoje e pode ajustar conforme sua loja crescer.",
    },
  ];

  const depoimentos = [
    {
      texto:
        "Antes eu passava o domingo fazendo post. Agora mando um áudio no WhatsApp e em minutos já tenho legenda e imagem prontas para aprovar.",
      nome: "Mariana Souza",
      cargo: "Loja de roupas, Belo Horizonte",
    },
    {
      texto:
        "O melhor é não precisar abrir outro app na correria do balcão. Peço pelo WhatsApp e sigo atendendo cliente; o marketing não para.",
      nome: "Ricardo Almeida",
      cargo: "Padaria & cafeteria, Curitiba",
    },
    {
      texto:
        "Eu não entendo nada de design. O TumaIA mantém um padrão parecido com o que eu já postava, só que bem mais rápido e organizado.",
      nome: "Fernanda Costa",
      cargo: "Estética automotiva, Fortaleza",
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <a href="#inicio" className="text-xl font-bold tracking-tight">
            <span className="text-slate-900">Tuma</span>
            <span className="text-accent">IA</span>
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#produto" className={navLinkClass(activeNav === "produto")}>
              Produto
            </a>
            <a href="#planos" className={navLinkClass(activeNav === "planos")}>
              Planos
            </a>
            <a href="#quem-somos" className={navLinkClass(activeNav === "quem-somos")}>
              Quem somos
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {authReady && usuarioNome ? (
              <>
                <span className="hidden text-sm text-slate-600 md:inline">
                  Olá, <strong className="text-slate-900">{usuarioNome}</strong>
                </span>
                <Link
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-slate-800 transition-colors hover:border-slate-400"
                  href="/painel"
                >
                  Área do usuário
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-sm text-slate-800 transition-colors hover:border-slate-400"
                  href="/login"
                >
                  Entrar
                </Link>
                <Link
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  href="/cadastro"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="scroll-smooth">
        <section id="inicio" className="mx-auto w-full max-w-6xl px-6 pb-14 pt-20">
          <div className="rounded-3xl border border-border bg-surface p-8 shadow-[0_0_60px_-12px_rgba(57,255,20,0.08)] md:p-12">
            <div className="grid grid-cols-1 items-center gap-8 lg:gap-12 md:grid-cols-2">
              <div className="order-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">PLATAFORMA TUMAIA</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
                  Do WhatsApp para o Instagram em segundos.
                </h1>
                <p className="mt-4 max-w-3xl text-slate-600">
                  O TumaIA é o seu assistente virtual inteligente. Ele transforma suas mensagens, áudios e fotos do
                  WhatsApp em posts profissionais para o Instagram de forma 100% automatizada.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/cadastro"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-8px_rgba(0,179,65,0.45)] transition-opacity hover:opacity-90"
                  >
                    Começar agora
                  </Link>
                  <a
                    href="#planos"
                    className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-400"
                  >
                    Ver planos
                  </a>
                </div>
              </div>
              <div className="order-2 w-full max-w-md justify-self-center md:max-w-none md:justify-self-end">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-[0_0_30px_rgba(0,255,0,0.2)] ring-1 ring-white/5">
                  <Image
                    src="/imagens/close-up-food-lover-eating.jpg"
                    alt="Cliente representando o uso do TumaIA no dia a dia"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 45vw"
                    priority
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-slate-900/50 via-slate-900/15 to-transparent"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="produto" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold text-slate-900 md:text-5xl">Como o TumaIA funciona</h2>
          <p className="mt-3 max-w-4xl text-slate-600">
            Simplificamos o marketing do seu comércio. Esqueça horas perdidas criando posts, nossa IA cuida de tudo
            para você.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Conexão Direta</h3>
              <p className="mt-2 text-sm text-slate-600">
                Integre o TumaIA diretamente ao seu WhatsApp de forma simples e rápida.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Criação com IA</h3>
              <p className="mt-2 text-sm text-slate-600">
                Nossa inteligência artificial gera legendas persuasivas e imagens otimizadas para o seu nicho.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Postagem Automática</h3>
              <p className="mt-2 text-sm text-slate-600">
                Aprovação em um clique e publicação direta no seu feed ou stories do Instagram.
              </p>
            </article>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-surface p-6">
              <h3 className="text-xl font-semibold text-slate-900">Automação inteligente</h3>
              <p className="mt-2 text-sm text-slate-600">
                Deixe a tecnologia trabalhar por você. O TumaIA aprende o tom de voz da sua marca e cria conteúdos como
                se fosse você, liberando seu tempo para focar no que realmente importa: o seu negócio.
              </p>
            </article>
            <article className="relative overflow-visible rounded-xl border border-border bg-surface p-6">
              <div className="relative z-0 pr-44 sm:pr-56 md:pr-64 lg:pr-72 xl:pr-80">
                <h3 className="text-xl font-semibold text-slate-900">Fluxo de produção</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  <li>Você envia um áudio ou foto no WhatsApp.</li>
                  <li>A IA processa e cria a arte + legenda.</li>
                  <li>Você recebe a prévia no próprio WhatsApp.</li>
                  <li>É só aprovar e o post vai pro ar.</li>
                </ul>
              </div>
              <div className="pointer-events-none absolute -bottom-12 -right-12 z-10 h-72 w-72 sm:-bottom-14 sm:-right-14 sm:h-80 sm:w-80 md:-bottom-16 md:-right-16 md:h-96 md:w-96 lg:-bottom-20 lg:-right-16 lg:h-[26rem] lg:w-[26rem]">
                <Image
                  src="/imagens/IMAGEM2.1.png"
                  alt="Tuma, assistente virtual do TumaIA"
                  width={384}
                  height={384}
                  className="h-full w-full object-contain object-bottom object-right drop-shadow-[0_16px_48px_rgba(57,255,20,0.35)]"
                />
              </div>
            </article>
          </div>
        </section>

        <section id="planos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold text-slate-900 md:text-5xl">
            Planos que impulsionam seu negócio
          </h2>
          <p className="mt-3 max-w-4xl text-slate-600">
            Escolha o pacote ideal para a sua necessidade, sem fidelidade ou letras miúdas.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-border bg-surface p-6">
              <p className="text-sm font-medium text-slate-500">Plano</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Starter</h3>
              <p className="mt-2 text-sm text-slate-600">Ideal para quem está começando a estruturar as redes sociais.</p>
            </article>
            <article className="rounded-xl border-2 border-accent bg-surface-elevated p-6 shadow-[0_0_40px_-8px_rgba(57,255,20,0.35)]">
              <p className="text-sm font-medium text-accent">Plano</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900">Pro</h3>
              <p className="mt-2 text-sm text-slate-600">Automação completa para quem quer presença digital diária.</p>
            </article>
          </div>
          <div className="mt-6 rounded-xl border border-border bg-surface p-6">
            <h3 className="text-xl font-semibold text-slate-900">Comparativo de benefícios</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-border py-2 pr-4 font-semibold text-slate-700">Recurso</th>
                    <th className="border-b border-border py-2 pr-4 font-semibold text-slate-700">Starter</th>
                    <th className="border-b border-border py-2 pr-4 font-semibold text-slate-700">Pro</th>
                    <th className="border-b border-border py-2 font-semibold text-slate-700">Business</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Posts mensais (referência)", "Até 30", "Até 120", "Sob consulta"],
                    ["Geração de imagens com IA", "Incluída (padrão)", "Incluída (prioridade)", "Fluxo customizado"],
                    ["Suporte", "E-mail", "E-mail + chat prioritário", "Gerente de conta"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="border-b border-border py-2 pr-4 text-slate-700">{row[0]}</td>
                      <td className="border-b border-border py-2 pr-4 text-slate-600">{row[1]}</td>
                      <td className="border-b border-border py-2 pr-4 text-slate-600">{row[2]}</td>
                      <td className="border-b border-border py-2 text-slate-600">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="depoimentos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold text-slate-900 md:text-5xl">O que nossos clientes dizem</h2>
          <p className="mt-3 max-w-4xl text-slate-600">
            Veja como o TumaIA está transformando a rotina de empreendedores.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {depoimentos.map((d) => (
              <article key={d.nome} className="rounded-xl border border-border bg-surface p-5">
                <p className="text-sm text-slate-600">“{d.texto}”</p>
                <p className="mt-3 text-sm font-medium text-slate-900">{d.nome}</p>
                <p className="text-xs text-slate-500">{d.cargo}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold text-slate-900 md:text-5xl">Dúvidas Comuns</h2>
          <div className="mt-6 space-y-3">
            {faqItems.map((item, idx) => (
              <details
                key={item.q}
                className="group rounded-xl border border-border bg-surface p-4 open:border-slate-400"
              >
                <summary className="cursor-pointer list-none font-medium text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
                  {idx + 1}. {item.q}
                </summary>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="quem-somos" className="landing-section mx-auto w-full max-w-6xl px-6 py-12">
          <h2 className="section-title text-4xl font-semibold text-slate-900 md:text-5xl">Nossa História</h2>
          <p className="mt-3 max-w-4xl text-slate-600">
            Nascemos para descomplicar o marketing digital para pequenos e médios empreendedores, unindo a praticidade do
            aplicativo de mensagens mais usado do Brasil com o poder da Inteligência Artificial.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Missão</h3>
              <p className="mt-2 text-sm text-slate-600">
                Democratizar o acesso a um marketing de qualidade e automatizado.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Visão</h3>
              <p className="mt-2 text-sm text-slate-600">
                Ser a principal ferramenta de automação de redes sociais para o comércio local.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-slate-900">Valores</h3>
              <p className="mt-2 text-sm text-slate-600">Inovação, simplicidade e foco total no sucesso do cliente.</p>
            </article>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
          <div className="rounded-2xl border border-accent/40 bg-surface-elevated p-8 shadow-[0_0_48px_-12px_rgba(57,255,20,0.25)]">
            <h2 className="text-3xl font-semibold text-slate-900">Pronto para revolucionar seu Instagram?</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                href="/cadastro"
              >
                Começar agora
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
