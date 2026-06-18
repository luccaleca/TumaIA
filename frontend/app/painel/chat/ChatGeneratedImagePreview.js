"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { downloadGeneratedImage } from "../../../lib/downloadImage";

function IconDownload({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/** Abrir em nova aba (seta saindo para o canto superior). */
function IconExternal({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function IconClose({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const OVERLAY_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-sm transition-[background,transform] hover:bg-black/70 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-50";

/**
 * @param {{
 *   url: string,
 *   index?: number,
 *   onDownload?: () => void,
 *   layout?: "inline" | "focus",
 * }} props
 */
function ImageActionButtons({ url, onDownload, downloading, layout = "inline" }) {
  return (
    <div
      className={`flex gap-1.5 ${layout === "focus" ? "absolute right-3 top-3 z-10" : "absolute right-2 top-2 z-10"}`}
      onClick={(ev) => ev.stopPropagation()}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={OVERLAY_BTN}
        title="Abrir em nova aba"
        aria-label="Abrir em nova aba"
      >
        <IconExternal className="h-4 w-4" />
      </a>
      <button
        type="button"
        disabled={downloading}
        onClick={onDownload}
        className={OVERLAY_BTN}
        title="Baixar imagem"
        aria-label="Baixar imagem"
      >
        <IconDownload className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`} />
      </button>
    </div>
  );
}

/**
 * @param {{ url: string, index?: number }} props
 */
export default function ChatGeneratedImagePreview({ url, index = 0 }) {
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState("");
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!focused) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(ev) {
      if (ev.key === "Escape") setFocused(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  const onDownload = useCallback(
    async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (downloading) return;
      setErr("");
      setDownloading(true);
      const out = await downloadGeneratedImage(url);
      setDownloading(false);
      if (!out.ok) setErr(out.error || "Não foi possível baixar.");
    },
    [downloading, url],
  );

  const lightbox =
    focused && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Prévia ampliada da imagem"
            onClick={() => setFocused(false)}
          >
            <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" aria-hidden />
            <div
              className="relative z-10 w-full max-w-lg"
              onClick={(ev) => ev.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setFocused(false)}
                className="absolute -right-1 -top-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md hover:bg-black/80 sm:-right-2 sm:-top-2"
                aria-label="Fechar imagem"
              >
                <IconClose className="h-4 w-4" />
              </button>
              <ImageActionButtons
                url={url}
                downloading={downloading}
                onDownload={onDownload}
                layout="focus"
              />
              <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 shadow-2xl">
                <img
                  src={url}
                  alt="Prévia ampliada"
                  className="max-h-[min(78vh,720px)] w-full object-contain"
                />
              </div>
              {err ? (
                <p className="mt-2 text-center text-xs text-red-300">{err}</p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-muted/30">
        <button
          type="button"
          className="block w-full cursor-zoom-in text-left"
          onClick={() => setFocused(true)}
          aria-label="Ampliar imagem gerada"
        >
          <img
            src={url}
            alt={index > 0 ? `Prévia gerada ${index + 1}` : "Prévia gerada"}
            className="max-h-72 w-full object-contain transition-[transform] duration-200 group-hover:scale-[1.01]"
          />
        </button>
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-0 transition group-hover:ring-1 group-hover:ring-white/20" />
        <div className="pointer-events-auto opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <ImageActionButtons url={url} downloading={downloading} onDownload={onDownload} />
        </div>
        {err && !focused ? (
          <p className="border-t border-border bg-background/90 px-2 py-1 text-xs text-red-600 dark:text-red-400">
            {err}
          </p>
        ) : null}
      </div>
      {lightbox}
    </>
  );
}
