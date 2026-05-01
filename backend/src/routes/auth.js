import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { env } from "../config.js";
import { getSupabaseAdmin, getSupabaseAnon } from "../supabaseAdmin.js";
import { requireUserJwt } from "../middleware/requireUserJwt.js";

const r = Router();

/** Mesmo formato que o Supabase costuma guardar (evita falha de login por maiúsculas). */
const emailNorm = z
  .string()
  .email()
  .max(150)
  .transform((s) => s.trim().toLowerCase());

/**
 * Espaços no início/fim e variações Unicode comuns ao colar senha.
 * Cadastro e login usam a mesma regra — precisa bater com o que vai para o Supabase.
 */
function normalizeSenhaInput(raw) {
  if (typeof raw !== "string") return raw;
  return raw.normalize("NFC").trim();
}

const senhaRegister = z.preprocess(
  (v) => normalizeSenhaInput(v),
  z.string().min(8).max(128),
);

const senhaLogin = z.preprocess(
  (v) => normalizeSenhaInput(v),
  z.string().min(1).max(128),
);

const registerBody = z.object({
  nome: z.string().min(1).max(150),
  email: emailNorm,
  senha: senhaRegister,
  telefone: z.string().max(20).optional().nullable(),
});

const loginBody = z.object({
  email: emailNorm,
  senha: senhaLogin,
});

/** Atualização parcial do perfil (PATCH /me). Pelo menos um campo. */
const patchMeBody = z
  .object({
    nome: z.string().min(1).max(150).optional(),
    telefone: z.union([z.string().max(20), z.null()]).optional(),
    email: emailNorm.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "Envie ao menos um campo: nome, telefone ou email",
  });

/**
 * Cadastro: cria usuário no Supabase Auth e linha em public.usuarios.
 * Chamado pelo site (front) com JSON; requer SUPABASE_URL + service role no backend.
 */
r.post("/register", async (req, res) => {
  try {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const { nome, email, senha, telefone } = parsed.data;

    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (authError) {
      const msg = authError.message ?? "Falha ao criar usuário no Auth";
      const status = /already|duplicate|exists/i.test(msg) ? 409 : 400;
      res.status(status).json({ error: msg });
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      res.status(500).json({ error: "Auth não retornou id do usuário" });
      return;
    }

    /**
     * Reforço: em alguns projetos o hash da senha fica inconsistente só com createUser.
     * O hash (bcrypt) é sempre gerado pelo GoTrue no Supabase — aqui só regravamos a mesma senha em texto.
     */
    const { error: pwdFixErr } = await db.auth.admin.updateUserById(userId, {
      password: senha,
    });
    if (pwdFixErr) {
      try {
        await db.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.error("auth.register: rollback após falha em updateUserById", delErr);
      }
      res.status(500).json({
        error: `Senha não pôde ser gravada no Auth: ${pwdFixErr.message}`,
      });
      return;
    }

    const id_usuario = randomUUID();

    const { error: insertError } = await db.from("usuario").insert({
      id_usuario,
      auth_user_id: userId,
      nome,
      email,
      telefone: telefone ?? null,
      ativo: true,
    });

    if (insertError) {
      try {
        await db.auth.admin.deleteUser(userId);
      } catch (delErr) {
        console.error("auth.register: falha ao remover usuário Auth após erro no insert", delErr);
      }
      res.status(500).json({ error: insertError.message });
      return;
    }

    let login_probe = undefined;
    if (env.AUTH_DEBUG_LOGIN_PROBE) {
      const anon = getSupabaseAnon();
      if (anon) {
        const p = await anon.auth.signInWithPassword({ email, password: senha });
        login_probe = p.error
          ? {
              ok: false,
              message: p.error.message,
              ...(typeof p.error.code === "string" && { code: p.error.code }),
            }
          : { ok: true };
      } else {
        login_probe = {
          ok: false,
          skipped: "SUPABASE_ANON_KEY ausente — não dá para testar login no servidor",
        };
      }
    }

    res.status(201).json({
      id_usuario,
      auth_user_id: userId,
      email,
      nome,
      ...(login_probe !== undefined && { login_probe }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("auth.register:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

/**
 * Login: valida e-mail/senha no Supabase Auth e devolve o JWT (para o front usar em /auth/me).
 * Requer SUPABASE_URL e SUPABASE_ANON_KEY no servidor (anon não vai para o browser nesta demo).
 */
r.post("/login", async (req, res) => {
  try {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const anon = getSupabaseAnon();
    if (!anon) {
      res.status(503).json({
        error:
          "Login indisponível: configure SUPABASE_URL e SUPABASE_ANON_KEY no servidor",
      });
      return;
    }

    const { email, senha } = parsed.data;
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.error("auth.login:", error, {
        email,
        password_length: senha.length,
      });
      res.status(401).json({
        error: error.message,
        ...(typeof error.code === "string" && { code: error.code }),
        /** Confirma o que o servidor recebeu (não é o hash; ajuda a ver tamanho errado / typo). */
        received: { email, password_length: senha.length },
      });
      return;
    }

    const s = data.session;
    if (!s?.access_token) {
      res.status(500).json({ error: "Auth não retornou access_token" });
      return;
    }

    res.json({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_in: s.expires_in,
      token_type: s.token_type,
      user: s.user
        ? { id: s.user.id, email: s.user.email }
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("auth.login:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

/**
 * Perfil do usuário logado (JWT do Supabase no header Authorization).
 */
r.get("/me", requireUserJwt, async (req, res) => {
  try {
    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const { data, error } = await db
      .from("usuario")
      .select("*")
      .eq("auth_user_id", req.authUserId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      const { data: authUserRes, error: authErr } = await db.auth.admin.getUserById(req.authUserId);
      if (authErr || !authUserRes?.user) {
        res.status(404).json({ error: "Perfil não encontrado para este usuário" });
        return;
      }

      const authUser = authUserRes.user;
      const nomeMeta =
        typeof authUser.user_metadata?.nome === "string"
          ? authUser.user_metadata.nome.trim()
          : "";
      const emailAuth = typeof authUser.email === "string" ? authUser.email.trim().toLowerCase() : "";
      const fallbackNome = nomeMeta || (emailAuth ? emailAuth.split("@")[0] : "Usuário");

      const { data: created, error: createErr } = await db
        .from("usuario")
        .insert({
          id_usuario: randomUUID(),
          auth_user_id: req.authUserId,
          nome: fallbackNome,
          email: emailAuth || null,
          telefone: null,
          ativo: true,
        })
        .select("*")
        .maybeSingle();

      if (createErr || !created) {
        const msg = String(createErr?.message || "");
        if (/duplicate|unique/i.test(msg)) {
          const { data: retried, error: retryErr } = await db
            .from("usuario")
            .select("*")
            .eq("auth_user_id", req.authUserId)
            .maybeSingle();
          if (retryErr || !retried) {
            res.status(500).json({ error: retryErr?.message || "Falha ao recuperar perfil" });
            return;
          }
          res.json({ usuario: retried });
          return;
        }
        res.status(500).json({ error: createErr?.message || "Falha ao criar perfil" });
        return;
      }

      res.json({ usuario: created });
      return;
    }

    res.json({ usuario: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("auth.me:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

/**
 * Atualiza dados do usuário logado em public.usuarios.
 * Se enviar email ou nome, sincroniza também com Supabase Auth.
 */
r.patch("/me", requireUserJwt, async (req, res) => {
  try {
    const parsed = patchMeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const db = getSupabaseAdmin();
    if (!db) {
      res.status(503).json({ error: "Supabase não configurado no servidor" });
      return;
    }

    const { nome, telefone, email } = parsed.data;

    if (nome !== undefined || email !== undefined) {
      const authUpdate = {};
      if (email !== undefined) authUpdate.email = email;
      if (nome !== undefined) authUpdate.user_metadata = { nome };

      const { error: authErr } = await db.auth.admin.updateUserById(
        req.authUserId,
        authUpdate,
      );
      if (authErr) {
        res.status(400).json({ error: authErr.message });
        return;
      }
    }

    const rowUpdates = {};
    if (nome !== undefined) rowUpdates.nome = nome;
    if (telefone !== undefined) rowUpdates.telefone = telefone;
    if (email !== undefined) rowUpdates.email = email;

    const { data, error } = await db
      .from("usuario")
      .update(rowUpdates)
      .eq("auth_user_id", req.authUserId)
      .select("*")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Perfil não encontrado para este usuário" });
      return;
    }

    res.json({ usuario: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("auth.patchMe:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

export default r;