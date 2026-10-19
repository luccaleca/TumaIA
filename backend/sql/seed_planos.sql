-- Planos de assinatura (Free, Plus, Pro) — valores do documento "Tuma IA — Planos de assinatura".
-- Rode no SQL Editor do Supabase. Pode rodar mais de uma vez: só insere o que ainda não existe.
--
-- Mapeamento para as colunas já existentes em public.plano:
--   limite_posts_mes = fotos por mês (15 / 30 / 100)
--   limite_contas    = empresas por plano (1 / 3 / 10)
--   limite_usuarios  = NÃO existe no documento; coloquei o mesmo valor de limite_contas. AJUSTE se for outro.
-- O limite de produtos (50 / 500 / 1.200) não tem coluna na tabela; fica só no site por enquanto.

insert into public.plano (nome, descricao, limite_usuarios, limite_posts_mes, limite_contas, valor_mensal, ativo)
select v.nome, v.descricao, v.limite_usuarios, v.limite_posts_mes, v.limite_contas, v.valor_mensal, true
from (values
  ('Free',  'Ideal para quem está começando a estruturar as redes sociais.',                 1,  15,  1,  79.90),
  ('Plus',  'Automação completa para quem quer presença digital diária.',                    3,  30,  3,  129.90),
  ('Pro',   'Para quem cuida de várias empresas, como pequenas agências, em um só plano.',   10, 100, 10, 349.90)
) as v(nome, descricao, limite_usuarios, limite_posts_mes, limite_contas, valor_mensal)
where not exists (select 1 from public.plano p where p.nome = v.nome);

-- Exemplo para ligar uma empresa a um plano (troque os ids e descomente):
-- insert into public.assinatura_empresa (id_empresa, id_plano, status, data_inicio, data_fim, email_assinatura)
-- select '<ID_DA_EMPRESA>'::uuid, p.id_plano, 'ativa', now(), now() + interval '30 days', '<EMAIL>'
-- from public.plano p where p.nome = 'Plus';
