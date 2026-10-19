/**
 * Lê «amanhã 18h», «25/10 14:30», «sexta 9h» e devolve o instante em UTC, no fuso de Brasília.
 * Brasília é UTC−3 (o Brasil não usa horário de verão desde 2019), então o fuso é fixo.
 * O dia é sempre explícito: «18h» sozinho não vira data, para não agendar num dia que o cliente não quis.
 */

const FUSO_MS = 3 * 60 * 60 * 1000;
const ANTECEDENCIA_MIN_MS = 60 * 1000;

const DIAS_DA_SEMANA = new Map([
  ["domingo", 0],
  ["segunda", 1],
  ["terca", 2],
  ["quarta", 3],
  ["quinta", 4],
  ["sexta", 5],
  ["sabado", 6],
]);

const NOMES_CURTOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function semAcento(t) {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const doisDigitos = (n) => String(n).padStart(2, "0");

/** Monta o instante UTC de uma data e hora do relógio de Brasília. */
function instanteBrasilia(ano, mes, dia, hora, minuto) {
  return new Date(Date.UTC(ano, mes - 1, dia, hora, minuto) + FUSO_MS);
}

function dataExiste(ano, mes, dia) {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Texto como «sexta, 24/10 às 09:00», no horário de Brasília. */
export function rotuloBrasilia(instante) {
  const br = new Date(instante.getTime() - FUSO_MS);
  const semana = NOMES_CURTOS[br.getUTCDay()];
  return `${semana}, ${doisDigitos(br.getUTCDate())}/${doisDigitos(br.getUTCMonth() + 1)} às ${doisDigitos(br.getUTCHours())}:${doisDigitos(br.getUTCMinutes())}`;
}

/**
 * @param {string} texto o que vem depois de «agendar»
 * @param {Date} [agora]
 * @returns {{ ok: true, instante: Date, iso: string, rotulo: string } | { ok: false, motivo: string }}
 */
export function interpretarDataHoraBrasil(texto, agora = new Date()) {
  let t = ` ${semAcento(texto).replace(/\s+/g, " ").trim()} `;
  if (!t.trim()) return { ok: false, motivo: "Diga quando publicar." };

  const brAgora = new Date(agora.getTime() - FUSO_MS);
  const hoje = {
    ano: brAgora.getUTCFullYear(),
    mes: brAgora.getUTCMonth() + 1,
    dia: brAgora.getUTCDate(),
    dow: brAgora.getUTCDay(),
  };

  // 1) Data explícita dd/mm ou dd/mm/aaaa (tirada do texto antes de procurar a hora).
  let alvo = null;
  const dm = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t);
  if (dm) {
    t = t.replace(dm[0], " ");
    const dia = Number(dm[1]);
    const mes = Number(dm[2]);
    let ano = dm[3] ? Number(dm[3]) : hoje.ano;
    if (ano < 100) ano += 2000;
    if (!dataExiste(ano, mes, dia)) return { ok: false, motivo: `A data ${dm[0]} não existe.` };
    alvo = { ano, mes, dia, explicita: true };
  }

  // 2) Hora: 14:30, 18h30, 18h, 9 horas, «às 18».
  const hora =
    /(\d{1,2})\s*[:h]\s*(\d{2})\b/.exec(t) ||
    /(\d{1,2})\s*(?:h|horas?|hrs?)\b/.exec(t) ||
    /\bas\s+(\d{1,2})\b/.exec(t);
  if (!hora) {
    return { ok: false, motivo: "Faltou a hora. Exemplo: *agendar amanhã 18h*." };
  }
  const hh = Number(hora[1]);
  const mm = hora[2] !== undefined && /^\d+$/.test(hora[2]) ? Number(hora[2]) : 0;
  if (hh > 23 || mm > 59) return { ok: false, motivo: "Essa hora não existe. Use de 0h a 23h59." };
  t = t.replace(hora[0], " ");

  // 3) Dia por palavra: hoje, amanhã ou dia da semana.
  if (!alvo) {
    const palavras = t.replace(/-feira/g, "").split(/[^a-z]+/).filter(Boolean);
    if (palavras.includes("hoje")) {
      alvo = { ano: hoje.ano, mes: hoje.mes, dia: hoje.dia };
    } else if (palavras.includes("amanha")) {
      const a = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 1));
      alvo = { ano: a.getUTCFullYear(), mes: a.getUTCMonth() + 1, dia: a.getUTCDate() };
    } else {
      const nome = palavras.find((p) => DIAS_DA_SEMANA.has(p));
      if (nome) {
        const dow = DIAS_DA_SEMANA.get(nome);
        let adiante = (dow - hoje.dow + 7) % 7;
        const hojeNoHorario = instanteBrasilia(hoje.ano, hoje.mes, hoje.dia, hh, mm);
        // «sexta» numa sexta já passada do horário significa a próxima sexta.
        if (adiante === 0 && hojeNoHorario.getTime() < agora.getTime() + ANTECEDENCIA_MIN_MS) adiante = 7;
        const a = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + adiante));
        alvo = { ano: a.getUTCFullYear(), mes: a.getUTCMonth() + 1, dia: a.getUTCDate() };
      }
    }
  }
  if (!alvo) {
    return { ok: false, motivo: "Faltou o dia. Use *hoje*, *amanhã*, um dia da semana ou a data (25/10)." };
  }

  const instante = instanteBrasilia(alvo.ano, alvo.mes, alvo.dia, hh, mm);
  if (instante.getTime() < agora.getTime() + ANTECEDENCIA_MIN_MS) {
    return { ok: false, motivo: "Esse horário já passou. Escolha um horário daqui a pelo menos 1 minuto." };
  }
  return { ok: true, instante, iso: instante.toISOString(), rotulo: rotuloBrasilia(instante) };
}
