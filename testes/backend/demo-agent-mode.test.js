import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  buildDemoAgentTrainingAppendix,
  buildDemoUiContextBlock,
  loadDemoAgentKnowledgeMarkdown,
  resetDemoAgentKnowledgeCache,
} from "../../backend/src/services/demoAgentKnowledge.js";
import { formatoToJson, getFormatPresetById } from "../../backend/src/services/arteFormatPresets.js";
import { env } from "../../backend/src/config.js";

describe("demo agent knowledge", () => {
  before(() => {
    resetDemoAgentKnowledgeCache();
  });

  it("carrega os .md de backend/ia/agente", () => {
    const md = loadDemoAgentKnowledgeMarkdown();
    assert.match(md, /Comportamento do agente/i);
    assert.match(md, /Criação de arte/i);
    assert.match(md, /Acervo e formatos/i);
    assert.match(md, /Guardrails/i);
    assert.match(md, /nunca inventar produto/i);
  });

  it("contexto UI inclui formato do seletor e mídia do acervo", () => {
    const monsterId = "437a4d60-d4b0-462d-ad5f-aaaaaaaaaaaa";
    const block = buildDemoUiContextBlock({
      canal: "web",
      arteBrief: {
        tema: "promo Monster",
        formato: formatoToJson(getFormatPresetById("landscape")),
        texto: "1 por 10",
      },
      referenceMidiaIds: [monsterId],
      midias: [
        { id_midia: monsterId, nome_exibicao: "Monster", tipo_midia: "imagem" },
      ],
      question: "faz uma promoção",
      history: [],
    });
    assert.match(block, /16:9/);
    assert.match(block, /Monster/i);
    assert.ok(block.includes(monsterId));
    assert.match(block, /não pergunte de novo/i);
  });

  it("WhatsApp sem seletor: bloco admite formato pelo texto", () => {
    const block = buildDemoUiContextBlock({
      canal: "whatsapp",
      arteBrief: null,
      question: "faz em 16:9",
      history: [],
      midias: [],
    });
    assert.match(block, /whatsapp/i);
    assert.match(block, /não informado no painel/i);
  });

  it("appendix só monta conteúdo rico quando CHAT_DEMO_AGENT=true", () => {
    const appendix = buildDemoAgentTrainingAppendix({
      arteBrief: { formato: formatoToJson(getFormatPresetById("stories")) },
      acervoLabels: ["Monster", "Powerade"],
    });
    if (env.CHAT_DEMO_AGENT) {
      assert.match(appendix, /Conhecimento do agente/i);
      assert.match(appendix, /9:16|Stories/i);
      assert.match(appendix, /Monster/);
    } else {
      assert.equal(appendix, "");
    }
  });
});
