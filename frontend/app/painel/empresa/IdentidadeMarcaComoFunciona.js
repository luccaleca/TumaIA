"use client";

const PASSOS = [
  {
    titulo: "Envie fotos da marca",
    texto: "Logo, posts do Instagram, produtos ou fachada — quanto mais variedade, melhor a Tuma entende seu visual.",
  },
  {
    titulo: "Analise com a Tuma",
    texto: "Cada foto é estudada para sugerir cores, estilo visual e tom de voz. Pode levar alguns minutos na primeira vez.",
  },
  {
    titulo: "Revise o resultado e salve",
    texto: "Confira o que a Tuma sugeriu, altere o que quiser e clique em Salvar identidade no final da página.",
  },
];

export default function IdentidadeMarcaComoFunciona() {
  return (
    <div className="rounded-xl border border-border bg-accent-muted/30 px-4 py-4">
      <p className="text-sm font-semibold text-foreground">Como funciona</p>
      <ol className="mt-3 space-y-3">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-3 text-sm">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
              aria-hidden
            >
              {i + 1}
            </span>
            <div>
              <p className="font-medium text-foreground">{p.titulo}</p>
              <p className="mt-0.5 text-muted-foreground">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}


