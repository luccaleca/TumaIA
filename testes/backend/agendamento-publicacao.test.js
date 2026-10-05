import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ATRASO_MAXIMO_MS,
  cancelarAgendamento,
  criarPublicadorWhatsappDeTeste,
  criarAgendamento,
  processarAgendamentosVencidos,
  validarDataAgendamento,
} from "../../backend/src/services/agendamentoPublicacao.js";

const EMPRESA = "11111111-1111-4111-8111-111111111111";
const OUTRA_EMPRESA = "22222222-2222-4222-8222-222222222222";
const USUARIO = "33333333-3333-4333-8333-333333333333";
const AGORA = new Date("2026-10-06T15:00:00.000Z");
const emMin = (min) => new Date(AGORA.getTime() + min * 60_000).toISOString();

/** Banco em memória com só o que o serviço usa; UPDATE com filtro é atômico, como no Postgres. */
function criarBancoFalso(linhasIniciais = []) {
  const linhas = linhasIniciais.map((l) => ({ ...l }));
  const arquivos = new Set();
  let seq = 0;

  function consulta(modo, payload) {
    const filtros = [];
    let ordem = null;
    let limite = Infinity;
    let encadeado = false;
    const api = {
      eq: (c, v) => (filtros.push((l) => l[c] === v), api),
      lt: (c, v) => (filtros.push((l) => l[c] < v), api),
      lte: (c, v) => (filtros.push((l) => l[c] <= v), api),
      order: (c, { ascending }) => ((ordem = { c, ascending }), api),
      limit: (n) => ((limite = n), api),
      select: () => ((encadeado = true), api),
      single: async () => executar(true),
      then: (ok, err) => Promise.resolve(executar(false)).then(ok, err),
    };
    function executar(unico) {
      if (modo === "insert") {
        const nova = {
          id_publicacao_agendada: `id-${++seq}`,
          status: "agendado",
          tentativas: 0,
          erro: null,
          id_externo: null,
          ...payload,
        };
        linhas.push(nova);
        return { data: unico ? { ...nova } : [{ ...nova }], error: null };
      }
      let alvo = linhas.filter((l) => filtros.every((f) => f(l)));
      if (modo === "update") {
        alvo.forEach((l) => Object.assign(l, payload));
        return { data: encadeado ? alvo.map((l) => ({ ...l })) : null, error: null };
      }
      if (ordem) {
        alvo = [...alvo].sort((a, b) =>
          ordem.ascending ? (a[ordem.c] < b[ordem.c] ? -1 : 1) : a[ordem.c] < b[ordem.c] ? 1 : -1,
        );
      }
      return { data: alvo.slice(0, limite).map((l) => ({ ...l })), error: null };
    }
    return api;
  }

  const db = {
    from: () => ({
      insert: (p) => consulta("insert", p),
      update: (p) => consulta("update", p),
      select: () => consulta("select"),
    }),
    storage: {
      from: () => ({
        copy: async (de, para) => (arquivos.add(para), { error: null }),
        upload: async (para) => (arquivos.add(para), { error: null }),
        remove: async (lista) => (lista.forEach((p) => arquivos.delete(p)), { error: null }),
        getPublicUrl: (p) => ({ data: { publicUrl: `https://storage.test/${p}` } }),
      }),
    },
  };
  return { db, linhas, arquivos };
}

const linhaAgendada = (extra = {}) => ({
  id_publicacao_agendada: "a1",
  id_empresa: EMPRESA,
  legenda: "Legenda do post",
  image_storage_path: `${EMPRESA}/_agendados/a.png`,
  agendada_para: emMin(-1),
  status: "agendado",
  tentativas: 0,
  erro: null,
  id_externo: null,
  ...extra,
});

describe("validarDataAgendamento", () => {
  it("aceita horário futuro e recusa passado, vazio e muito distante", () => {
    assert.equal(validarDataAgendamento(emMin(30), AGORA).ok, true);
    assert.equal(validarDataAgendamento(emMin(-5), AGORA).ok, false);
    assert.equal(validarDataAgendamento(emMin(0.5), AGORA).ok, false);
    assert.equal(validarDataAgendamento("", AGORA).ok, false);
    assert.equal(validarDataAgendamento("não é data", AGORA).ok, false);
    assert.equal(validarDataAgendamento(emMin(60 * 24 * 400), AGORA).ok, false);
  });
});

describe("criarAgendamento", () => {
  const base = {
    idEmpresa: EMPRESA,
    idUsuario: USUARIO,
    legenda: "Terça da pizza",
    imageStoragePath: `${EMPRESA}/_chat/c1/prev.png`,
    agendadaPara: emMin(60),
    agora: AGORA,
  };

  it("guarda a imagem numa pasta própria e grava como agendado", async () => {
    const { db, linhas, arquivos } = criarBancoFalso();
    const out = await criarAgendamento(db, base);
    assert.equal(out.ok, true);
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].status, "agendado");
    assert.match(linhas[0].image_storage_path, new RegExp(`^${EMPRESA}/_agendados/`));
    assert.ok(arquivos.has(linhas[0].image_storage_path));
    assert.match(out.agendamento.image_url, /^https:\/\/storage\.test\//);
  });

  it("recusa imagem de outra empresa e não grava nada", async () => {
    const { db, linhas } = criarBancoFalso();
    const out = await criarAgendamento(db, { ...base, imageStoragePath: `${OUTRA_EMPRESA}/_chat/x.png` });
    assert.equal(out.ok, false);
    assert.equal(out.status, 400);
    assert.equal(linhas.length, 0);
  });

  it("recusa horário no passado e legenda vazia", async () => {
    const { db, linhas } = criarBancoFalso();
    assert.equal((await criarAgendamento(db, { ...base, agendadaPara: emMin(-10) })).ok, false);
    assert.equal((await criarAgendamento(db, { ...base, legenda: "   " })).ok, false);
    assert.equal(linhas.length, 0);
  });
});

describe("processarAgendamentosVencidos", () => {
  const publicarOk = async () => ({ ok: true, instagram_media_id: "ig-123" });

  it("publica só o que venceu e está agendado", async () => {
    const { db, linhas } = criarBancoFalso([
      linhaAgendada({ id_publicacao_agendada: "vencido" }),
      linhaAgendada({ id_publicacao_agendada: "futuro", agendada_para: emMin(30) }),
      linhaAgendada({ id_publicacao_agendada: "cancelado", status: "cancelado" }),
    ]);
    const chamados = [];
    const resumo = await processarAgendamentosVencidos(db, {
      agora: AGORA,
      publicar: async (_db, dados) => (chamados.push(dados), { ok: true, instagram_media_id: "ig-1" }),
    });
    assert.equal(resumo.publicados, 1);
    assert.equal(chamados.length, 1);
    assert.equal(chamados[0].caption, "Legenda do post");
    assert.equal(chamados[0].idEmpresa, EMPRESA);
    const por = (id) => linhas.find((l) => l.id_publicacao_agendada === id);
    assert.equal(por("vencido").status, "publicado");
    assert.equal(por("vencido").id_externo, "ig-1");
    assert.equal(por("futuro").status, "agendado");
    assert.equal(por("cancelado").status, "cancelado");
  });

  it("duas execuções seguidas não publicam o mesmo post duas vezes", async () => {
    const { db } = criarBancoFalso([linhaAgendada()]);
    let publicacoes = 0;
    const publicar = async () => (publicacoes++, { ok: true, instagram_media_id: "ig-1" });
    await Promise.all([
      processarAgendamentosVencidos(db, { agora: AGORA, publicar }),
      processarAgendamentosVencidos(db, { agora: AGORA, publicar }),
    ]);
    await processarAgendamentosVencidos(db, { agora: AGORA, publicar });
    assert.equal(publicacoes, 1);
  });

  it("marca como falhou, com o motivo, e não tenta de novo", async () => {
    const { db, linhas } = criarBancoFalso([linhaAgendada()]);
    let tentativas = 0;
    const publicar = async () => (tentativas++, { ok: false, error: "Session has expired (code 190)" });
    const resumo = await processarAgendamentosVencidos(db, { agora: AGORA, publicar });
    await processarAgendamentosVencidos(db, { agora: AGORA, publicar });
    assert.equal(resumo.falhas, 1);
    assert.equal(tentativas, 1);
    assert.equal(linhas[0].status, "falhou");
    assert.match(linhas[0].erro, /expired/);
    assert.equal(linhas[0].tentativas, 1);
  });

  it("erro inesperado ao publicar também vira falha registrada", async () => {
    const { db, linhas } = criarBancoFalso([linhaAgendada()]);
    await processarAgendamentosVencidos(db, {
      agora: AGORA,
      publicar: async () => {
        throw new Error("rede caiu");
      },
    });
    assert.equal(linhas[0].status, "falhou");
    assert.match(linhas[0].erro, /rede caiu/);
  });

  it("não publica post que perdeu o horário por muito tempo", async () => {
    const velho = new Date(AGORA.getTime() - ATRASO_MAXIMO_MS - 60_000).toISOString();
    const { db, linhas } = criarBancoFalso([linhaAgendada({ agendada_para: velho })]);
    let publicacoes = 0;
    const resumo = await processarAgendamentosVencidos(db, {
      agora: AGORA,
      publicar: async () => (publicacoes++, { ok: true }),
    });
    assert.equal(publicacoes, 0);
    assert.equal(resumo.perdidos, 1);
    assert.equal(linhas[0].status, "falhou");
    assert.match(linhas[0].erro, /Horário perdido/);
  });

  it("post preso em «publicando» há muito tempo vira falha, sem republicar", async () => {
    const preso = new Date(AGORA.getTime() - 30 * 60_000).toISOString();
    const { db, linhas } = criarBancoFalso([
      linhaAgendada({ status: "publicando", data_atualizacao: preso }),
    ]);
    let publicacoes = 0;
    await processarAgendamentosVencidos(db, {
      agora: AGORA,
      publicar: async () => (publicacoes++, { ok: true }),
    });
    assert.equal(publicacoes, 0);
    assert.equal(linhas[0].status, "falhou");
    assert.match(linhas[0].erro, /Interrompido/);
    await processarAgendamentosVencidos(db, { agora: AGORA, publicar: publicarOk });
  });
});

describe("cancelarAgendamento", () => {
  it("cancela um agendado e remove a cópia da imagem", async () => {
    const { db, linhas, arquivos } = criarBancoFalso([linhaAgendada({ agendada_para: emMin(60) })]);
    arquivos.add(linhas[0].image_storage_path);
    const out = await cancelarAgendamento(db, { id: "a1", idEmpresa: EMPRESA, agora: AGORA });
    assert.equal(out.ok, true);
    assert.equal(linhas[0].status, "cancelado");
    assert.equal(arquivos.size, 0);
  });

  it("não cancela o que já foi publicado nem o de outra empresa", async () => {
    const { db, linhas } = criarBancoFalso([linhaAgendada({ status: "publicado" })]);
    const jaPublicado = await cancelarAgendamento(db, { id: "a1", idEmpresa: EMPRESA, agora: AGORA });
    assert.equal(jaPublicado.ok, false);
    assert.equal(jaPublicado.status, 409);
    linhas[0].status = "agendado";
    const outra = await cancelarAgendamento(db, { id: "a1", idEmpresa: OUTRA_EMPRESA, agora: AGORA });
    assert.equal(outra.ok, false);
    assert.equal(linhas[0].status, "agendado");
  });
});

describe("destino de teste pelo WhatsApp", () => {
  const dados = { idEmpresa: EMPRESA, caption: "Legenda do post", imageStoragePath: `${EMPRESA}/_agendados/a.png` };

  it("manda imagem pública + legenda para o número de teste", async () => {
    const { db } = criarBancoFalso();
    const enviados = [];
    const publicar = criarPublicadorWhatsappDeTeste({
      destino: "5511999999999",
      enviarImagem: async (para, url, legenda) => (enviados.push({ para, url, legenda }), { ok: true, message_id: "wamid.1" }),
    });
    const out = await publicar(db, dados);
    assert.deepEqual(out, { ok: true, instagram_media_id: "wamid.1" });
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].para, "5511999999999");
    assert.equal(enviados[0].legenda, "Legenda do post");
    assert.match(enviados[0].url, new RegExp(`^https://storage\.test/${EMPRESA}/_agendados/`));
  });

  it("sem número de teste configurado recusa e não envia nada", async () => {
    const { db } = criarBancoFalso();
    let chamou = false;
    const publicar = criarPublicadorWhatsappDeTeste({
      destino: "  ",
      enviarImagem: async () => ((chamou = true), { ok: true }),
    });
    const out = await publicar(db, dados);
    assert.equal(out.ok, false);
    assert.match(out.error, /WHATSAPP_CLOUD_TEST_TO/);
    assert.equal(chamou, false);
  });

  it("falha do WhatsApp (ex.: fora da janela de 24 h) vira erro legível", async () => {
    const { db } = criarBancoFalso();
    const publicar = criarPublicadorWhatsappDeTeste({
      destino: "5511999999999",
      enviarImagem: async () => ({ ok: false, error: "Re-engagement message (code 131047)" }),
    });
    const out = await publicar(db, dados);
    assert.equal(out.ok, false);
    assert.match(out.error, /131047/);
  });

  it("no agendador, o post vencido sai pelo WhatsApp e fica como publicado", async () => {
    const { db, linhas } = criarBancoFalso([linhaAgendada()]);
    const publicar = criarPublicadorWhatsappDeTeste({
      destino: "5511999999999",
      enviarImagem: async () => ({ ok: true, message_id: "wamid.XYZ" }),
    });
    const resumo = await processarAgendamentosVencidos(db, { agora: AGORA, publicar });
    assert.equal(resumo.publicados, 1);
    assert.equal(linhas[0].status, "publicado");
    assert.equal(linhas[0].id_externo, "wamid.XYZ");
  });
});
