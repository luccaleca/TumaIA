---
cron: "0 12 * * 1"
---

Briefing semanal de prática em inteligência de mercado. Não envie mensagem a ninguém. O caderno é o entregável.

1. Abra a skill `atualizar-pratica`.
2. Busque o que mudou nos últimos 7 dias em camada semântica, copilots de BI e agentes que consultam warehouse ou painel. Ignore lançamento sem efeito no trabalho de quem mede preço, share ou sell-out.
3. Separe método durável de ferramenta datada. Afirmação de ferramenta só entra com fonte e data.
4. Chame `registrar_pratica` com slug `briefing-semanal` e tema `atualizacao-pratica` se a nota vigente disser coisa diferente. `verificadoEm` é o instante desta sessão em ISO-8601 com fuso. validadeDias 14.
