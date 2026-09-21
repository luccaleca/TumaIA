import { env } from "../config.js";
import { handleWhatsappInbound } from "./whatsappInboundService.js";
import {
  isWhatsappCloudConfigured,
  isWhatsappCloudEnabled,
  whatsappCloudSendImageUrl,
  whatsappCloudSendText,
} from "./whatsappCloudClient.js";
import { parseWhatsappCloudWebhookMessages } from "./whatsappCloudWebhookParser.js";

/**
 * @typedef {{
 *   label: string,
 *   sendText: (to: string, text: string) => Promise<{ ok?: boolean, error?: string }>,
 *   sendImageUrl: (to: string, url: string, caption?: string) => Promise<{ ok?: boolean, error?: string }>,
 * }} WhatsappOutboundChannel
 */

const cloudChannel = /** @type {WhatsappOutboundChannel} */ ({
  label: "whatsapp-cloud",
  sendText: whatsappCloudSendText,
  sendImageUrl: whatsappCloudSendImageUrl,
});

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
export function clearWhatsappDedupCache() {
  recentMessageIds.clear();
}

function buildOutboundText(out) {
  let text = String(out.reply || "").trim();
  const hints = String(out.hints || "").trim();
  if (hints && !text.includes(hints)) text = text ? `${text}${hints}` : hints;
  return text;
}

/**
 * @param {{ chat_id?: string, from?: string }} msg
 * @param {any} out
 * @param {WhatsappOutboundChannel} channel
 */
async function deliverWhatsappReply(msg, out, channel) {
  const chatId = msg.chat_id || msg.from;
  const tag = channel.label;
  if (!out.ok) {
    if (out.status === 403) {
      console.warn(
        `[${tag}] acesso negado (${out.reason || "?"}): ${out.phone_detected || msg.from}`,
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
      await channel.sendText(chatId, text);
      return;
    }
    if (out.status === 503) {
      await channel.sendText(chatId, "Serviço indisponível no momento. Tente mais tarde.");
      return;
    }
    await channel.sendText(chatId, out.error || "Não consegui processar agora. Tente de novo.");
    return;
  }

  const urls = Array.isArray(out.image_urls) ? out.image_urls.filter(Boolean) : [];
  for (let i = 0; i < urls.length; i++) {
    const caption = i === 0 && out.caption ? String(out.caption) : "";
    console.info(`[${tag}] enviando imagem ${i + 1}/${urls.length} para ${chatId}`);
    const sent = await channel.sendImageUrl(chatId, urls[i], caption);
    if (!sent.ok) {
      console.warn(`[${tag}] falha ao enviar imagem:`, sent.error);
      await channel.sendText(
        chatId,
        `Gerei a arte, mas não consegui enviar a imagem aqui. URL: ${urls[i]}`,
      );
    } else {
      console.info(`[${tag}] imagem ${i + 1}/${urls.length} enviada`);
    }
  }

  const text = buildOutboundText(out);
  if (text) {
    await channel.sendText(chatId, text);
  }
}

/**
 * @param {{
 *   from: string,
 *   chat_id: string,
 *   body: string,
 *   message_id?: string | null,
 * }} msg
 * @param {WhatsappOutboundChannel} channel
 */
async function processInboundMessage(msg, channel) {
  if (msg.message_id && rememberMessageId(msg.message_id)) return;

  const isImageCmd = /^gerar\s+imagem/i.test(msg.body);
  const isCaptionCmd = /^gerar\s+legenda/i.test(msg.body);
  if (isImageCmd) {
    await channel.sendText(msg.chat_id || msg.from, "Gerando a arte… isso vai levar alguns instantes. Aguarde ⏳");
  } else if (isCaptionCmd) {
    await channel.sendText(
      msg.chat_id || msg.from,
      "Montando legenda e hashtags com IA… isso vai levar alguns instantes. Aguarde ⏳",
    );
  }

  const startedAt = Date.now();
  let out;
  try {
    out = await handleWhatsappInbound({
      from: msg.from,
      body: msg.body,
      message_id: msg.message_id || undefined,
    });
  } catch (err) {
    console.error(`[${channel.label}] erro em handleWhatsappInbound:`, err);
    await channel.sendText(
      msg.chat_id || msg.from,
      "Algo deu errado ao processar seu pedido. Tente de novo em instantes.",
    );
    return;
  }

  console.info(
    `[${channel.label}] resposta pronta em ${Date.now() - startedAt}ms imgs=${out.image_urls?.length || 0}`,
  );
  await deliverWhatsappReply(msg, out, channel);
}

/**
 * Webhook Cloud API (Meta) → IA → resposta no WhatsApp oficial.
 * @param {unknown} body
 */
export async function handleWhatsappCloudWebhook(body) {
  if (!isWhatsappCloudEnabled()) {
    return { ok: false, status: 503, error: "WHATSAPP_CLOUD_ENABLED não está ativo no backend." };
  }
  if (!isWhatsappCloudConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "Configure WHATSAPP_CLOUD_ACCESS_TOKEN e WHATSAPP_CLOUD_PHONE_NUMBER_ID.",
    };
  }

  const expectedPhoneId = String(env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "").trim();
  const messages = parseWhatsappCloudWebhookMessages(body);
  if (!messages.length) {
    return { ok: true, skipped: true, reason: "sem mensagens de texto" };
  }

  let accepted = 0;
  for (const msg of messages) {
    if (expectedPhoneId && msg.phone_number_id && msg.phone_number_id !== expectedPhoneId) {
      console.info(
        `[whatsapp-cloud] ignorado phone_number_id=${msg.phone_number_id} (esperado ${expectedPhoneId})`,
      );
      continue;
    }

    console.info(
      `[whatsapp-cloud] mensagem de ${msg.from || "?"} body=${String(msg.body || "").slice(0, 80)}`,
    );

    accepted += 1;
    void processInboundMessage(msg, cloudChannel).catch((err) => {
      console.error("[whatsapp-cloud] erro ao processar mensagem:", err);
      void cloudChannel.sendText(
        msg.chat_id || msg.from,
        "Algo deu errado ao consultar a IA. Tente de novo em instantes.",
      );
    });
  }

  return { ok: true, accepted: accepted > 0, count: accepted };
}
