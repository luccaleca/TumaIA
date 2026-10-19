import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { agendarPostPeloWhatsapp } from "../../backend/src/services/whatsappInboundService.js";

// Quarta, 21/10/2026, 15:00 em Brasília.
const AGORA = new Date("2026-10-21T18:00:00.000Z");
const EMPRESA = "11111111-1111-4111-8111-111111111111";
const AUTH = { id_usuario: "22222222-2222-4222-8222-222222222222" };

const sessao = (extra = {}) => ({
  phone: "5511900000000",
  id_empresa: EMPRESA,
  estado: "has_caption",
  last_caption: "Sexta da calabresa! #pizza",
  last_image_storage_paths: [`${EMPRESA}/_whatsapp/arte.png`],
  last_image_urls: ["https://exemplo.test/arte.png"],
  ...extra,
});

function simulacao(resposta = { ok: true, agendamento: { id_publicacao_agendada: "a1" } }) {
  const chamadas = [];
  return {
    chamadas,
    deps: {
      db: {},
      agora: AGORA,
      agendadorLigado: true,
      criar: async (_db, dados) => (chamadas.push(dados), resposta),
    },
  };
}

describe("agendar pelo WhatsApp", () => {
  it("agenda com a legenda e a imagem da sessão, no horário de Brasília", async () => {
    const { chamadas, deps } = simulacao();
    const r = await agendarPostPeloWhatsapp(sessao(), "agendar amanhã 18h", AUTH, deps);
    assert.match(r.reply, /✅ Post agendado para quinta, 22\/10 às 18:00/);
    assert.match(r.reply, /tela \*Agendados\*/);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].idEmpresa, EMPRESA);
    assert.equal(chamadas[0].idUsuario, AUTH.id_usuario);
    assert.equal(chamadas[0].legenda, "Sexta da calabresa! #pizza");
    assert.equal(chamadas[0].imageStoragePath, `${EMPRESA}/_whatsapp/arte.png`);
    assert.equal(chamadas[0].imageUrl, undefined);
    assert.equal(chamadas[0].agendadaPara, "2026-10-22T21:00:00.000Z");
  });

  it("sem caminho no Storage, usa a URL da imagem", async () => {
    const { chamadas, deps } = simulacao();
    await agendarPostPeloWhatsapp(sessao({ last_image_storage_paths: [] }), "agendar 25/10 14:30", AUTH, deps);
    assert.equal(chamadas[0].imageStoragePath, undefined);
    assert.equal(chamadas[0].imageUrl, "https://exemplo.test/arte.png");
  });

  it("não é o comando: devolve null e não agenda", async () => {
    const { chamadas, deps } = simulacao();
    assert.equal(await agendarPostPeloWhatsapp(sessao(), "gerar legenda", AUTH, deps), null);
    assert.equal(await agendarPostPeloWhatsapp(sessao(), "quero agendar um post", AUTH, deps), null);
    assert.equal(chamadas.length, 0);
  });

  it("sem legenda ou sem imagem, pede o passo que falta e não agenda", async () => {
    const { chamadas, deps } = simulacao();
    const semLegenda = await agendarPostPeloWhatsapp(sessao({ last_caption: null }), "agendar amanhã 18h", AUTH, deps);
    assert.match(semLegenda.reply, /gerar legenda/);
    const semImagem = await agendarPostPeloWhatsapp(
      sessao({ last_image_storage_paths: [], last_image_urls: [] }),
      "agendar amanhã 18h",
      AUTH,
      deps,
    );
    assert.match(semImagem.reply, /gerar imagem/);
    assert.equal(chamadas.length, 0);
  });

  it("data que não entendi: explica e dá exemplos, sem agendar", async () => {
    const { chamadas, deps } = simulacao();
    for (const texto of ["agendar", "agendar amanhã", "agendar 18h", "agendar hoje 9h", "agendar 31/02 10h"]) {
      const r = await agendarPostPeloWhatsapp(sessao(), texto, AUTH, deps);
      assert.match(r.reply, /Exemplos: \*agendar amanhã 18h\*/, texto);
    }
    assert.equal(chamadas.length, 0);
  });

  it("repassa o erro do agendamento (por exemplo, imagem de outra empresa)", async () => {
    const { deps } = simulacao({ ok: false, status: 400, error: "A imagem informada não pertence a esta empresa." });
    const r = await agendarPostPeloWhatsapp(sessao(), "agendar amanhã 18h", AUTH, deps);
    assert.match(r.reply, /não pertence a esta empresa/);
    assert.equal(r.error_code, 400);
  });

  it("avisa quando o agendador está desligado neste servidor", async () => {
    const { deps } = simulacao();
    const r = await agendarPostPeloWhatsapp(sessao(), "agendar amanhã 18h", AUTH, { ...deps, agendadorLigado: false });
    assert.match(r.reply, /agendador está desligado/);
  });
});
