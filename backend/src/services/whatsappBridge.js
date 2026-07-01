import { env } from "../config.js";
import { handleWhatsappInbound } from "./whatsappInboundService.js";
import { isPlausibleAuthPhone } from "./whatsappPhoneAuth.js";
import {
  isWppconnectEnabled,
  wppconnectResolvePnLid,
  wppconnectSendImageUrl,
  wppconnectSendText,
} from "./wppconnectClient.js";
import { parseWppconnectWebhookMessage, pickLidRecipient } from "./wppconnectWebhookParser.js";

const DEDUP_TTL_MS = 5 * 60 * 1000;
const DEDUP_MAX = 2000;

/** @type {Map<string, number>} */
const recentMessageIds = new Map();

function rememberMessageId(id) {
  if (!id) return false;
  const now = Date.now();
  if (recentMessageIds.has(id)) return true;
  recentMessageIds.set(id, now);
  if (recentMessageIds.size > DEDUP_MAX) {
    for (const [key, ts] of recentMessageIds) {
      if (now - ts > DEDUP_TTL_MS) recentMessageIds.delete(key);
    }
  }
  return false;
}

/** Só para testes. */
export function clearWppconnectDedupCache() {
  recentMessageIds.clear();
}

/**
 * @param {import("./wppconnectWebhookParser.js").ReturnType<typeof parseWppconnectWebhookMessage>} msg
 */
function buildOutboundText(out) {
  let text = String(out.reply || "").trim();
  const hints = String(out.hints || "").trim();
  if (hints && !text.includes(hints)) text = text ? `${text}${hints}` : hints;
  return text;
}

async function deliverWhatsappReply(msg, out) {
  const chatId = msg.chat_id || msg.from;
  if (!out.ok) {
    if (out.status === 403) {
      console.warn(
        `[wppconnect] acesso negado (${out.reason || "?"}): ${out.phone_detected || msg.from} sender_ids=${JSON.stringify(msg.sender_ids || [])}`,
      );
      const text =
        out.reason === "not_registered"
          ? "Este número não está cadastrado no TumaIA.\n\nCrie sua conta em https://tumaia.com/cadastro usando *o mesmo telefone* do WhatsApp."
          : out.reason === "no_empresa"
            ? "Sua conta ainda não está vinculada a nenhuma empresa. Peça um convite ao administrador."
            : out.reason === "invalid_phone"
              ? out.error ||
                "Não consegui identificar seu número no WhatsApp. Envie a mensagem de novo ou confira o telefone no cadastro do TumaIA."
              : out.reason === "no_workspace"
              ? out.error ||
                "Abra o painel TumaIA e entre no workspace da empresa — isso define qual marca o bot usa no WhatsApp."
              : out.error || "Você não pode usar este atendimento agora.";
      await wppconnectSendText(chatId, text);
      return;
    }
    if (out.status === 503) {
      await wppconnectSendText(chatId, "Serviço indisponível no momento. Tente mais tarde.");
      return;
    }
    await wppconnectSendText(chatId, out.error || "Não consegui processar agora. Tente de novo.");
    return;
  }

  const urls = Array.isArray(out.image_urls) ? out.image_urls.filter(Boolean) : [];
  for (let i = 0; i < urls.length; i++) {
    const caption = i === 0 && out.caption ? String(out.caption) : "";
    console.info(`[wppconnect] enviando imagem ${i + 1}/${urls.length} para ${chatId}`);
    const sent = await wppconnectSendImageUrl(chatId, urls[i], caption);
    if (!sent.ok) {
      console.warn("[wppconnect] falha ao enviar imagem:", sent.error);
      await wppconnectSendText(
        chatId,
        `Gerei a arte, mas não consegui enviar a imagem aqui. URL: ${urls[i]}`,
      );
    } else {
      console.info(`[wppconnect] imagem ${i + 1}/${urls.length} enviada`);
    }
  }

  const text = buildOutboundText(out);
  if (text) {
    await wppconnectSendText(chatId, text);
  }
}

/**
 * @param {import("./wppconnectWebhookParser.js").ReturnType<typeof parseWppconnectWebhookMessage>} msg
 */
async function resolveInboundAuthPhone(msg) {
  if (isPlausibleAuthPhone(msg.from)) return msg.from;

  const lid = pickLidRecipient(msg.sender_ids) || (/@lid$/i.test(String(msg.chat_id)) ? msg.chat_id : null);
  if (lid) {
    const resolved = await wppconnectResolvePnLid(lid);
    if (resolved) {
      console.info(`[wppconnect] @lid resolvido para telefone ${resolved.slice(0, 4)}…`);
      return resolved;
    }
  }

  return msg.from || "";
}

/**
 * @param {import("./wppconnectWebhookParser.js").ReturnType<typeof parseWppconnectWebhookMessage>} msg
 */
async function processInboundMessage(msg) {
  if (msg.from_me) return;
  if (msg.is_group && !env.WPPCONNECT_PROCESS_GROUPS) return;
  if (msg.message_id && rememberMessageId(msg.message_id)) return;

  const authPhone = await resolveInboundAuthPhone(msg);

  const isImageCmd = /^gerar\s+imagem/i.test(msg.body);
  const isCaptionCmd = /^gerar\s+legenda/i.test(msg.body);
  if (isImageCmd) {
    await wppconnectSendText(msg.chat_id || msg.from, "Gerando a arte… isso vai levar alguns instantes. Aguarde ⏳");
  } else if (isCaptionCmd) {
    await wppconnectSendText(
      msg.chat_id || msg.from,
      "Montando legenda e hashtags com IA… isso vai levar alguns instantes. Aguarde ⏳",
    );
  }

  const startedAt = Date.now();
  let out;
  try {
    out = await handleWhatsappInbound({
      from: authPhone,
      body: msg.body,
      message_id: msg.message_id || undefined,
    });
  } catch (err) {
    console.error("[wppconnect] erro em handleWhatsappInbound:", err);
    await wppconnectSendText(
      msg.chat_id || msg.from,
      "Algo deu errado ao processar seu pedido. Tente de novo em instantes.",
    );
    return;
  }

  console.info(
    `[wppconnect] resposta pronta em ${Date.now() - startedAt}ms imgs=${out.image_urls?.length || 0}`,
  );
  await deliverWhatsappReply(msg, out);
}

/**
 * Webhook do WPPConnect Server → IA → resposta no WhatsApp.
 * @param {unknown} body
 */
export async function handleWppconnectWebhook(body) {
  if (!isWppconnectEnabled()) {
    return { ok: false, status: 503, error: "WPPCONNECT_ENABLED não está ativo no backend." };
  }

  const msg = parseWppconnectWebhookMessage(body);
  if (!msg) {
    return { ok: true, skipped: true, reason: "evento ignorado" };
  }

  if (msg.from_me) {
    return { ok: true, skipped: true, reason: "fromMe" };
  }

  if (msg.is_group && !env.WPPCONNECT_PROCESS_GROUPS) {
    return { ok: true, skipped: true, reason: "grupo" };
  }

  void processInboundMessage(msg).catch((err) => {
    console.error("[wppconnect] erro ao processar mensagem:", err);
    void wppconnectSendText(
      msg.chat_id || msg.from,
      "Algo deu errado ao consultar a IA. Tente de novo em instantes.",
    );
  });

  return { ok: true, accepted: true, from: msg.from };
}
