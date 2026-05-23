"use client";

import { ARTE_FORMAT_PRESETS } from "../../../lib/arteFormatPresets";
import FormatFrameIcon from "./FormatFrameIcon";

/**
 * @param {{
 *   value: { preset_id?: string } | null | undefined,
 *   onChange: (preset: typeof ARTE_FORMAT_PRESETS[0]) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function FormatoPresetPicker({ value, onChange, disabled }) {
  const selectedId = value?.preset_id || "post_square";

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex min-w-full gap-1.5 rounded-full bg-muted/60 p-1">
        {ARTE_FORMAT_PRESETS.map((preset) => {
          const active = preset.id === selectedId;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.hint ? `${preset.ratio} · ${preset.hint}` : preset.ratio}
              onClick={() => onChange(preset)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-center transition-all ${
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <FormatFrameIcon orientation={preset.orientation} className="text-current" />
              <span className="text-xs font-semibold leading-none">{preset.ratio}</span>
              <span className="text-[10px] leading-tight opacity-90">
                {preset.label}
                {preset.subtitle ? (
                  <>
                    <br />
                    <span className="font-normal">{preset.subtitle}</span>
                  </>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
