import {
  ORIGEM_UPLOAD_CHAT_PREVIEW,
  ORIGEM_UPLOAD_IDENTIDADE_FOTO,
  ORIGEM_UPLOAD_IDENTIDADE_LOGO,
  ORIGEM_UPLOAD_MANUAL,
} from "../empresas/midiaOrigem.js";
import {
  brazilDowHourFromIso,
  dayKeyFromIso,
  shiftYmd,
  ymdFromInstant,
} from "../plataforma/dateRange.js";

export function throwIfError(res, fallback) {
  if (res?.error) {
    const err = new Error(res.error.message || fallback);
    err.status = 500;
    throw err;
  }
}

export function deltaPct(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Math.round(((c - p) / p) * 1000) / 10;
}

export function dayListFromRange(range) {
  const days = [];
  if (range.isRolling24h) {
    days.push(ymdFromInstant(new Date(range.startIso)), ymdFromInstant(new Date()));
  } else {
    let cur = range.from;
    while (cur <= range.to) {
      days.push(cur);
      cur = shiftYmd(cur, 1);
    }
  }
  return [...new Set(days)];
}

function isAcervoOrigem(origem) {
  const o = String(origem || "").trim();
  return (
    o !== ORIGEM_UPLOAD_CHAT_PREVIEW &&
    o !== ORIGEM_UPLOAD_IDENTIDADE_FOTO &&
    o !== ORIGEM_UPLOAD_IDENTIDADE_LOGO
  );
}

function displayName(u) {
  const nome = String(u?.nome || "").trim();
  if (nome) return nome;
  const email = String(u?.email || "").trim();
  if (email) return email;
  return "Membro";
}

/**
 * Carrega atividade da empresa no intervalo (somente tabelas ativas do produto).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 * @param {string} startIso
 * @param {string} endIsoExclusive
 */
export async function loadEmpresaPeriodActivity(db, idEmpresa, startIso, endIsoExclusive) {
  const ORIGENS_FORA_ACERVO = [
    ORIGEM_UPLOAD_CHAT_PREVIEW,
    ORIGEM_UPLOAD_IDENTIDADE_FOTO,
    ORIGEM_UPLOAD_IDENTIDADE_LOGO,
  ];

  const [midiasRes, conversasRes, membrosRes, midiasTotalRes, acervoRes] = await Promise.all([
    db
      .from("midia")
      .select(
        "id_midia, data_criacao, origem_upload, tipo_midia, nome_exibicao, url_arquivo, criado_por_usuario_id",
      )
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .order("data_criacao", { ascending: false })
      .limit(5000),
    db
      .from("chat_conversa")
      .select("id_conversa, id_usuario, titulo, data_atualizacao, data_criacao")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .gte("data_atualizacao", startIso)
      .lt("data_atualizacao", endIsoExclusive)
      .order("data_atualizacao", { ascending: false })
      .limit(5000),
    db
      .from("usuario_empresa")
      .select("id_usuario, cargo")
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .limit(500),
    db
      .from("midia")
      .select("id_midia", { count: "exact", head: true })
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true),
    db
      .from("midia")
      .select("id_midia", { count: "exact", head: true })
      .eq("id_empresa", idEmpresa)
      .eq("ativo", true)
      .not(
        "origem_upload",
        "in",
        `(${ORIGENS_FORA_ACERVO.map((o) => `"${o}"`).join(",")})`,
      ),
  ]);

  for (const r of [midiasRes, conversasRes, membrosRes, midiasTotalRes, acervoRes]) {
    throwIfError(r, "Falha ao agregar atividade da empresa");
  }

  const midias = Array.isArray(midiasRes.data) ? midiasRes.data : [];
  const conversas = Array.isArray(conversasRes.data) ? conversasRes.data : [];
  const membros = Array.isArray(membrosRes.data) ? membrosRes.data : [];
  const conversaIds = conversas.map((c) => String(c.id_conversa)).filter(Boolean);

  let msgsRows = [];
  if (conversaIds.length) {
    const mensagensRes = await db
      .from("chat_mensagem")
      .select("id_mensagem, id_conversa, data_criacao, papel, metadados_json")
      .in("id_conversa", conversaIds)
      .in("papel", ["user", "assistant"])
      .gte("data_criacao", startIso)
      .lt("data_criacao", endIsoExclusive)
      .limit(8000);
    throwIfError(mensagensRes, "Falha ao agregar mensagens da empresa");
    msgsRows = Array.isArray(mensagensRes.data) ? mensagensRes.data : [];
  }

  const userIds = new Set([
    ...membros.map((m) => String(m.id_usuario)),
    ...conversas.map((c) => String(c.id_usuario || "")).filter(Boolean),
    ...midias.map((m) => String(m.criado_por_usuario_id || "")).filter(Boolean),
  ]);

  let usuariosById = new Map();
  if (userIds.size) {
    const usersRes = await db
      .from("usuario")
      .select("id_usuario, nome, email")
      .in("id_usuario", [...userIds])
      .limit(500);
    throwIfError(usersRes, "Falha ao carregar membros da empresa");
    usuariosById = new Map(
      (usersRes.data || []).map((u) => [String(u.id_usuario), u]),
    );
  }

  const midiasAcervoTotal = Number(acervoRes.count || 0);

  const conteudosGerados = midias.filter(
    (m) => String(m.origem_upload || "").trim() === ORIGEM_UPLOAD_CHAT_PREVIEW,
  );
  const midiasAcervoPeriodo = midias.filter((m) => isAcervoOrigem(m.origem_upload));
  const midiasIdentidadePeriodo = midias.filter((m) => {
    const o = String(m.origem_upload || "").trim();
    return o === ORIGEM_UPLOAD_IDENTIDADE_FOTO || o === ORIGEM_UPLOAD_IDENTIDADE_LOGO;
  });

  let msgsUser = 0;
  let msgsAssistant = 0;
  let msgsAssistantComImagem = 0;
  let msgsAssistantTexto = 0;
  const msgsUserPorDia = new Map();
  const msgsAssistantPorDia = new Map();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const msgsPorConversa = new Map();

  for (const m of msgsRows) {
    const day = dayKeyFromIso(m.data_criacao);
    const idConv = String(m.id_conversa || "");
    if (idConv) msgsPorConversa.set(idConv, (msgsPorConversa.get(idConv) || 0) + 1);

    if (m.papel === "user") {
      msgsUser += 1;
      if (day) msgsUserPorDia.set(day, (msgsUserPorDia.get(day) || 0) + 1);
      const slot = brazilDowHourFromIso(m.data_criacao);
      if (slot) heatmap[slot.dow][slot.hour] += 1;
    } else if (m.papel === "assistant") {
      msgsAssistant += 1;
      if (day) msgsAssistantPorDia.set(day, (msgsAssistantPorDia.get(day) || 0) + 1);
      const meta = m.metadados_json && typeof m.metadados_json === "object" ? m.metadados_json : null;
      const hasImg =
        Array.isArray(meta?.image_urls) &&
        meta.image_urls.some((u) => typeof u === "string" && u.trim());
      if (hasImg) msgsAssistantComImagem += 1;
      else msgsAssistantTexto += 1;
    }
  }

  const conteudosPorDia = new Map();
  const midiasPorDia = new Map();
  const conversasPorDia = new Map();
  let ultimaAtividade = null;

  for (const m of midias) {
    const day = dayKeyFromIso(m.data_criacao);
    if (day) midiasPorDia.set(day, (midiasPorDia.get(day) || 0) + 1);
    if (String(m.origem_upload || "").trim() === ORIGEM_UPLOAD_CHAT_PREVIEW && day) {
      conteudosPorDia.set(day, (conteudosPorDia.get(day) || 0) + 1);
    }
    if (m.data_criacao && (!ultimaAtividade || String(m.data_criacao) > String(ultimaAtividade))) {
      ultimaAtividade = m.data_criacao;
    }
  }

  for (const c of conversas) {
    const day = dayKeyFromIso(c.data_atualizacao);
    if (day) conversasPorDia.set(day, (conversasPorDia.get(day) || 0) + 1);
    if (
      c.data_atualizacao &&
      (!ultimaAtividade || String(c.data_atualizacao) > String(ultimaAtividade))
    ) {
      ultimaAtividade = c.data_atualizacao;
    }
  }

  /** @type {Map<string, { id_usuario: string, conversas: number, conteudos_gerados: number, mensagens: number }>} */
  const porMembro = new Map();
  function bumpMember(idUsuario, field, n = 1) {
    const id = String(idUsuario || "").trim();
    if (!id) return;
    if (!porMembro.has(id)) {
      porMembro.set(id, {
        id_usuario: id,
        conversas: 0,
        conteudos_gerados: 0,
        mensagens: 0,
      });
    }
    porMembro.get(id)[field] += n;
  }

  for (const c of conversas) {
    bumpMember(c.id_usuario, "conversas");
    bumpMember(c.id_usuario, "mensagens", msgsPorConversa.get(String(c.id_conversa)) || 0);
  }
  for (const m of conteudosGerados) {
    bumpMember(m.criado_por_usuario_id, "conteudos_gerados");
  }

  const membrosAtivos = [...porMembro.values()]
    .map((row) => {
      const u = usuariosById.get(row.id_usuario);
      return {
        ...row,
        nome: displayName(u),
        email: String(u?.email || "").trim() || null,
      };
    })
    .sort(
      (a, b) =>
        b.conversas - a.conversas ||
        b.conteudos_gerados - a.conteudos_gerados ||
        b.mensagens - a.mensagens,
    );

  const tiposSolicitacao = [
    {
      tipo: "arte_com_imagem",
      label: "Respostas com arte",
      total: msgsAssistantComImagem,
    },
    {
      tipo: "conversa_texto",
      label: "Respostas só texto",
      total: msgsAssistantTexto,
    },
  ].filter((t) => t.total > 0);

  const midiasPorOrigem = [
    { origem: ORIGEM_UPLOAD_CHAT_PREVIEW, label: "Geradas no chat", total: conteudosGerados.length },
    { origem: ORIGEM_UPLOAD_MANUAL, label: "Acervo cadastrado", total: midiasAcervoPeriodo.length },
    {
      origem: "identidade",
      label: "Identidade da marca",
      total: midiasIdentidadePeriodo.length,
    },
  ].filter((t) => t.total > 0);

  return {
    midias,
    conversas,
    msgsRows,
    membros,
    usuariosById,
    conteudosGerados,
    midiasAcervoPeriodo,
    midiasIdentidadePeriodo,
    midiasTotal: Number(midiasTotalRes.count || 0),
    midiasAcervoTotal,
    msgsUser,
    msgsAssistant,
    msgsAssistantComImagem,
    msgsAssistantTexto,
    msgsUserPorDia,
    msgsAssistantPorDia,
    conteudosPorDia,
    midiasPorDia,
    conversasPorDia,
    heatmap,
    membrosAtivos,
    tiposSolicitacao,
    midiasPorOrigem,
    ultimaAtividade,
  };
}

/**
 * @param {ReturnType<typeof dayListFromRange>} dayList
 * @param {Awaited<ReturnType<typeof loadEmpresaPeriodActivity>>} activity
 */
export function buildEvolucao(dayList, activity) {
  return dayList.map((day) => ({
    day,
    conteudos_gerados: activity.conteudosPorDia.get(day) || 0,
    mensagens_usuario: activity.msgsUserPorDia.get(day) || 0,
    mensagens_assistente: activity.msgsAssistantPorDia.get(day) || 0,
    midias: activity.midiasPorDia.get(day) || 0,
    conversas: activity.conversasPorDia.get(day) || 0,
  }));
}

/**
 * Dias com qualquer uso relevante / total de dias do range.
 * @param {string[]} dayList
 * @param {Awaited<ReturnType<typeof loadEmpresaPeriodActivity>>} activity
 */
export function buildFrequencia(dayList, activity) {
  const totalDias = Math.max(dayList.length, 1);
  let diasComUso = 0;
  for (const day of dayList) {
    const used =
      (activity.conteudosPorDia.get(day) || 0) +
        (activity.msgsUserPorDia.get(day) || 0) +
        (activity.conversasPorDia.get(day) || 0) >
      0;
    if (used) diasComUso += 1;
  }
  return {
    dias_com_uso: diasComUso,
    dias_no_periodo: totalDias,
    percentual: Math.round((diasComUso / totalDias) * 1000) / 10,
  };
}

/**
 * @param {Awaited<ReturnType<typeof loadEmpresaPeriodActivity>>} activity
 * @param {{ frequencia: ReturnType<typeof buildFrequencia>, evolucao: ReturnType<typeof buildEvolucao> }} ctx
 */
export function buildDestaques(activity, ctx) {
  const destaques = [];
  const topMembro = activity.membrosAtivos[0];
  if (topMembro && (topMembro.conversas > 0 || topMembro.conteudos_gerados > 0)) {
    destaques.push({
      id: "membro_mais_ativo",
      titulo: "Membro mais ativo",
      valor: topMembro.nome,
      detalhe: `${topMembro.conversas} conversas · ${topMembro.conteudos_gerados} artes geradas`,
    });
  }

  const topTipo = [...activity.tiposSolicitacao].sort((a, b) => b.total - a.total)[0];
  if (topTipo) {
    destaques.push({
      id: "tipo_mais_usado",
      titulo: "Tipo de resposta mais comum",
      valor: topTipo.label,
      detalhe: `${topTipo.total} no período`,
    });
  }

  const topOrigem = [...activity.midiasPorOrigem].sort((a, b) => b.total - a.total)[0];
  if (topOrigem) {
    destaques.push({
      id: "conteudo_mais_usado",
      titulo: "Origem de mídia mais usada",
      valor: topOrigem.label,
      detalhe: `${topOrigem.total} no período`,
    });
  }

  let melhorDia = null;
  let melhorScore = -1;
  for (const row of ctx.evolucao) {
    const score =
      (row.conteudos_gerados || 0) * 3 +
      (row.mensagens_usuario || 0) +
      (row.conversas || 0);
    if (score > melhorScore) {
      melhorScore = score;
      melhorDia = row;
    }
  }
  if (melhorDia && melhorScore > 0) {
    destaques.push({
      id: "dia_mais_ativo",
      titulo: "Dia mais ativo",
      valor: melhorDia.day,
      detalhe: `${melhorDia.conteudos_gerados} artes · ${melhorDia.mensagens_usuario} msgs · ${melhorDia.conversas} conversas`,
    });
  }

  if (ctx.frequencia.dias_com_uso > 0) {
    destaques.push({
      id: "frequencia_uso",
      titulo: "Frequência de uso",
      valor: `${ctx.frequencia.percentual}%`,
      detalhe: `${ctx.frequencia.dias_com_uso} de ${ctx.frequencia.dias_no_periodo} dias com atividade`,
    });
  }

  return destaques.slice(0, 5);
}

/**
 * @param {Awaited<ReturnType<typeof loadEmpresaPeriodActivity>>} activity
 * @param {number} [limit]
 */
export function buildCriacoesRecentes(activity, limit = 8) {
  return activity.conteudosGerados.slice(0, limit).map((m) => {
    const u = activity.usuariosById.get(String(m.criado_por_usuario_id || ""));
    return {
      id_midia: m.id_midia,
      nome: String(m.nome_exibicao || "Prévia do chat").trim() || "Prévia do chat",
      url_arquivo: m.url_arquivo || null,
      data_criacao: m.data_criacao || null,
      criado_por: displayName(u),
    };
  });
}

/**
 * Conversas recentes (uso do TumaIA).
 * @param {Awaited<ReturnType<typeof loadEmpresaPeriodActivity>>} activity
 * @param {number} [limit]
 */
export function buildConversasRecentes(activity, limit = 6) {
  return activity.conversas.slice(0, limit).map((c) => {
    const u = activity.usuariosById.get(String(c.id_usuario || ""));
    return {
      id_conversa: c.id_conversa,
      titulo: String(c.titulo || "").trim() || "Conversa sem título",
      data_atualizacao: c.data_atualizacao || null,
      membro: displayName(u),
    };
  });
}
