"use client";

const YOUTUBE_VIDEO_ID = "wkVhfJu6v0w";

/**
 * Moldura estilo iPhone (como no tcc-teste) com vídeo YouTube Short embutido.
 */
export default function IphoneVideoFrame({
  videoId = YOUTUBE_VIDEO_ID,
  title = "Vídeo explicativo do TumaIA",
  className = "",
}) {
  const embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;

  return (
    <div className={`relative mx-auto w-full max-w-[280px] md:max-w-[300px] ${className}`}>
      <div className="rounded-[2.25rem] border border-border/80 bg-surface p-2 shadow-[0_28px_56px_-20px_rgba(15,23,42,0.35)]">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-slate-950 ring-[3px] ring-slate-900">
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-5 w-[38%] -translate-x-1/2 rounded-b-2xl bg-slate-950"
            aria-hidden
          />
          <div className="relative aspect-[9/16] w-full bg-slate-900">
            <iframe
              className="absolute inset-0 h-full w-full border-0"
              src={embedSrc}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
