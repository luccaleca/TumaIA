import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandAgentStatus,
  clipAgenteMarcaForPrompt,
  renderAgenteMarcaMarkdown,
} from "../../backend/src/services/brandAgentService.js";

describe("brandAgentService", () => {
  it("gera markdown com papel livre e campos da arte", () => {
    const md = renderAgenteMarcaMarkdown(
      {
        tom_voz: "direto e energético",
        estilo_visual: "contraste alto, tipografia pesada",
        cor_primaria: "#00FF00",
        cor_secundaria: "#111111",
        evitar: "poster genérico com logo no rodapé",
        papel_agente: "Somos a Volt. Produto grande. Sem firula.\nTextos curtos.",
        id_midia_logo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      { nome_fantasia: "Volt Energy" },
    );

    assert.match(md, /# Volt Energy/);
    assert.match(md, /Papel da marca/);
    assert.match(md, /Somos a Volt/);
    assert.match(md, /#00FF00/i);
    assert.match(md, /logo no rodapé/i);
    assert.match(md, /marca vence/i);
  });

  it("marca agente_inicial_ok com logo, cor e estilo ou papel", () => {
    assert.equal(brandAgentStatus({ tom_voz: "a" }).agente_inicial_ok, false);

    const ok = brandAgentStatus({
      estilo_visual: "foto real",
      cor_primaria: "#8B4513",
      id_midia_logo: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      papel_agente: "Texto longo o suficiente para contar como papel da marca da empresa.",
    });
    assert.equal(ok.agente_inicial_ok, true);
  });

  it("clipa markdown longo para prompt", () => {
    const long = "x".repeat(5000);
    const clipped = clipAgenteMarcaForPrompt(long, 100);
    assert.ok(clipped.length <= 100);
    assert.match(clipped, /…$/);
  });
});
