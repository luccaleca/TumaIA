/**
 * Intervalos de data (timezone America/Sao_Paulo) para dashboard TumaCore.
 */

const TZ = "America/Sao_Paulo";
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_MS = 60 * 60 * 1000;
export const MAX_CUSTOM_RANGE_DAYS = 366;

export function ymdFromInstant(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getTodayYmd() {
  return ymdFromInstant(new Date());
}

export function ymdToStartIso(ymd) {
  return `${ymd}T00:00:00.000-03:00`;
}

export function shiftYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(anchor);
}

function ymdToEndExclusiveIso(ymd) {
  return ymdToStartIso(shiftYmd(ymd, 1));
}

export function countDaysInclusive(fromYmd, toYmd) {
  const [y1, m1, d1] = fromYmd.split("-").map(Number);
  const [y2, m2, d2] = toYmd.split("-").map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((to - from) / 86_400_000) + 1;
}

function isValidYmd(value) {
  if (!YMD_RE.test(String(value || ""))) return false;
  const [y, m, d] = String(value).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function formatPtYmd(ymd) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function formatRangeLabel(fromYmd, toYmd, period, isRolling24h) {
  if (isRolling24h || (period === 1 && fromYmd !== toYmd)) return "Últimas 24 horas";
  if (period === 1 && fromYmd === toYmd) return "Hoje";
  if (period === 7) return "Últimos 7 dias";
  if (period === 30) return "Últimos 30 dias";
  if (fromYmd === toYmd) return formatPtYmd(fromYmd);
  return `${formatPtYmd(fromYmd)} – ${formatPtYmd(toYmd)}`;
}

function buildRolling24hRange(now = new Date()) {
  const start = new Date(now.getTime() - 24 * HOUR_MS);
  const fromYmd = ymdFromInstant(start);
  const toYmd = ymdFromInstant(now);
  return {
    mode: "preset",
    period: 1,
    from: fromYmd,
    to: toYmd,
    startIso: start.toISOString(),
    endIsoExclusive: now.toISOString(),
    label: formatRangeLabel(fromYmd, toYmd, 1, true),
    isRolling24h: true,
  };
}

/**
 * @param {{ period?: string|number, from?: string, to?: string }} searchParams
 */
export function resolveDashboardRange(searchParams = {}) {
  const today = getTodayYmd();
  const fromParam = searchParams.from;
  const toParam = searchParams.to;

  if (fromParam && toParam && isValidYmd(fromParam) && isValidYmd(toParam)) {
    let fromYmd = String(fromParam);
    let toYmd = String(toParam);
    if (fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];
    if (countDaysInclusive(fromYmd, toYmd) > MAX_CUSTOM_RANGE_DAYS) {
      fromYmd = shiftYmd(toYmd, -(MAX_CUSTOM_RANGE_DAYS - 1));
    }
    return {
      mode: "custom",
      period: null,
      from: fromYmd,
      to: toYmd,
      startIso: ymdToStartIso(fromYmd),
      endIsoExclusive: ymdToEndExclusiveIso(toYmd),
      label: formatRangeLabel(fromYmd, toYmd, null, false),
      isRolling24h: false,
    };
  }

  const parsed = Number(searchParams.period);
  const period = parsed === 7 || parsed === 30 ? parsed : 1;
  if (period === 1) return buildRolling24hRange();

  const fromYmd = shiftYmd(today, -(period - 1));
  return {
    mode: "preset",
    period,
    from: fromYmd,
    to: today,
    startIso: ymdToStartIso(fromYmd),
    endIsoExclusive: ymdToEndExclusiveIso(today),
    label: formatRangeLabel(fromYmd, today, period, false),
    isRolling24h: false,
  };
}

/**
 * Período imediatamente anterior, mesma duração (para Δ nos KPIs).
 * @param {ReturnType<typeof resolveDashboardRange>} range
 */
export function previousDashboardRange(range) {
  if (range?.isRolling24h) {
    const end = new Date(range.startIso);
    const start = new Date(end.getTime() - 24 * HOUR_MS);
    return {
      startIso: start.toISOString(),
      endIsoExclusive: end.toISOString(),
      label: "24h anteriores",
    };
  }
  const days = Math.max(
    1,
    Math.round(
      (new Date(range.endIsoExclusive).getTime() - new Date(range.startIso).getTime()) /
        86_400_000,
    ),
  );
  const toYmd = shiftYmd(range.from, -1);
  const fromYmd = shiftYmd(toYmd, -(days - 1));
  return {
    startIso: ymdToStartIso(fromYmd),
    endIsoExclusive: ymdToEndExclusiveIso(toYmd),
    label: "período anterior",
    from: fromYmd,
    to: toYmd,
  };
}

/** @param {string} iso */
export function dayKeyFromIso(iso) {
  const s = String(iso || "");
  if (s.length >= 10) return s.slice(0, 10);
  return "";
}

/**
 * @param {string} iso
 * @returns {{ dow: number, hour: number } | null} dow 0=dom … 6=sáb (America/Sao_Paulo)
 */
export function brazilDowHourFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value;
  const hourRaw = parts.find((p) => p.type === "hour")?.value;
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd];
  let hour = Number(hourRaw);
  if (hour === 24) hour = 0;
  if (dow === undefined || !Number.isFinite(hour)) return null;
  return { dow, hour };
}
