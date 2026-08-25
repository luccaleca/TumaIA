import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { env } from "../config.js";
import { detectImageGenerationIntentFromHistory } from "./chatDeliveryUi.js";
import { parseTypedDeliveryCommand } from "./chatDeliveryCommands.js";
import { processChatMessage } from "./processChatMessage.js";
import { generatePostContextProposal } from "./postContextProposalService.js";
import { generatePostCaption } from "./postCaptionService.js";
import { runImagePreviewInternal } from "./imagePreviewInternal.js";
import { persistWhatsappGeneratedImages } from "./chatGeneratedImageStorage.js";
import { publishToInstagramViaN8n } from "./instagramPublishService.js";
import { buildWhatsappPostConfirmation } from "./postConfirmationWhatsapp.js";
import { resolveWhatsappUsuarioEmpresa } from "./whatsappUsuarioEmpresa.js";
import {
  appendWhatsappTurn,
  getOrCreateWhatsappSession,
  patchWhatsappSession,
  resetWhatsappSession,
} from "./whatsappSessionStore.js";

const CHAT_PEDIDO_RESUMO_MSG = "Resumo do pedido para a arte:";
const CHAT_PEDIDO_COLETANDO_INTRO = "Falta só completar o pedido:";

const WHATSAPP_HINT_GENERATE_IMAGE = "\n\n_Digite *gerar imagem* quando quiser a arte._";
const WHATSAPP_HINT_GENERATE_CAPTION = "\n\n_Digite *gerar legenda* para montar o texto do post._";
const WHATSAPP_HINT_PUBLISH =
  "\n\n_Se não gostar de algo, envie: *Quero alterar a legenda:* e diga o que mudar._\n\n_Digite *publicar no instagram* quando estiver pronta._";

/**
 * @param {Array<{ id?: string, label?: string }>} uiActions
 */
function formatUiActionsForWhatsapp(uiActions) {
  if (!Array.isArray(uiActions) || !uiActions.length) return "";
  const lines = uiActions
    .map((a) => {
      const id = String(a?.id || "").trim();
      if (id === "confirm_generate_image") return "• *gerar imagem* — gerar a arte";
      if (id === "generate_caption") return "• *gerar legenda* — montar legenda";
      if (id === "publish_instagram") return "• *publicar no instagram*";
      if (id === "adjust_caption") return "• *mudar legenda* — ou envie: Quero alterar a legenda: …";
      if (id === "revise_image") return "• *alterar imagem* — ou envie: Quero alterar a imagem: …";
      const label = String(a?.label || "").trim();
      return label ? `• ${label}` : null;
    })
    .filter(Boolean);
  if (!lines.length) return "";
  return `\n\n*Ações:*\n${lines.join("\n")}`;
}

/**
 * @param {import("./whatsappSessionStore.js").WhatsappSession} session
 * @param {string} body
 */
async function handleDeliveryCommand(session, body) {
  const cmd = parseTypedDeliveryCommand(body);
  if (!cmd) return null;

  const db = getSupabaseAdmin();

  if (cmd.type === "reset_session") {
    resetWhatsappSession(session.phone);
    return {
      ok: true,
      reply: "Conversa reiniciada. Pode pedir um novo post quando quiser.",
      session_reset: true,
      estado: "idle",
    };
  }

  if (cmd.type === "generate_image") {
    if (!session.post_context_proposal || !Object.keys(session.post_context_proposal).length) {
      return {
        ok: true,
        reply:
          "Ainda não tenho o resumo do pedido. Descreva o post que você quer (produto, promoção, público) e eu preparo o briefing.",
        estado: session.estado,
      };
    }
    if (!db) {
      return { ok: false, status: 503, error: "Supabase não configurado." };
    }

    const history = session.history.length ? session.history : [{ role: "user", content: body }];
    const preview = await runImagePreviewInternal(db, {
      history,
      id_empresa: session.id_empresa,
      post_context_proposal: session.post_context_proposal,
      post_supplement_links: session.post_supplement_links,
    });

    if (!preview.ok) {
      return {
        ok: true,
        reply: String(preview.error || "Não foi possível gerar a imagem agora. Tente de novo em instantes."),
        estado: session.estado,
        error_code: preview.status,
      };
    }

    const urls = Array.isArray(preview.data?.image_urls)
      ? preview.data.image_urls.filter((u) => typeof u === "string" && u.trim())
      : [];

    let storagePaths = [];
    let deliveryUrls = urls;
    if (db && urls.length) {
      try {
        const persisted = await persistWhatsappGeneratedImages(db, session.id_empresa, session.phone, urls);
        storagePaths = persisted.storage_paths;
        if (persisted.public_urls.length) deliveryUrls = persisted.public_urls;
      } catch (err) {
        console.warn(
          "[whatsapp] falha ao persistir imagem no storage:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    patchWhatsappSession(session, {
      last_image_urls: deliveryUrls,
      last_image_storage_paths: storagePaths,
      estado: deliveryUrls.length ? "has_image" : session.estado,
    });
    appendWhatsappTurn(session, body, urls.length ? "Imagem gerada." : "Não foi possível gerar a imagem.");

    const reply = deliveryUrls.length
      ? `Arte pronta!${WHATSAPP_HINT_GENERATE_CAPTION}`
      : "Não consegui gerar a imagem desta vez. Ajuste o pedido ou tente novamente.";

    return {
      ok: true,
      reply,
      image_urls: deliveryUrls,
      estado: session.estado,
      ui_actions: deliveryUrls.length
        ? [{ id: "generate_caption", label: "Gerar legenda" }]
        : undefined,
    };
  }

  if (cmd.type === "generate_caption" || cmd.type === "regenerate_caption") {
    if (!db) {
      return { ok: false, status: 503, error: "Supabase não configurado." };
    }
    if (!session.history.length) {
      return {
        ok: true,
        reply: "Converse um pouco sobre o post antes de pedir a legenda.",
        estado: session.estado,
      };
    }

    try {
      const out = await generatePostCaption({
        history: session.history,
        idEmpresa: session.id_empresa,
        db,
        postContextProposal: session.post_context_proposal || undefined,
        revisionInstructions: cmd.type === "regenerate_caption" ? cmd.instructions : undefined,
        previousCaption: cmd.type === "regenerate_caption" ? session.last_caption : undefined,
      });
      const legenda = String(out?.legenda || out?.caption || "").trim();
      const hashtags = Array.isArray(out?.hashtags)
        ? out.hashtags.map((h) => String(h).trim()).filter(Boolean)
        : [];
      const caption = [legenda, hashtags.join(" ")].filter(Boolean).join("\n\n");
      if (!caption) {
        return {
          ok: true,
          reply: "Não consegui montar a legenda agora. Tente *gerar legenda* de novo.",
          estado: session.estado,
        };
      }

      patchWhatsappSession(session, { last_caption: caption, estado: "has_caption" });
      appendWhatsappTurn(session, body, caption);

      return {
        ok: true,
        reply: `${caption}${WHATSAPP_HINT_PUBLISH}`,
        caption,
        estado: "has_caption",
        ui_actions: [
          { id: "publish_instagram", label: "Publicar no Instagram" },
          { id: "adjust_caption", label: "Mudar legenda" },
        ],
      };
    } catch (err) {
      console.warn("[whatsapp] erro ao gerar legenda:", err instanceof Error ? err.message : err);
      return {
        ok: true,
        reply: "Não consegui montar a legenda agora. Tente *gerar legenda* de novo.",
        estado: session.estado,
      };
    }
  }

  if (cmd.type === "publish_instagram") {
    if (!session.last_caption) {
      return {
        ok: true,
        reply: "Gere a legenda antes com *gerar legenda*.",
        estado: session.estado,
      };
    }
    if (!db) {
      return { ok: false, status: 503, error: "Supabase não configurado." };
    }
    const storagePath = session.last_image_storage_paths?.[0] || "";
    const imageUrl = session.last_image_urls?.[0] || "";
    if (!storagePath && !imageUrl) {
      return {
        ok: true,
        reply: "Não encontrei a imagem do post. Gere a arte de novo com *gerar imagem*.",
        estado: session.estado,
      };
    }

    appendWhatsappTurn(session, body, "Publicando no Instagram…");
    const published = await publishToInstagramViaN8n(db, {
      idEmpresa: session.id_empresa,
      caption: session.last_caption,
      imageStoragePath: storagePath || undefined,
      imageUrl: storagePath ? undefined : imageUrl,
    });

    if (!published.ok) {
      return {
        ok: true,
        reply: published.error || "Não foi possível publicar no Instagram agora. Tente de novo em instantes.",
        estado: session.estado,
        error_code: published.status,
      };
    }

    return {
      ok: true,
      reply: published.message || "Post publicado no Instagram com sucesso!",
      instagram_media_id: published.instagram_media_id,
      image_urls: published.image_url ? [published.image_url] : session.last_image_urls,
      caption: session.last_caption,
      estado: session.estado,
    };
  }

  if (cmd.type === "adjust_caption_prompt") {
    return {
      ok: true,
      reply: 'Envie: *Quero alterar a legenda:* seguido do que deseja mudar.',
      estado: session.estado,
    };
  }

  if (cmd.type === "revise_image_prompt") {
    return {
      ok: true,
      reply: 'Envie: *Quero alterar a imagem:* seguido do que deseja mudar.',
      estado: session.estado,
    };
  }

  if (cmd.type === "revise_image" && cmd.instructions) {
    if (!session.last_image_urls?.length) {
      return {
        ok: true,
        reply: "Gere uma imagem antes com *gerar imagem*.",
        estado: session.estado,
      };
    }
    if (!db) {
      return { ok: false, status: 503, error: "Supabase não configurado." };
    }
    const preview = await runImagePreviewInternal(db, {
      history: session.history,
      id_empresa: session.id_empresa,
      post_context_proposal: session.post_context_proposal || undefined,
      post_supplement_links: session.post_supplement_links,
      revision_source_url: session.last_image_urls[0],
      revision_instructions: cmd.instructions,
    });
    if (!preview.ok) {
      return {
        ok: true,
        reply: String(preview.error || "Não foi possível alterar a imagem."),
        estado: session.estado,
      };
    }
    const urls = Array.isArray(preview.data?.image_urls)
      ? preview.data.image_urls.filter((u) => typeof u === "string" && u.trim())
      : [];
    patchWhatsappSession(session, { last_image_urls: urls.length ? urls : session.last_image_urls });
    appendWhatsappTurn(session, body, "Imagem atualizada.");
    return {
      ok: true,
      reply: urls.length ? `Imagem atualizada!${WHATSAPP_HINT_GENERATE_CAPTION}` : "Não consegui alterar a imagem.",
      image_urls: urls,
      estado: session.estado,
    };
  }

  return null;
}

/**
 * @param {{ from: string, body: string, message_id?: string }} input
 */
export async function handleWhatsappInbound(input) {
  const body = String(input.body || "").trim();
  const messageId = String(input.message_id || "").trim() || null;

  if (!body) {
    return { ok: false, status: 400, error: "body obrigatório." };
  }

  const auth = await resolveWhatsappUsuarioEmpresa(input.from);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.error,
      reason: auth.reason,
      phone_detected: auth.phone_detected,
    };
  }

  const session = getOrCreateWhatsappSession(auth.phone, auth.id_empresa);

  const commandResult = await handleDeliveryCommand(session, body);
  if (commandResult) {
    return {
      ok: true,
      from: auth.phone,
      id_empresa: auth.id_empresa,
      message_id: messageId,
      ...commandResult,
    };
  }

  const history = session.history;
  const chat = await processChatMessage({
    question: body,
    history,
    id_empresa: auth.id_empresa,
    fast_path: env.TUMAIA_NODE_CHAT || env.TUMAIA_WHATSAPP_FAST_PATH,
    chat_session_id: `wa-${auth.id_empresa}-${auth.phone}`,
  });

  if (!chat.ok) {
    return { ok: false, status: chat.status, error: chat.error };
  }

  const data = chat.data;
  const routeImage =
    Boolean(data.route_image_generation) ||
    Boolean(data.offer_post_context) ||
    detectImageGenerationIntentFromHistory(history, body);

  let reply = String(data.answer || "");
  let ui_actions;
  let post_context_proposal = session.post_context_proposal;
  let post_supplement_links = session.post_supplement_links;
  let estado = session.estado;

  if (routeImage) {
    const db = getSupabaseAdmin();
    if (db) {
      const historyForProposal = [...history, { role: "user", content: body }];
      try {
        const proposal = await generatePostContextProposal({
          history: historyForProposal,
          idEmpresa: auth.id_empresa,
          db,
        });
        const ready = proposal.briefing_status !== "collecting";
        const confirm = String(proposal.confirmation_message || "").trim();
        post_context_proposal =
          proposal.post_context_proposal && typeof proposal.post_context_proposal === "object"
            ? proposal.post_context_proposal
            : null;
        post_supplement_links = Array.isArray(proposal.links) ? proposal.links : [];

        const whatsappConfirm = buildWhatsappPostConfirmation(
          post_context_proposal,
          post_supplement_links,
          { briefingStatus: ready ? "ready" : "collecting" },
        );

        if (ready) {
          reply = whatsappConfirm;
          ui_actions = [{ id: "confirm_generate_image", label: "Gerar imagem" }];
          estado = "ready_for_image";
        } else {
          reply = whatsappConfirm || confirm || CHAT_PEDIDO_COLETANDO_INTRO;
          estado = "briefing";
        }
      } catch (err) {
        reply =
          err instanceof Error
            ? err.message
            : "Não foi possível preparar o resumo agora. Tente novamente.";
      }
    } else {
      reply = CHAT_PEDIDO_RESUMO_MSG;
    }

    if (estado === "ready_for_image") {
      reply += WHATSAPP_HINT_GENERATE_IMAGE;
    }
  }

  appendWhatsappTurn(session, body, reply);
  patchWhatsappSession(session, {
    post_context_proposal,
    post_supplement_links,
    estado,
  });

  return {
    ok: true,
    from: auth.phone,
    id_empresa: auth.id_empresa,
    message_id: messageId,
    reply,
    chat_route: data.chat_route,
    route_image_generation: routeImage,
    estado,
    ui_actions: ui_actions?.length ? ui_actions : undefined,
    hints: ui_actions?.length ? formatUiActionsForWhatsapp(ui_actions) : undefined,
  };
}

/**
 * @param {string} from
 * @param {{ id_empresa?: string, phones?: string[] }} [opts]
 */
export async function resetWhatsappConversation(from) {
  const auth = await resolveWhatsappUsuarioEmpresa(from);
  if (!auth.ok) {
    return { ok: false, status: auth.status, error: auth.error };
  }
  resetWhatsappSession(auth.phone);
  return { ok: true, from: auth.phone, reset: true };
}
