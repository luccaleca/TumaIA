"use client";

import { useEffect, useRef, useState } from "react";

/**
 * @typedef {'foto' | 'upload' | 'site'} AnaliseFase
 * @typedef {{
 *   fotoTotal: number,
 *   fotoConcluidas: number,
 *   fotoAtual: number,
 *   fase: AnaliseFase,
 *   incluiSite: boolean,
 * }} AnaliseProgresso
 */

const PCT_TRABALHO = 88;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Faixa de % coerente com o passo real, com folga para animação entre marcos.
 * @param {AnaliseProgresso | null | undefined} progress
 * @param {boolean} finishing
 */
function calcularFaixa(progress, finishing) {
  if (finishing) {
    return { piso: 94, teto: 100, rotulo: "Finalizando…" };
  }

  if (!progress?.fotoTotal) {
    return { piso: 6, teto: 14, rotulo: "Iniciando análise…" };
  }

  const { fotoTotal, fotoConcluidas, fotoAtual, fase, incluiSite } = progress;
  const passosTotais = fotoTotal + (incluiSite ? 1 : 0);
  const concluidos = clamp(fotoConcluidas, 0, fotoTotal);

  if (fase === "site") {
    const piso = (fotoTotal / passosTotais) * PCT_TRABALHO;
    return {
      piso: Math.max(piso - 2, 12),
      teto: 96,
      rotulo: "Lendo o site da empresa…",
    };
  }

  const passoIdx = clamp(fotoAtual, 1, fotoTotal);
  const piso = (concluidos / passosTotais) * PCT_TRABALHO + 2;
  const avancoNoPasso = fase === "upload" ? 0.35 : 0.88;
  const teto = ((concluidos + avancoNoPasso) / passosTotais) * PCT_TRABALHO;

  if (fase === "upload") {
    return {
      piso,
      teto: Math.min(teto, piso + 8),
      rotulo: `Enviando foto ${passoIdx} de ${fotoTotal}…`,
    };
  }

  return {
    piso,
    teto: Math.max(teto, piso + 4),
    rotulo: `Analisando foto ${passoIdx} de ${fotoTotal}…`,
  };
}

/**
 * Barra de progresso: ancorada nos passos reais, com animação suave entre marcos.
 * @param {{
 *   ativo: boolean,
 *   progress?: AnaliseProgresso | null,
 *   finishing?: boolean,
 * }} props
 */
export default function IdentidadeMarcaAnaliseProgress({ ativo, progress, finishing = false }) {
  const [displayPct, setDisplayPct] = useState(8);
  const faixaRef = useRef({ piso: 8, teto: 14 });

  useEffect(() => {
    faixaRef.current = calcularFaixa(progress, finishing);
  }, [progress, finishing]);

  useEffect(() => {
    if (!ativo) {
      setDisplayPct(8);
      return;
    }

    let frame = 0;
    const tick = () => {
      const { piso, teto } = faixaRef.current;
      setDisplayPct((atual) => {
        if (finishing) {
          if (atual >= 99.5) return 100;
          return atual + Math.max(0.8, (100 - atual) * 0.22);
        }
        if (atual < piso) return Math.min(piso, atual + 1.2);
        if (atual >= teto - 0.4) return atual;
        const falta = teto - atual;
        return atual + Math.max(0.25, falta * 0.07);
      });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ativo, finishing]);

  if (!ativo && !finishing) return null;

  const { rotulo } = calcularFaixa(progress, finishing);
  const pctShown = Math.round(clamp(displayPct, 0, 100));

  return (
    <div
      className="rounded-xl border border-accent/35 bg-accent-muted/40 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Análise em andamento</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{rotulo}</p>
        </div>
        <p className="text-lg font-semibold tabular-nums text-foreground">{pctShown}%</p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pctShown}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={rotulo}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pctShown}%` }}
        />
      </div>
    </div>
  );
}
