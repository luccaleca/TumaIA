-- Prévias de imagem do chat: persistem em midia + storage, vinculadas à conversa.
-- Ao apagar chat_conversa, midia.id_conversa CASCADE remove as linhas;
-- o backend remove os arquivos no storage antes do DELETE da conversa.

ALTER TABLE public.midia
  ADD COLUMN IF NOT EXISTS id_conversa uuid NULL;

ALTER TABLE public.midia
  DROP CONSTRAINT IF EXISTS midia_id_conversa_fkey;

ALTER TABLE public.midia
  ADD CONSTRAINT midia_id_conversa_fkey
  FOREIGN KEY (id_conversa)
  REFERENCES public.chat_conversa (id_conversa)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS midia_idx_id_conversa
  ON public.midia (id_conversa)
  WHERE id_conversa IS NOT NULL;

COMMENT ON COLUMN public.midia.id_conversa IS
  'Conversa do chat que originou a prévia (origem_upload=chat_preview). Storage limpo no DELETE da conversa.';
