"use client";

import IdentidadeMarcaCamposImagem from "./IdentidadeMarcaCamposImagem";

export default function IdentidadeMarcaResultado({ dados, canEdit, onFieldChange, visible }) {
  if (!visible) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated/30 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">Sugestões das fotos</p>
        <p className="mt-1 text-xs text-muted-foreground">Aparecem aqui depois da análise.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/50 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">Revise o que saiu das fotos</h3>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Ajuste cores/estilo e complete o papel em branco antes de salvar.
      </p>
      <IdentidadeMarcaCamposImagem
        dados={dados}
        canEdit={canEdit}
        onFieldChange={onFieldChange}
        idPrefix="resultado-"
      />
    </div>
  );
}
