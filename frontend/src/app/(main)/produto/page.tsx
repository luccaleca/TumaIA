"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FadeInSection } from "@/components/fade-in-section";

export default function ProdutoPage() {
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const onScroll = () => setOffsetY(window.scrollY * 0.2);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="text-white">
      <section className="relative isolate min-h-[72vh] overflow-hidden bg-black">
        <Image
          src="/images/hero.png"
          alt="Pessoa usando celular para criar conteúdos"
          fill
          priority
          className="object-cover transition-transform duration-200"
          style={{ transform: `translateY(${offsetY}px) scale(1.08)` }}
        />
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-green-950/40" />

        <FadeInSection className="relative mx-auto flex min-h-[72vh] w-full max-w-6xl items-center px-5 py-20 md:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
              Perfil e Produto
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-6xl">
              Crie Posts Profissionais Direto do seu WhatsApp
            </h1>
            <p className="mt-5 max-w-2xl text-base text-slate-200 md:text-lg">
              O Cérebro por Trás do Tuma: Uma automação que une o poder do n8n,
              OpenAI e WhatsApp para simplificar sua vida.
            </p>
          </div>
        </FadeInSection>
      </section>

      <section className="bg-white py-16 text-black md:py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 md:grid-cols-[1.2fr_0.8fr] md:items-center md:px-8">
          <FadeInSection className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.45)] md:p-8">
            <div className="mb-6 rounded-2xl border border-green-600/25 bg-green-50 p-4 text-base leading-relaxed text-green-900 md:text-lg">
              Olá! Eu sou o Tuma, seu assistente virtual. Role a página e
              descubra como a minha tecnologia vai facilitar suas postagens! 😊
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Você envia o briefing no WhatsApp
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                A IA gera conteúdo profissional
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                O fluxo n8n coordena toda a automação
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Publicação no Instagram de forma rápida e segura
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delayMs={120} className="flex items-center justify-center">
            <Image
              src="/images/mascote.png"
              alt="Mascote Tuma em forma de suricato"
              width={360}
              height={420}
              className="h-auto w-full max-w-[360px] scale-x-[-1] drop-shadow-[0_24px_40px_rgba(0,0,0,0.35)]"
            />
          </FadeInSection>

        </div>

        <FadeInSection className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-1 gap-4 px-5 sm:grid-cols-3 md:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <Image
              src="/images/whatsapp.png"
              alt="Logo WhatsApp"
              width={220}
              height={120}
              className="mx-auto h-16 w-auto object-contain"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <Image
              src="/images/openai.png"
              alt="Logo OpenAI"
              width={220}
              height={120}
              className="mx-auto h-16 w-auto object-contain grayscale contrast-125"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
            <Image
              src="/images/n8n.png"
              alt="Logo n8n"
              width={220}
              height={120}
              className="mx-auto h-16 w-auto object-contain grayscale contrast-125"
            />
          </div>
        </FadeInSection>
      </section>

      <FadeInSection className="bg-gradient-to-b from-white to-slate-100 py-16 text-black md:py-24">
        <div className="mx-auto w-full max-w-4xl px-5 md:px-8">
          <h2 className="mb-6 text-3xl font-extrabold md:text-4xl">
            Tecnologia de Ponta, Simples de Usar
          </h2>
          <div className="space-y-5 text-base leading-relaxed text-slate-700 md:text-lg">
            <p>
              O Tuma é uma orquestração inteligente. Tudo começa no WhatsApp,
              onde você envia o pedido. Nosso motor n8n aciona as IAs da OpenAI,
              que consultam seu catálogo e geram a descrição perfeita, hashtags
              estratégicas e uma imagem complementar de alta qualidade. Em
              seguida, o n8n publica tudo automaticamente no Instagram. Tudo
              rápido, seguro e sem esforço.
            </p>
          </div>
        </div>
      </FadeInSection>
    </div>
  );
}
