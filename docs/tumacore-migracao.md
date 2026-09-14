# Migração TumaCore → TumaIA

O repositório antigo `TumaCore` vira uma **feature do TumaIA**, não um segundo produto.

## Dois níveis (visão de produto)

| Nível | Quem vê | Escopo dos dados | Status |
|-------|---------|------------------|--------|
| **Plataforma (SaaS)** | Donos do TumaIA (`dono_plataforma`) | Todas as empresas: segmentos, usuários, chat, mídias, atividade | **Agora** — `/painel/tumacore` |
| **Empresa** | Administrador daquela empresa | Só `id_empresa` da sessão: posts pedidos, membros, uso interno | **Depois** — não misturar com a área de plataforma |

Hoje o TumaCore no painel é **só plataforma**. Cargo `administrador` em `usuario_empresa` **não** abre essa área.

Mais à frente: uma aba/analytics de empresa (gate por vínculo ativo + papel admin), filtrando sempre por `id_empresa` — sem ver dados de outras empresas.

Não copiamos o schema `tb_*` nem o FastAPI/Python do Core.

## Status (nível plataforma)

| # | Escopo | Status |
|---|--------|--------|
| 1 | Dashboard KPIs + evolução + fluxo + donut + tabela | **Feito** |
| 2 | Gestão de clientes (lista, busca, detalhe, assinatura) | **Feito** |
| 3 | Analytics (KPIs, Δ, tendência, heatmap, ranking) | **Feito** |
| 4 | Consultas guiadas (presets; substituto do Chat SQL) | **Feito** |
| 5 | Filtro de período compartilhado (presets + de/até) | **Feito** |

## APIs (`/plataforma/*`)

- `GET /dashboard`
- `GET /clientes?q=&filtro=` · `GET /clientes/:id`
- `GET /analytics`
- `GET /sql/presets` · `POST /sql/preset`

Todas com JWT + `requireDonoPlataforma`. Query `period` ou `from`+`to`.

## UI

Subnav: Dashboard · Clientes · Analytics · Consultas · Conta (link para `/painel/conta`).

## Não aplicável agora

| Item | Motivo |
|------|--------|
| Analytics por empresa (admin da empresa) | Próxima fase; gate e dados separados |
| Créditos / saldo / extrato | Sem tabelas de crédito no produto |
| Mapa Brasil / UF / cidade | `empresa` sem geolocalização |
| Confiança IA / latência / falhas GPT·n8n | Sem pipeline `tb_geracao` / `tb_analytics_*` |
| Chat SQL com LLM + Chroma + SQL livre | Alto risco; usamos presets |
| Perfil duplicado no TumaCore | Conta + Configuração do painel |

## Acesso (plataforma)

```env
TUMAIA_PLATAFORMA_ADMIN_EMAILS=seu@email.com
```

Ou flag `dono_plataforma` no usuário.
