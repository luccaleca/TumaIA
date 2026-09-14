-- Opcional: flag persistente de dono da plataforma (área TumaCore).
-- Enquanto não rodar este patch, o acesso usa só TUMAIA_PLATAFORMA_ADMIN_EMAILS no .env.

ALTER TABLE public.usuario
  ADD COLUMN IF NOT EXISTS dono_plataforma boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usuario.dono_plataforma IS
  'Acesso à área TumaCore (ops/plataforma) no painel TumaIA. Independente do cargo na empresa.';
