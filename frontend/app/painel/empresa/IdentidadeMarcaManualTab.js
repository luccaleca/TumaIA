"use client";

import IdentidadeMarcaCamposImagem from "./IdentidadeMarcaCamposImagem";

/**
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
      showOpcional
      showLegenda
      intro="Preencha à mão o que o Tuma vai usar nas artes. Se preferir, volte para a opção do Tuma para montar a base a partir das fotos."
    />
  );
}
