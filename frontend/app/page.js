"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearToken, fetchMe } from "../lib/auth";
import IphoneVideoFrame from "./components/IphoneVideoFrame";
import ScrollReveal from "./components/ScrollReveal";

const YOUTUBE_DEMO_URL = "https://youtube.com/shorts/wkVhfJu6v0w?si=O1RNpmzxEPmrXYIt";

const galeriaImagens = [
  {
    src: "/imagens/imagem-segurando-celular.jpg",
    alt: "Pessoa usando o celular no dia a dia do negócio",
    titulo: "Pelo WhatsApp",
    texto: "Peça posts onde você já conversa com clientes — sem app novo para aprender.",
  },
  {
    src: "/imagens/imagem-mao-computador.jpg",
    alt: "Mãos no computador gerenciando o negócio",
    titulo: "Painel web",
    texto: "Configure empresa, contextos e mídias com clareza, quando precisar.",
  },
  {
    src: "/imagens/imagem-de-fundo-site.jpg",
    alt: "Ambiente de trabalho e operação do comércio",
    titulo: "Para o seu ritmo",
    texto: "Pensado para PMEs que precisam de presença no Instagram sem parar o balcão.",
  },
];

const NAV_SECTION_IDS = ["produto", "planos", "quem-somos"];

function navLinkClass(active, onHero) {
  if (onHero) {
    return [
      "inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
      active
        ? "bg-emerald-500/20 text-white ring-1 ring-emerald-400/35 shadow-sm shadow-emerald-900/20"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    ].join(" ");
  }
  return [
    "inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ");
}

function headerBtnGhost(onHero) {
  return onHero
    ? "rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/15"
    : "rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/25 hover:bg-muted/50";
}

function headerBtnPrimary(large = false) {
  const size = large ? "px-5 py-2.5" : "px-3.5 py-2";
  return `rounded-xl bg-accent ${size} text-sm font-semibold text-accent-foreground shadow-md shadow-emerald-900/20 transition hover:opacity-95 hover:shadow-lg hover:shadow-emerald-900/25`;
}

const produtoPassos = [
  {
    num: "01",
    titulo: "Conexão direta",
    texto: "Integre o TumaIA ao WhatsApp do seu negócio de forma simples e rápida.",
  },
  {
    num: "02",
    titulo: "Criação com IA",
    texto: "Legendas persuasivas e imagens alinhadas à identidade da sua marca.",
  },
  {
    num: "03",
    titulo: "Publicação",
    texto: "Aprove no WhatsApp e publique no Instagram sem sair da rotina da loja.",
  },
];

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("");
  const [activeNav, setActiveNav] = useState("");
  const [headerOverDark, setHeaderOverDark] = useState(true);

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

    function onScroll() {
      const hero = document.getElementById("inicio");
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - 72 : 720;
      setHeaderOverDark(window.scrollY < heroEnd);
      updateActiveNav();
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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

  const onHero = headerOverDark;

  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <main className="scroll-smooth">
        {/* Hero com imagem de fundo */}
        <section id="inicio" className="relative min-h-screen overflow-hidden">
          <div className="landing-hero-bg landing-hero-bg--inicio absolute inset-0" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-950/88 via-emerald-950/75 to-slate-900/90"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_40%,rgba(46,207,106,0.18),transparent_55%)]"
            aria-hidden
          />

          <header className="sticky top-0 z-50 px-4 pt-3 md:px-6 md:pt-4">
            <div
              className={`landing-header-bar mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-3 md:rounded-[1.25rem] md:px-5 ${
                onHero ? "landing-dark-glass" : "landing-header-bar--light"
              }`}
            >
              <a
                href="#inicio"
                className={`text-xl font-bold tracking-tight transition-colors ${onHero ? "text-white" : ""}`}
              >
                <span className={onHero ? "text-white" : "text-foreground"}>Tuma</span>
                <span className="text-accent">IA</span>
              </a>
              <nav
                className={`hidden items-center gap-0.5 rounded-full p-1 md:flex ${
                  onHero ? "bg-black/15 ring-1 ring-white/10" : "bg-muted/60"
                }`}
              >
                <a href="#produto" className={navLinkClass(activeNav === "produto", onHero)}>
                  Produto
                </a>
                <a href="#planos" className={navLinkClass(activeNav === "planos", onHero)}>
                  Planos
                </a>
                <a href="#quem-somos" className={navLinkClass(activeNav === "quem-somos", onHero)}>
                  Quem somos
                </a>
              </nav>
              <div className="flex items-center gap-2">
                {authReady && usuarioNome ? (
                  <>
                    <span
                      className={`hidden text-sm md:inline ${onHero ? "text-white/85" : "text-muted-foreground"}`}
                    >
                      Olá, <strong className={onHero ? "text-white" : "text-foreground"}>{usuarioNome}</strong>
                    </span>
                    <Link className={headerBtnGhost(onHero)} href="/painel">
                      Área do usuário
                    </Link>
                    <button type="button" onClick={onLogout} className={headerBtnPrimary()}>
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link className={headerBtnGhost(onHero)} href="/login">
                      Entrar
                    </Link>
                    <Link className={headerBtnPrimary()} href="/cadastro">
                      Cadastrar
                    </Link>
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-5 pb-20 pt-6 md:px-6 md:pb-28 md:pt-10">
            <div className="grid max-w-3xl gap-8">
              <div className="landing-hero-enter inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                Plataforma para PMEs brasileiras
              </div>

              <div className="landing-hero-enter landing-hero-enter-d1">
                <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-[3.25rem]">
                  Do WhatsApp para o Instagram{" "}
                  <span className="text-emerald-300">em segundos</span>
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 md:text-lg">
                  O TumaIA transforma mensagens, áudios e fotos do WhatsApp em posts profissionais para o
                  Instagram — com a identidade da sua marca e sem complicação técnica.
                </p>
              </div>

              <div className="landing-hero-enter landing-hero-enter-d2 flex flex-wrap gap-3">
                <Link
                  href="/cadastro"
                  className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-emerald-900/25 transition hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Começar agora
                </Link>
                <a
                  href="#produto"
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Como funciona
                </a>
              </div>

              <ul className="landing-hero-enter landing-hero-enter-d3 mt-2 flex flex-wrap gap-2 text-xs text-white/75 md:text-sm">
                {["WhatsApp como canal", "IA generativa", "Aprovação antes de publicar"].map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-white/15 bg-black/20 px-3 py-1 backdrop-blur-sm"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"
            aria-hidden
          />
        </section>

        <section
          id="video"
          className="landing-section border-b border-border bg-surface py-16 md:py-24"
        >
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 md:grid-cols-2 md:gap-16 md:px-6">
            <ScrollReveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">Demonstração</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Veja o projeto em poucos minutos
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
                Assista ao vídeo da equipe explicando como o TumaIA conecta WhatsApp, inteligência artificial e
                Instagram para automatizar a criação de conteúdo da sua marca.
              </p>
              <a
                href={YOUTUBE_DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-muted"
              >
                Abrir no YouTube
                <span aria-hidden>↗</span>
              </a>
            </ScrollReveal>
            <ScrollReveal direction="scale" delay={120}>
              <IphoneVideoFrame />
            </ScrollReveal>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
          <ScrollReveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Na prática</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Feito para o dia a dia do comércio
            </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Imagens que representam como o TumaIA se encaixa na rotina de quem vende, atende e precisa postar.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {galeriaImagens.map((item, i) => (
              <ScrollReveal key={item.src} delay={i * 90} direction={i % 2 === 0 ? "up" : "scale"}>
                <article className="landing-card overflow-hidden rounded-2xl p-0">
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent"
                    aria-hidden
                  />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-foreground">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.texto}</p>
                </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section id="produto" className="landing-section mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
          <ScrollReveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Produto</p>
          <h2 className="section-title mt-2 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Como o TumaIA funciona
          </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Simplificamos o marketing do seu comércio. Esqueça horas perdidas criando posts — a IA cuida do
              conteúdo; você cuida do negócio.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {produtoPassos.map((passo, i) => (
              <ScrollReveal key={passo.num} delay={i * 80}>
                <article className="landing-card rounded-2xl p-6">
                <span className="landing-step-num">{passo.num}</span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{passo.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ScrollReveal direction="left">
              <article className="landing-card rounded-2xl p-6 md:p-8">
                <h3 className="text-xl font-semibold text-foreground">Automação inteligente</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  O TumaIA aprende o tom de voz da sua marca e cria conteúdos como se fosse você, liberando seu
                  tempo para focar no que realmente importa: o seu negócio.
                </p>
              </article>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={100}>
              <article className="landing-card relative overflow-hidden rounded-2xl p-6 md:p-8">
              <div className="relative z-0 max-w-[55%] pr-2">
                <h3 className="text-xl font-semibold text-foreground">Fluxo de produção</h3>
                <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {[
                    "Você envia um áudio ou foto no WhatsApp.",
                    "A IA processa e cria a arte + legenda.",
                    "Você recebe a prévia no próprio WhatsApp.",
                    "É só aprovar e o post vai pro ar.",
                  ].map((item, i) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-accent">{i + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="pointer-events-none absolute -bottom-6 -right-4 z-10 h-56 w-56 md:h-72 md:w-72">
                <Image
                  src="/imagens/IMAGEM2.1.png"
                  alt="Tuma, mascote do TumaIA"
                  width={320}
                  height={320}
                  className="h-full w-full object-contain object-bottom drop-shadow-lg"
                />
              </div>
              </article>
            </ScrollReveal>
          </div>
        </section>

        <section
          id="planos"
          className="landing-section border-y border-border bg-surface-elevated/80 py-16 md:py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-5 md:px-6">
            <ScrollReveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-accent">Planos</p>
              <h2 className="section-title mt-2 max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Pacotes para impulsionar seu negócio
              </h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Escolha o pacote ideal para a sua necessidade, sem fidelidade ou letras miúdas.
              </p>
            </ScrollReveal>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              <ScrollReveal delay={80}>
                <article className="landing-card rounded-2xl p-7">
                <p className="text-sm font-medium text-muted-foreground">Plano</p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">Starter</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Ideal para quem está começando a estruturar as redes sociais.
                </p>
                </article>
              </ScrollReveal>
              <ScrollReveal delay={160} direction="scale">
                <article className="landing-card relative rounded-2xl border-2 border-accent/50 p-7 ring-4 ring-accent/10">
                <span className="absolute right-5 top-5 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                  Popular
                </span>
                <p className="text-sm font-medium text-accent">Plano</p>
                <h3 className="mt-1 text-2xl font-bold text-foreground">Pro</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Automação completa para quem quer presença digital diária.
                </p>
                </article>
              </ScrollReveal>
            </div>

            <ScrollReveal delay={120}>
              <div className="landing-card mt-8 overflow-hidden rounded-2xl">
              <div className="border-b border-border bg-muted/40 px-6 py-4">
                <h3 className="text-lg font-semibold text-foreground">Comparativo de benefícios</h3>
              </div>
              <div className="overflow-x-auto px-2 pb-2">
                <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-border px-4 py-3 font-semibold text-foreground">Recurso</th>
                      <th className="border-b border-border px-4 py-3 font-semibold text-foreground">Starter</th>
                      <th className="border-b border-border px-4 py-3 font-semibold text-foreground">Pro</th>
                      <th className="border-b border-border px-4 py-3 font-semibold text-foreground">Business</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Posts mensais (referência)", "Até 30", "Até 120", "Sob consulta"],
                      ["Geração de imagens com IA", "Incluída (padrão)", "Incluída (prioridade)", "Fluxo customizado"],
                      ["Suporte", "E-mail", "E-mail + chat prioritário", "Gerente de conta"],
                    ].map((row) => (
                      <tr key={row[0]} className="even:bg-muted/25">
                        <td className="border-b border-border px-4 py-3 font-medium text-foreground">{row[0]}</td>
                        <td className="border-b border-border px-4 py-3 text-muted-foreground">{row[1]}</td>
                        <td className="border-b border-border px-4 py-3 text-muted-foreground">{row[2]}</td>
                        <td className="border-b border-border px-4 py-3 text-muted-foreground">{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section id="depoimentos" className="landing-section mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
          <ScrollReveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Depoimentos</p>
          <h2 className="section-title mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            O que nossos clientes dizem
          </h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Veja como o TumaIA está transformando a rotina de empreendedores.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {depoimentos.map((d, i) => (
              <ScrollReveal key={d.nome} delay={i * 100}>
                <article className="landing-card rounded-2xl border-l-4 border-l-accent p-6">
                <p className="text-sm leading-relaxed text-muted-foreground">&ldquo;{d.texto}&rdquo;</p>
                <p className="mt-5 text-sm font-semibold text-foreground">{d.nome}</p>
                <p className="text-xs text-muted-foreground">{d.cargo}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section id="faq" className="landing-section mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
          <ScrollReveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">FAQ</p>
            <h2 className="section-title mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Dúvidas comuns
            </h2>
          </ScrollReveal>
          <div className="mt-8 space-y-3">
            {faqItems.map((item, i) => (
              <ScrollReveal key={item.q} delay={i * 60} direction="fade">
                <details className="group landing-card rounded-xl p-0 open:border-accent/30">
                <summary className="cursor-pointer list-none px-5 py-4 font-medium text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                  {item.q}
                </summary>
                <p className="border-t border-border px-5 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
                </details>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section id="quem-somos" className="landing-section mx-auto w-full max-w-6xl px-5 py-16 md:px-6 md:py-20">
          <ScrollReveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Sobre</p>
          <h2 className="section-title mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Nossa história
          </h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
              Nascemos para descomplicar o marketing digital para pequenos e médios empreendedores, unindo a
              praticidade do aplicativo de mensagens mais usado do Brasil com o poder da inteligência artificial.
            </p>
          </ScrollReveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Missão", "Democratizar o acesso a um marketing de qualidade e automatizado."],
              ["Visão", "Ser a principal ferramenta de automação de redes sociais para o comércio local."],
              ["Valores", "Inovação, simplicidade e foco total no sucesso do cliente."],
            ].map(([titulo, texto], i) => (
              <ScrollReveal key={titulo} delay={i * 90}>
                <article className="landing-card rounded-2xl p-6">
                <h3 className="font-semibold text-foreground">{titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-4 md:px-6">
          <ScrollReveal direction="scale">
            <div className="landing-dark-glass relative overflow-hidden rounded-3xl">
            <div className="landing-cta-bg absolute inset-0 opacity-40" aria-hidden />
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950/50 via-emerald-950/35 to-slate-950/45"
              aria-hidden
            />
            <div className="relative px-6 py-14 text-center md:px-12 md:py-16">
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Pronto para revolucionar seu Instagram?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-white/75">
                Cadastre sua empresa, configure a identidade da marca e comece a produzir conteúdo pelo WhatsApp.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link className={headerBtnPrimary(true)} href="/cadastro">
                  Começar agora
                </Link>
                <Link className={headerBtnGhost(true)} href="/login">
                  Já tenho conta
                </Link>
              </div>
            </div>
            </div>
          </ScrollReveal>
        </section>
      </main>
    </div>
  );
}
