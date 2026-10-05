/**
 * Posts do Instagram agendados: guarda o pedido e publica quando o horário chega.
 *
 * O disparo (`processarAgendamentosVencidos`) é separado do relógio (`iniciarAgendador`),
 * então o mesmo código serve para um cron externo se o servidor um dia não ficar ligado.
 * Cada post é reservado com um UPDATE condicional, que só um servidor consegue fazer.
 */
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { fetchImageBuffer } from "./llamaVisionImage.js";
import { publicUrlForStoragePath } from "./chatGeneratedImageStorage.js";
import { publishToInstagram } from "./instagramPublishService.js";
import { whatsappCloudSendImageUrl } from "./whatsappCloudClient.js";

const TABELA = "publicacao_agendada";

export const ANTECEDENCIA_MINIMA_MS = 60_000;
export const LIMITE_FUTURO_MS = 365 * 24 * 60 * 60 * 1000;
/** Passou disso do horário marcado, não publica mais: o post sairia fora de hora. */
export const ATRASO_MAXIMO_MS = 6 * 60 * 60 * 1000;
const PUBLICANDO_TRAVADO_MS = 10 * 60 * 1000;

function mediaBucket() {
  return (env.MEDIA_BUCKET || "midias").trim();
}

/**
 * @param {unknown} valor
 * @param {Date} [agora]
 */
export function validarDataAgendamento(valor, agora = new Date()) {
  const data = new Date(String(valor ?? ""));
  if (!valor || Number.isNaN(data.getTime())) {
    return { ok: false, erro: "Data e hora inválidas." };
  }
  const diff = data.getTime() - agora.getTime();
  if (diff < ANTECEDENCIA_MINIMA_MS) {
    return { ok: false, erro: "Escolha um horário pelo menos 1 minuto no futuro." };
  }
  if (diff > LIMITE_FUTURO_MS) {
    return { ok: false, erro: "O agendamento pode ser feito com até 1 ano de antecedência." };
  }
  return { ok: true, data };
}

/** A imagem precisa ser da própria empresa; o caminho do Storage começa com o id dela. */
function caminhoPertenceAEmpresa(caminho, idEmpresa) {
  const c = String(caminho || "").trim();
  return c.startsWith(`${idEmpresa}/`) && !c.includes("..");
}

/**
 * Copia a imagem para uma pasta própria do agendamento. As prévias do chat são apagadas
 * junto com a conversa, e o post agendado não pode depender delas.
 */
async function guardarImagem(db, { idEmpresa, imageStoragePath, imageUrl }) {
  const bucket = mediaBucket();
  const destino = `${idEmpresa}/_agendados/${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  const origem = String(imageStoragePath || "").trim();

  if (origem) {
    if (!caminhoPertenceAEmpresa(origem, idEmpresa)) {
      throw new Error("A imagem informada não pertence a esta empresa.");
    }
    const { error } = await db.storage.from(bucket).copy(origem, destino);
    if (error) throw new Error(error.message || "Não foi possível guardar a imagem do agendamento.");
    return destino;
  }

  const url = String(imageUrl || "").trim();
  if (!url) throw new Error("Informe image_storage_path ou image_url.");
  const { buffer } = await fetchImageBuffer(url, { maxBytes: 16 * 1024 * 1024, timeoutMs: 90_000, retries: 1 });
  const { error } = await db.storage.from(bucket).upload(destino, buffer, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Não foi possível guardar a imagem do agendamento.");
  return destino;
}

function paraResposta(db, linha) {
  return { ...linha, image_url: publicUrlForStoragePath(db, linha.image_storage_path) };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{
 *   idEmpresa: string, idUsuario: string, legenda: string,
 *   imageStoragePath?: string, imageUrl?: string, agendadaPara: string, agora?: Date,
 * }} input
 */
export async function criarAgendamento(db, input) {
  const agora = input.agora ?? new Date();
  const validacao = validarDataAgendamento(input.agendadaPara, agora);
  if (!validacao.ok) return { ok: false, status: 400, error: validacao.erro };

  const legenda = String(input.legenda || "").trim();
  if (!legenda) return { ok: false, status: 400, error: "Legenda obrigatória para agendar." };

  let caminho;
  try {
    caminho = await guardarImagem(db, input);
  } catch (err) {
    return { ok: false, status: 400, error: err instanceof Error ? err.message : "Imagem inválida." };
  }

  const { data, error } = await db
    .from(TABELA)
    .insert({
      id_empresa: input.idEmpresa,
      criado_por_usuario_id: input.idUsuario,
      legenda,
      image_storage_path: caminho,
      agendada_para: validacao.data.toISOString(),
    })
    .select("*")
    .single();
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, agendamento: paraResposta(db, data) };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {string} idEmpresa
 */
export async function listarAgendamentos(db, idEmpresa) {
  const { data, error } = await db
    .from(TABELA)
    .select("*")
    .eq("id_empresa", idEmpresa)
    .order("agendada_para", { ascending: false })
    .limit(100);
  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true, agendamentos: (data || []).map((l) => paraResposta(db, l)) };
}

/**
 * Só cancela o que ainda está «agendado». Já publicando ou publicado não volta atrás.
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{ id: string, idEmpresa: string, agora?: Date }} input
 */
export async function cancelarAgendamento(db, { id, idEmpresa, agora = new Date() }) {
  const { data, error } = await db
    .from(TABELA)
    .update({ status: "cancelado", data_atualizacao: agora.toISOString() })
    .eq("id_publicacao_agendada", id)
    .eq("id_empresa", idEmpresa)
    .eq("status", "agendado")
    .select("*");
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data?.length) {
    return { ok: false, status: 409, error: "Só dá para cancelar posts que ainda estão agendados." };
  }
  // Limpeza da cópia da imagem; se falhar, só sobra um arquivo no Storage.
  await db.storage.from(mediaBucket()).remove([data[0].image_storage_path]).catch(() => {});
  return { ok: true, agendamento: paraResposta(db, data[0]) };
}

async function reservar(db, item, agora) {
  const { data, error } = await db
    .from(TABELA)
    .update({
      status: "publicando",
      tentativas: (item.tentativas || 0) + 1,
      data_atualizacao: agora.toISOString(),
    })
    .eq("id_publicacao_agendada", item.id_publicacao_agendada)
    .eq("status", "agendado")
    .select("*");
  if (error) throw new Error(error.message);
  return data?.length ? data[0] : null;
}

async function finalizar(db, item, campos, agora) {
  const { error } = await db
    .from(TABELA)
    .update({ ...campos, data_atualizacao: agora.toISOString() })
    .eq("id_publicacao_agendada", item.id_publicacao_agendada)
    .eq("status", "publicando");
  if (error) throw new Error(error.message);
}

/**
 * Publica o que já passou do horário. Seguro de chamar de vários lugares ao mesmo tempo:
 * quem não conseguir reservar o post simplesmente pula.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{ agora?: Date, publicar?: typeof publishToInstagram, limite?: number }} [opts]
 */
export async function processarAgendamentosVencidos(db, opts = {}) {
  const agora = opts.agora ?? new Date();
  const publicar = opts.publicar ?? publishToInstagram;
  const resumo = { publicados: 0, falhas: 0, ignorados: 0, perdidos: 0 };

  // Servidor que caiu no meio da publicação: não tenta de novo para não postar em dobro.
  await db
    .from(TABELA)
    .update({
      status: "falhou",
      erro: "Interrompido: o servidor parou durante a publicação.",
      data_atualizacao: agora.toISOString(),
    })
    .eq("status", "publicando")
    .lt("data_atualizacao", new Date(agora.getTime() - PUBLICANDO_TRAVADO_MS).toISOString());

  const { data: vencidos, error } = await db
    .from(TABELA)
    .select("*")
    .eq("status", "agendado")
    .lte("agendada_para", agora.toISOString())
    .order("agendada_para", { ascending: true })
    .limit(opts.limite ?? 10);
  if (error) throw new Error(error.message);

  for (const item of vencidos || []) {
    const reservado = await reservar(db, item, agora);
    if (!reservado) {
      resumo.ignorados += 1;
      continue;
    }

    const atraso = agora.getTime() - new Date(item.agendada_para).getTime();
    if (atraso > ATRASO_MAXIMO_MS) {
      await finalizar(
        db,
        item,
        { status: "falhou", erro: "Horário perdido: o servidor estava desligado e o post não foi publicado." },
        agora,
      );
      resumo.perdidos += 1;
      continue;
    }

    let saida;
    try {
      saida = await publicar(db, {
        idEmpresa: item.id_empresa,
        caption: item.legenda,
        imageStoragePath: item.image_storage_path,
      });
    } catch (err) {
      saida = { ok: false, error: err instanceof Error ? err.message : "Falha ao publicar." };
    }

    if (saida?.ok) {
      await finalizar(
        db,
        item,
        {
          status: "publicado",
          id_externo: saida.instagram_media_id ?? null,
          data_publicada: agora.toISOString(),
          erro: null,
        },
        agora,
      );
      resumo.publicados += 1;
    } else {
      await finalizar(db, item, { status: "falhou", erro: String(saida?.error || "Falha ao publicar.") }, agora);
      resumo.falhas += 1;
    }
  }
  return resumo;
}

/**
 * Destino de TESTE: em vez do Instagram, manda imagem + legenda para um número de WhatsApp.
 * Serve para ver o agendamento disparar sem depender do token do Instagram. Pelas regras da
 * Meta, só entrega se esse número falou com o bot nas últimas 24 h (senão o erro é registrado).
 *
 * @param {{ destino?: string, enviarImagem?: typeof whatsappCloudSendImageUrl }} [opts]
 */
export function criarPublicadorWhatsappDeTeste(opts = {}) {
  const enviarImagem = opts.enviarImagem ?? whatsappCloudSendImageUrl;
  return async function publicarNoWhatsappDeTeste(db, { caption, imageStoragePath }) {
    const destino = String(opts.destino ?? env.WHATSAPP_CLOUD_TEST_TO ?? "").trim();
    if (!destino) {
      return { ok: false, error: "Defina WHATSAPP_CLOUD_TEST_TO no .env para usar o destino de teste." };
    }
    const url = publicUrlForStoragePath(db, imageStoragePath);
    if (!url) return { ok: false, error: "Não foi possível montar a URL pública da imagem." };
    const saida = await enviarImagem(destino, url, caption);
    if (!saida?.ok) return { ok: false, error: saida?.error || "Falha ao enviar pelo WhatsApp." };
    return { ok: true, instagram_media_id: saida.message_id ?? null };
  };
}

/**
 * Liga o relógio. Devolve a função que o desliga.
 * @param {import("@supabase/supabase-js").SupabaseClient} db
 * @param {{
 *   intervaloMs?: number,
 *   publicar?: typeof publishToInstagram,
 *   log?: Pick<Console, "info" | "warn">,
 * }} [opts]
 */
export function iniciarAgendador(db, opts = {}) {
  const log = opts.log ?? console;
  let rodando = false;

  const tick = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const r = await processarAgendamentosVencidos(db, { publicar: opts.publicar });
      if (r.publicados || r.falhas || r.perdidos) {
        log.info(
          `[agendador] publicados=${r.publicados} falhas=${r.falhas} horario_perdido=${r.perdidos}`,
        );
      }
    } catch (err) {
      log.warn("[agendador]", err instanceof Error ? err.message : err);
    } finally {
      rodando = false;
    }
  };

  const timer = setInterval(tick, opts.intervaloMs ?? 30_000);
  void tick();
  return () => clearInterval(timer);
}
