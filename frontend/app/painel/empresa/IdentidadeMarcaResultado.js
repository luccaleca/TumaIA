"use client";

import IdentidadeMarcaCamposImagem from "./IdentidadeMarcaCamposImagem";

/**
 * @param {{
 *   dados: Record<string, string>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string | string[]) => void,
 *   visible: boolean,
 * }} props
 */
export default function IdentidadeMarcaResultado({ dados, canEdit, onFieldChange, visible }) {
  if (!visible) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-elevated/30 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">Resultado da análise</p>
        <p className="mt-1 text-xs text-muted-foreground">Aparece aqui depois de analisar fotos ou site.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated/50 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-foreground">Resultado da análise</h3>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Revise o que o Tuma extraiu — foque em cores, estilo e «Evitar» antes de salvar.
      </p>
      <IdentidadeMarcaCamposImagem
        dados={dados}
        canEdit={canEdit}
        onFieldChange={onFieldChange}
        showOpcional
        showLegenda={false}
        idPrefix="resultado-"
      />
    </div>
  );
}
