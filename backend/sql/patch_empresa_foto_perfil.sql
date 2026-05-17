-- Foto de perfil da empresa (Supabase Storage + referência na tabela).
-- Aplica no Supabase SQL Editor ou via psql após backup.

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS foto_perfil_caminho text NULL,
  ADD COLUMN IF NOT EXISTS foto_perfil_url text NULL;

COMMENT ON COLUMN public.empresa.foto_perfil_caminho IS 'Caminho no bucket de mídias, ex.: {id_empresa}/_perfil/logo-123.webp';
COMMENT ON COLUMN public.empresa.foto_perfil_url IS 'URL pública do objeto quando o bucket for público (igual midia.url_arquivo).';
