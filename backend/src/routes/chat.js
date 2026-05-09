import { Router } from "express";
import { z } from "zod";
import { requireUserJwt } from "../middleware/requireUserJwt.js";
import { requireUsuario } from "../middleware/requireUsuario.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";

const r = Router();
r.use(requireUserJwt);
r.use(requireUsuario);

const uuid = z.string().uuid();

async function membroAtivo(db, idEmpresa, idUsuario) {
  const { data, error } = await db
    .from("usuario_empresa")
    .select("id_usuario")
    .eq("id_empresa", idEmpresa)
    .eq("id_usuario", idUsuario)
    .eq("ativo", true)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: null };
  return { ok: true };
}

async function getConversaDoUsuario(db, idConversa, idUsuario) {
  const { data, error } = await db
    .from("chat_conversa")
    .select("id_conversa, id_usuario, id_empresa, titulo, data_atualizacao, data_criacao")
    .eq("id_conversa", idConversa)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data || data.id_usuario !== idUsuario) return { data: null, error: null };
  return { data, error: null };
}

/**
 * GET /chat/conversas?id_empresa=<uuid>
 * Lista conversas do usuário na empresa.
 */
r.get("/conversas", async (req, res) => {
  const parsed = z.object({ id_empresa: uuid }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query id_empresa (uuid) obrigatório." });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { id_empresa: idEmpresa } = parsed.data;
  const membro = await membroAtivo(db, idEmpresa, idUsuario);
  if (!membro.ok) {
    res.status(membro.error ? 500 : 403).json({ error: membro.error || "Sem acesso a esta empresa." });
    return;
  }

  const { data, error } = await db
    .from("chat_conversa")
    .select("id_conversa, titulo, data_atualizacao, data_criacao, ativo")
    .eq("id_usuario", idUsuario)
    .eq("id_empresa", idEmpresa)
    .eq("ativo", true)
    .order("data_atualizacao", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ conversas: data || [] });
});

/**
 * POST /chat/conversas
 * Cria conversa vazia (mensagens vêm no PUT).
 */
r.post("/conversas", async (req, res) => {
  const parsed = z
    .object({
      id_empresa: uuid,
      titulo: z.string().max(200).optional().nullable(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { id_empresa: idEmpresa, titulo } = parsed.data;

  const membro = await membroAtivo(db, idEmpresa, idUsuario);
  if (!membro.ok) {
    res.status(membro.error ? 500 : 403).json({ error: membro.error || "Sem acesso a esta empresa." });
    return;
  }

  const insert = {
    id_usuario: idUsuario,
    id_empresa: idEmpresa,
    titulo: titulo && String(titulo).trim() ? String(titulo).trim().slice(0, 200) : null,
    ativo: true,
  };

  const { data, error } = await db.from("chat_conversa").insert(insert).select("id_conversa, titulo, data_atualizacao").single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ conversa: data });
});

/**
 * GET /chat/conversas/:idConversa
 * Uma conversa com mensagens ordenadas.
 */
r.get("/conversas/:idConversa", async (req, res) => {
  const idParse = uuid.safeParse(req.params.idConversa);
  if (!idParse.success) {
    res.status(400).json({ error: "id_conversa inválido." });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { data: conv, error: e1 } = await getConversaDoUsuario(db, idParse.data, idUsuario);
  if (e1) {
    res.status(500).json({ error: e1 });
    return;
  }
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  const { data: msgs, error: e2 } = await db
    .from("chat_mensagem")
    .select("id_mensagem, papel, conteudo, metadados_json, data_criacao")
    .eq("id_conversa", idParse.data)
    .order("data_criacao", { ascending: true });

  if (e2) {
    res.status(500).json({ error: e2.message });
    return;
  }

  res.json({
    conversa: conv,
    mensagens: msgs || [],
  });
});

const mensagemPutSchema = z.object({
  mensagens: z
    .array(
      z.object({
        papel: z.enum(["user", "assistant", "system"]),
        conteudo: z.string().min(1).max(50000),
        metadados_json: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .max(200),
});

/**
 * PUT /chat/conversas/:idConversa/mensagens
 * Substitui todas as mensagens da conversa.
 */
r.put("/conversas/:idConversa/mensagens", async (req, res) => {
  const idParse = uuid.safeParse(req.params.idConversa);
  if (!idParse.success) {
    res.status(400).json({ error: "id_conversa inválido." });
    return;
  }

  const parsed = mensagemPutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { data: conv, error: e0 } = await getConversaDoUsuario(db, idParse.data, idUsuario);
  if (e0) {
    res.status(500).json({ error: e0 });
    return;
  }
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  const { mensagens } = parsed.data;
  const idConversa = idParse.data;

  const { error: delErr } = await db.from("chat_mensagem").delete().eq("id_conversa", idConversa);
  if (delErr) {
    res.status(500).json({ error: delErr.message });
    return;
  }

  if (mensagens.length === 0) {
    res.json({ ok: true, salvas: 0 });
    return;
  }

  const t0 = Date.now();
  const linhas = mensagens.map((m, i) => ({
    id_conversa: idConversa,
    papel: m.papel,
    conteudo: m.conteudo,
    metadados_json: m.metadados_json !== undefined ? m.metadados_json : null,
    data_criacao: new Date(t0 + i * 50).toISOString(),
  }));

  const { error: insErr } = await db.from("chat_mensagem").insert(linhas);
  if (insErr) {
    res.status(500).json({ error: insErr.message });
    return;
  }

  const firstUser = mensagens.find((m) => m.papel === "user");
  const textoPrimeiro =
    firstUser && typeof firstUser.conteudo === "string" ? String(firstUser.conteudo).trim() : "";
  const novoTitulo =
    textoPrimeiro.length === 0
      ? null
      : textoPrimeiro.length <= 80
        ? textoPrimeiro
        : `${textoPrimeiro.slice(0, 80)}…`;

  if (novoTitulo && (!conv.titulo || !String(conv.titulo).trim())) {
    await db.from("chat_conversa").update({ titulo: novoTitulo }).eq("id_conversa", idConversa);
  }

  res.json({ ok: true, salvas: mensagens.length });
});

/**
 * PATCH /chat/conversas/:idConversa  { titulo }
 */
r.patch("/conversas/:idConversa", async (req, res) => {
  const idParse = uuid.safeParse(req.params.idConversa);
  if (!idParse.success) {
    res.status(400).json({ error: "id_conversa inválido." });
    return;
  }

  const parsed = z.object({ titulo: z.string().trim().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { data: conv, error: e0 } = await getConversaDoUsuario(db, idParse.data, idUsuario);
  if (e0) {
    res.status(500).json({ error: e0 });
    return;
  }
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  const titulo = parsed.data.titulo.trim().slice(0, 200);
  const { data, error } = await db
    .from("chat_conversa")
    .update({ titulo })
    .eq("id_conversa", idParse.data)
    .select("id_conversa, titulo, data_atualizacao")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ conversa: data });
});

/**
 * DELETE /chat/conversas/:idConversa
 */
r.delete("/conversas/:idConversa", async (req, res) => {
  const idParse = uuid.safeParse(req.params.idConversa);
  if (!idParse.success) {
    res.status(400).json({ error: "id_conversa inválido." });
    return;
  }

  const db = getSupabaseAdmin();
  if (!db) {
    res.status(503).json({ error: "Supabase não configurado." });
    return;
  }

  const idUsuario = req.usuario.id_usuario;
  const { data: conv, error: e0 } = await getConversaDoUsuario(db, idParse.data, idUsuario);
  if (e0) {
    res.status(500).json({ error: e0 });
    return;
  }
  if (!conv) {
    res.status(404).json({ error: "Conversa não encontrada." });
    return;
  }

  const { error } = await db.from("chat_conversa").delete().eq("id_conversa", idParse.data);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

export default r;
