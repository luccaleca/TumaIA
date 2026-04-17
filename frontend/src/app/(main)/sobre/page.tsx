"use client";

import Image from "next/image";
import { FadeInSection } from "@/components/fade-in-section";

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="border-b border-slate-100 py-16 md:py-24">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="grid gap-12 md:grid-cols-2 md:items-center md:gap-16">
            <FadeInSection>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-green-600">
                Sobre nós
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl lg:text-[2.75rem]">
                A NOSSA HISTÓRIA
              </h1>
              <div className="mt-8 space-y-6 text-base leading-relaxed text-slate-700 md:text-lg">
                <p>
                  Imagine que você tem uma loja online e precisa postar fotos e
                  descrições dos seus produtos no Instagram todos os dias. Isso
                  consome muito tempo!
                </p>
                <p>
                  Nosso sistema funciona assim: você explica seu negócio, coloca
                  seus produtos em um site, e depois é só mandar uma mensagem no
                  WhatsApp pedindo um post.
                </p>
                <p>
                  A IA aprende sobre seu comércio, lê seus produtos, cria
                  descrição criativa, gera imagem, hashtags — e publica tudo
                  automaticamente no Instagram, sem você abrir o app.
                </p>
                <p className="font-medium text-slate-900">
                  É como ter um assistente de marketing 24/7 que trabalha
                  sozinho.
                </p>
              </div>
            </FadeInSection>

            <FadeInSection
              delayMs={120}
              className="flex justify-center md:justify-end"
            >
              <div className="relative w-full max-w-[280px] md:max-w-[300px]">
                <div className="rounded-[2.25rem] border border-slate-200/80 bg-white p-2 shadow-[0_28px_56px_-20px_rgba(0,0,0,0.35)]">
                  <div className="relative overflow-hidden rounded-[1.65rem] bg-slate-950 ring-[3px] ring-slate-900">
                    <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-[38%] -translate-x-1/2 rounded-b-2xl bg-slate-950" />
                    <div className="relative aspect-[9/16] w-full bg-slate-200">
                      <iframe
                        className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                        src="https://www.youtube.com/embed/1XKUVvFJvt0?autoplay=1&mute=1&loop=1&controls=0&playlist=1XKUVvFJvt0&playsinline=1"
                        title="TumaIA App"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <FadeInSection>
            <h2 className="mx-auto max-w-4xl text-center text-2xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-3xl lg:text-4xl">
              Como o TumaIA trabalha por você: o fluxo completo
            </h2>
            <div className="mt-10 w-full">
              <Image
                src="/images/fluxo-completo-tumaia.png"
                alt="Infográfico do fluxo completo do TumaIA: WhatsApp, WAHA, n8n, Supabase, OpenAI e publicação no Instagram"
                width={1600}
                height={900}
                sizes="(max-width: 768px) 100vw, min(1152px, 100vw)"
                className="w-full object-contain"
              />
            </div>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
