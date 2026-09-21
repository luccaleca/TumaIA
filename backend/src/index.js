import { createApp } from "./app.js";
import { env, isCloudChatLlm } from "./config.js";
import { ensureChatWorkerReady, shutdownChatWorker } from "./services/chatPythonWorker.js";
import {
  isWhatsappCloudEnabled,
  isWhatsappCloudConfigured,
  whatsappCloudCheckPhone,
  whatsappCloudSubscribeApp,
} from "./services/whatsappCloudClient.js";
import { looksLikeCrsrPrefixedApiKey, resolveGrokImageApiKey } from "./services/grokImageService.js";

const app = createApp();

const imageProvider = env.IMAGE_PROVIDER || "replicate";
if (imageProvider === "grok") {
  if (!resolveGrokImageApiKey()) {
    if (looksLikeCrsrPrefixedApiKey(env.CHAT_CLOUD_API_KEY || "")) {
      console.warn(
        "[grok-image] CHAT_CLOUD_API_KEY (crsr_) não autentica api.x.ai — use XAI_API_KEY ou IMAGE_PROVIDER=replicate.",
      );
    } else {
      console.warn("[grok-image] XAI_API_KEY ausente — /ia/image-preview retornará 503.");
    }
  } else if (!env.GROK_ALLOW_BILLING) {
    console.warn("[grok-image] Defina GROK_ALLOW_BILLING=true para gerar imagens.");
  } else {
    console.info(`[image] Grok Imagine (${env.GROK_IMAGE_MODEL || "grok-imagine-image-2.0"})`);
  }
} else if (imageProvider === "openai") {
  if (!env.OPENAI_API_KEY) {
    console.warn("[openai-image] OPENAI_API_KEY ausente — /ia/image-preview retornará 503.");
  } else if (!env.OPENAI_ALLOW_BILLING) {
    console.warn("[openai-image] Defina OPENAI_ALLOW_BILLING=true.");
  }
} else if (imageProvider === "replicate") {
  if (!env.REPLICATE_API_TOKEN) {
    console.warn("[replicate] REPLICATE_API_TOKEN ausente — use o token de replicate.com/openai/gpt-image-2");
  } else if (!env.REPLICATE_ALLOW_BILLING) {
    console.warn("[replicate] Defina REPLICATE_ALLOW_BILLING=true para gerar imagens.");
  } else {
    console.info("[image] Replicate openai/gpt-image-2");
  }
}
if (env.IMAGE_PIPELINE === "raw") {
  console.info("[image] IMAGE_PIPELINE=raw — prompt de imagem = só pedido do usuário; proposta sem Llama.");
}
if (env.IMAGE_PRODUCT_MODE === "collage" || env.IMAGE_PRODUCT_MODE === "collage_refine") {
  console.warn(
    `[image] IMAGE_PRODUCT_MODE=${env.IMAGE_PRODUCT_MODE} é legado (Sharp) — use gpt_integrated em produção.`,
  );
} else {
  console.info("[image] IMAGE_PRODUCT_MODE=gpt_integrated");
}

const server = app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;
  console.log(`tumaia-backend ${baseUrl}`);
  const nodeChat =
    env.TUMAIA_NODE_CHAT || env.TUMAIA_WHATSAPP_FAST_PATH || isCloudChatLlm();
  if (nodeChat) {
    console.info(
      "[chat] motor Node ativo — regras + estados; Python/RAG desligado no fluxo principal",
    );
  } else {
    // Legado: primeira mensagem não deve pagar sozinha o boot do Python + Chroma.
    ensureChatWorkerReady().catch((err) =>
      console.warn(
        "[chat-worker] warm-up (subirá na 1ª mensagem se falhar):",
        err instanceof Error ? err.message : err,
      ),
    );
    console.info(
      `[chat-worker] timeouts boot=${Math.round(env.CHAT_WORKER_BOOT_TIMEOUT_MS / 1000)}s request=${Math.round(env.CHAT_WORKER_REQUEST_TIMEOUT_MS / 1000)}s`,
    );
  }
  if (isWhatsappCloudEnabled()) {
    console.info(
      `[whatsapp-cloud] ativo — webhook em http://localhost:${env.PORT}/whatsapp/cloud/webhook`,
    );
    if (!isWhatsappCloudConfigured()) {
      console.warn(
        "[whatsapp-cloud] faltam WHATSAPP_CLOUD_ACCESS_TOKEN ou WHATSAPP_CLOUD_PHONE_NUMBER_ID",
      );
    } else {
      whatsappCloudCheckPhone().then((phone) => {
        if (phone.ok) {
          console.info(
            `[whatsapp-cloud] número ${phone.display_phone_number || "?"} CONNECTED (${phone.platform_type})`,
          );
        } else {
          console.warn("[whatsapp-cloud] número não CONNECTED:", phone.error || phone.status);
        }
      });
      if (env.WHATSAPP_CLOUD_WABA_ID?.trim()) {
        whatsappCloudSubscribeApp().then((sub) => {
          if (sub.ok) console.info("[whatsapp-cloud] app inscrito nos webhooks da WABA");
          else console.warn("[whatsapp-cloud] subscribe WABA:", sub.error);
        });
      }
    }
    console.info(
      "[whatsapp-cloud] no Meta: Callback URL HTTPS apontando para /whatsapp/cloud/webhook (ngrok em lab)",
    );
  }
  if (isCloudChatLlm()) {
    const runtime = String(env.CHAT_CLOUD_RUNTIME || "local").trim().toLowerCase();
    console.info(
      `[chat] conversa via agente cloud (${env.CHAT_CLOUD_MODEL}, runtime=${runtime}); Ollama fora do chat`,
    );
    if (!env.CHAT_CLOUD_API_KEY) {
      console.warn("[chat] CHAT_CLOUD_API_KEY ausente — respostas conversacionais vão falhar.");
    }
  } else {
    console.info(
      `[chat] CHAT_LLM_PROVIDER=ollama — modelo ${env.OLLAMA_FAST_CHAT_MODEL || env.LLAMA_MODEL || "padrão"}`,
    );
  }
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `Porta ${env.PORT} em uso. No .env use outra PORT ou encerre o processo:\n` +
        `  netstat -ano | findstr :${env.PORT}\n` +
        `  taskkill /PID <pid> /F`
    );
    process.exit(1);
  }
  throw err;
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    process.exit(1);
    return;
  }
  shuttingDown = true;
  console.log(`\n${signal}, encerrando servidor...`);
  shutdownChatWorker();
  // Encerra sockets abertos de uma vez (libera a porta mais rápido no Windows).
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 4000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
