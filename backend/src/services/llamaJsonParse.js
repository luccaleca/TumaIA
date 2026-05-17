/**
 * Extrai e faz parse de JSON retornado por LLMs (markdown, texto antes/depois, vírgula final).
 * @param {string} content
 * @returns {{ ok: true, parsed: unknown } | { ok: false, raw: string }}
 */
export function parseJsonFromLlmContent(content) {
  const raw = String(content ?? "").trim();
  if (!raw) return { ok: false, raw };

  const candidates = [];
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(raw);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const balanced = extractBalancedJsonObject(raw);
  if (balanced) candidates.push(balanced);

  candidates.push(raw);

  const seen = new Set();
  for (const chunk of candidates) {
    const c = chunk.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    for (const attempt of [c, c.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        return { ok: true, parsed: JSON.parse(attempt) };
      } catch {
        /* próximo */
      }
    }
  }

  return { ok: false, raw };
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function extractBalancedJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
