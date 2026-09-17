import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractSlashMidiaRefsFromText,
  mergeReferenceMidiaIdsFromSlashText,
  parseCreationTurn,
  resolveSlashMidiaIdsAgainstRows,
  shouldPreferImageBriefingOverAcervo,
} from "../../backend/src/services/chatCreationInterpret.js";
import { tryChatAcervoResponse } from "../../backend/src/services/chatAcervoResponse.js";
import { classifyChatAcervoIntent } from "../../backend/src/services/chatIntent.js";
import {
  ARTE_FORMAT_PRESETS,
  formatoToJson,
  getFormatPresetById,
} from "../../backend/src/services/arteFormatPresets.js";
import {
  aspectRatioFromArteBrief,
  mergeArteBriefUserEdits,
  normalizeArteBrief,
} from "../../backend/src/services/rawImageArteBrief.js";

const MONSTER_ID = "437a4d60-d4b0-462d-ad5f-aaaaaaaaaaaa";
const MONSTER_Q =
  "preciso de uma foto do produto /monster.png-437a4d60-d4b0-462d-ad5f- desconto de natal, 1 é 10 e 3 é 20. Deixe a tematica do natal em cima do produto e os precos bem aparentes";

const MIDIAS = [
  {
    id_midia: MONSTER_ID,
    tipo_midia: "imagem",
    nome_exibicao: "Monster",
    nome_arquivo: "monster.png",
  },
  {
    id_midia: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    tipo_midia: "imagem",
    nome_exibicao: "Powerade",
    nome_arquivo: "powerade.png",
  },
];

describe("acervo slash /arquivo-UUID + formato do seletor", () => {
  it("extrai produto e hint de UUID de /monster.png-UUID truncado", () => {
    const refs = extractSlashMidiaRefsFromText(MONSTER_Q);
    assert.equal(refs.length, 1);
    assert.match(refs[0].productName, /monster/i);
    assert.equal(refs[0].idHint, "437a4d60-d4b0-462d-ad5f");
  });

  it("resolve hint truncado para a mídia real do acervo", () => {
    const ids = resolveSlashMidiaIdsAgainstRows(["437a4d60-d4b0-462d-ad5f"], MIDIAS);
    assert.deepEqual(ids, [MONSTER_ID]);
  });

  it("/monster.png-UUID + briefing: Monster selecionado, sem pedir descrição", async () => {
    const turn = parseCreationTurn(MONSTER_Q);
    assert.match(turn.productQuery || "", /monster/i);
    assert.equal(shouldPreferImageBriefingOverAcervo(MONSTER_Q), true);

    const mergedIds = mergeReferenceMidiaIdsFromSlashText([], MONSTER_Q, MIDIAS);
    assert.deepEqual(mergedIds, [MONSTER_ID]);

    const ans = await tryChatAcervoResponse({
      question: MONSTER_Q,
      history: [],
      idEmpresa: "00000000-0000-0000-0000-000000000001",
      nomeFantasia: "FYT",
      midias: MIDIAS,
      referenceMidiaIds: [],
      classifyIntent: classifyChatAcervoIntent,
    });
    assert.match(ans || "", /Monster/i);
    assert.doesNotMatch(ans || "", /Descreva/i);
    assert.doesNotMatch(ans || "", /Powerade/i);
  });

  it("mídia resolvida entra no conjunto enviado ao gerador (reference_midia_ids)", () => {
    const forGenerator = mergeReferenceMidiaIdsFromSlashText(
      [],
      [{ role: "user", content: MONSTER_Q }],
      MIDIAS,
    );
    assert.ok(forGenerator.includes(MONSTER_ID));
    assert.equal(forGenerator.length, 1);
  });

  it("cada preset do seletor chega ao aspect_ratio do payload", () => {
    const ratioMap = {
      "1:1": "1:1",
      "4:5": "2:3",
      "9:16": "9:16",
      "16:9": "16:9",
      "3:2": "3:2",
      "2:3": "2:3",
      "4:3": "3:2",
    };
    for (const preset of ARTE_FORMAT_PRESETS) {
      const brief = normalizeArteBrief({
        tema: "promo teste",
        formato: formatoToJson(preset),
      });
      assert.equal(brief.formato.preset_id, preset.id, preset.id);
      assert.equal(brief.formato.ratio, preset.ratio, preset.id);
      assert.equal(aspectRatioFromArteBrief(brief), ratioMap[preset.ratio], preset.ratio);
    }
  });

  it("trocar o seletor preserva o restante do briefing", () => {
    const draft = normalizeArteBrief({
      tema: "promo Monster natal",
      formato: formatoToJson(getFormatPresetById("post_square")),
      estilo: "preços grandes",
      texto: "1 por 10",
      cores: ["#111111"],
    });
    const fromUi = normalizeArteBrief({
      ...draft,
      formato: formatoToJson(getFormatPresetById("landscape")),
    });
    const merged = mergeArteBriefUserEdits(fromUi, draft, { preferExtractedFormato: false });
    assert.equal(merged.formato.ratio, "16:9");
    assert.equal(merged.tema, draft.tema);
    assert.equal(merged.estilo, draft.estilo);
    assert.equal(merged.texto, draft.texto);
    assert.deepEqual(merged.cores, draft.cores);
  });

  it("sucesso exige URL; falha não é falso sucesso", () => {
    const ok = { ok: true, urls: ["https://cdn.example/arte-16x9.png"], called: true };
    assert.equal(ok.called, true);
    assert.ok(ok.urls.length);
    assert.match(ok.urls[0], /^https?:\/\//);

    const fail = { ok: false, urls: [], error: "A imagem não foi gerada.", called: true };
    assert.equal(fail.called, true);
    assert.equal(fail.urls.length, 0);
    assert.doesNotMatch(fail.error, /aqui est[aá]|pronto/i);
  });
});
