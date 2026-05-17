-- Remove coluna nome_contato_principal (não usada no cadastro).
-- Execute no SQL Editor do Supabase ou via psql.

ALTER TABLE public.empresa
  DROP COLUMN IF EXISTS nome_contato_principal;
