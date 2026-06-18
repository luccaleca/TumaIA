"use client";

import { useState } from "react";
import { normalizeArteBrief } from "../../../lib/arteFormatPresets";
import ArteBriefPalette from "./ArteBriefPalette";
import FormatoPresetPicker from "./FormatoPresetPicker";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent/55 focus:ring-2 focus:ring-accent/15";

const REDE_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
];

/**
 * @param {{
 *   brief: Record<string, unknown>,
 *   brandColors?: string[],
 *   disabled?: boolean,
 *   onBriefChange: (brief: Record<string, unknown>) => void,
 *   onSave?: () => void,
 *   showGenerateButton?: boolean,
 *   onGenerate?: () => void,
 *   generateDisabled?: boolean,
 *   generateLabel?: string,
 *   hideFormato?: boolean,
 * }} props
 */
export default function ChatArteBriefCard({
  brief: briefIn,
  brandColors = [],
  disabled,
  onBriefChange,
  onSave,
  showGenerateButton,
  onGenerate,
  generateDisabled,
  generateLabel = "Gerar imagem",
  hideFormato = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const brief = normalizeArteBrief(briefIn, brandColors);
  const editBrief = editing && draft ? draft : brief;

  function startEdit() {
    setDraft({ ...brief });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function saveEdit() {
    if (draft) onBriefChange(normalizeArteBrief(draft, brandColors));
    setDraft(null);
    setEditing(false);
    onSave?.();
  }

  function patch(partial) {
    const base = editing && draft ? draft : brief;
    const next = normalizeArteBrief({ ...base, ...partial }, brandColors);
    if (editing) setDraft(next);
    else onBriefChange(next);
  }

  const f = editBrief.formato || {};

  return (
    <div className="rounded-xl border border-accent/35 bg-accent-muted/15 text-sm leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-accent/20 px-3 py-2.5">
        <div>
          <p className="font-semibold text-foreground">Resumo da arte</p>
          <p className="text-xs text-muted-foreground">
            {hideFormato ? "Tema, cores e textos da arte" : "Formato e cores antes de conversar com a IA"}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            disabled={disabled}
            onClick={startEdit}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            Alterar
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={cancelEdit}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm hover:opacity-90"
              onClick={saveEdit}
            >
              Salvar
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 px-3 py-3">
        {editing ? (
          <>
            {!hideFormato ? (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Formato</span>
                <div className="mt-2">
                  <FormatoPresetPicker
                    value={editBrief.formato}
                    disabled={disabled}
                    onChange={(preset) =>
                      patch({
                        formato: {
                          preset_id: preset.id,
                          ratio: preset.ratio,
                          label: preset.label,
                          subtitle: preset.subtitle,
                          pixels: preset.pixels,
                          orientation: preset.orientation,
                        },
                      })
                    }
                  />
                </div>
              </div>
            ) : null}

            <ArteBriefPalette
              cores={editBrief.cores || []}
              brandColors={brandColors}
              canEdit
              onChange={(cores) => patch({ cores })}
            />

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Tema</span>
              <textarea
                rows={2}
                className={INPUT_CLASS}
                value={editBrief.tema || ""}
                placeholder="O que a arte deve comunicar"
                onChange={(e) => patch({ tema: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Rede</span>
              <select
                className={INPUT_CLASS}
                value={editBrief.rede || "instagram"}
                onChange={(e) => patch({ rede: e.target.value })}
              >
                {REDE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Título</span>
                <input
                  type="text"
                  maxLength={48}
                  className={INPUT_CLASS}
                  value={editBrief.titulo || ""}
                  onChange={(e) => patch({ titulo: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Subtítulo</span>
                <input
                  type="text"
                  maxLength={72}
                  className={INPUT_CLASS}
                  value={editBrief.subtitulo || ""}
                  onChange={(e) => patch({ subtitulo: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-xs font-medium text-muted-foreground">Texto</span>
                <input
                  type="text"
                  maxLength={140}
                  className={INPUT_CLASS}
                  value={editBrief.texto || ""}
                  onChange={(e) => patch({ texto: e.target.value })}
                />
              </label>
            </div>
          </>
        ) : (
          <dl className="grid gap-2 text-sm">
            {!hideFormato ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Formato</dt>
                <dd className="font-medium text-foreground">
                  {f.label} {f.subtitle ? `· ${f.subtitle}` : ""} ({f.ratio}
                  {f.pixels && f.pixels !== "—" ? `, ${f.pixels}` : ""})
                </dd>
              </div>
            ) : null}
            {brief.tema ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Tema</dt>
                <dd className="text-foreground">{brief.tema}</dd>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Descreva o tema no chat ou clique em Alterar.</p>
            )}
            {brief.cores?.length ? (
              <div>
                <dt className="mb-1 text-muted-foreground">Cores</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {brief.cores.map((hex) => (
                    <span
                      key={hex}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"
                    >
                      <span
                        className="h-4 w-4 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="font-mono text-[10px]">{hex}</span>
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {brief.titulo ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Título</dt>
                <dd>{brief.titulo}</dd>
              </div>
            ) : null}
            {brief.subtitulo ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Subtítulo</dt>
                <dd>{brief.subtitulo}</dd>
              </div>
            ) : null}
            {brief.texto ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Texto</dt>
                <dd>{brief.texto}</dd>
              </div>
            ) : null}
          </dl>
        )}

        {showGenerateButton && onGenerate ? (
          <button
            type="button"
            disabled={generateDisabled}
            onClick={onGenerate}
            className="w-full rounded-xl border border-accent/40 bg-accent-muted px-3 py-2.5 text-sm font-semibold text-[#009638] shadow-sm hover:border-accent/60 disabled:opacity-50 dark:text-emerald-100"
          >
            {generateLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
