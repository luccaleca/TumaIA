"use client";

import IdentidadeMarcaCamposImagem from "./IdentidadeMarcaCamposImagem";

/**
 * Compat — o fluxo principal usa CamposImagem direto em IdentidadeMarcaSection.
 * @param {{
 *   dados: Record<string, string>,
 *   canEdit: boolean,
 *   onFieldChange: (key: string, value: string | string[]) => void,
 * }} props
 */
export default function IdentidadeMarcaManualTab({ dados, canEdit, onFieldChange }) {
  return (
    <IdentidadeMarcaCamposImagem
      dados={dados}
      canEdit={canEdit}
      onFieldChange={onFieldChange}
      showLegenda
      intro="Preencha as leis da marca. O que salvar aqui é obrigatório em toda arte."
    />
  );
}
