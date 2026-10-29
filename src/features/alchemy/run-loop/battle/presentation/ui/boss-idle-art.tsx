import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BossIdleClip } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { SliceDeath } from "./slice-death";

const BLEND_MS = 180;
const OVERLAP_SECONDS = 0.24;

function chooseClip(clips: readonly BossIdleClip[], previous?: BossIdleClip): BossIdleClip {
  const choices = clips.filter((clip) => clip !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? clips[0]!;
}

function sourceFor(clip: BossIdleClip, pixels: number) {
  return (clip.variants.find((variant) => variant.width >= pixels) ?? clip.variants.at(-1))!.src;
}

interface IdleBuffer {
  clip: BossIdleClip;
  src: string;
}
interface Playback {
  active: number;
  visible: number | null;
  outgoing: number | null;
  sources: IdleBuffer[];
}

function freezeFrame(element: HTMLElement, video: HTMLVideoElement, outgoing: HTMLVideoElement | null) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return null;
  if (outgoing && outgoing.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height =
    element.clientWidth > 0 && element.clientHeight > 0
      ? Math.round((canvas.width * element.clientHeight) / element.clientWidth)
      : video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // Match the live black surface and object-contain placement, including letterboxing.
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const draw = (source: HTMLVideoElement, opacity: number) => {
    const scale = Math.min(canvas.width / source.videoWidth, canvas.height / source.videoHeight);
    const width = source.videoWidth * scale;
    const height = source.videoHeight * scale;
    context.globalAlpha = opacity;
    context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  };
  try {
    if (outgoing && outgoing.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) draw(outgoing, 1);
    draw(video, Number(getComputedStyle(video).opacity));
    return canvas;
  } catch {
    // A seek can invalidate the decoded buffer between readiness and drawImage.
    // Retain the paused visible element until its replacement frame is ready.
    return null;
  }
}

export function BossIdleArt({
  clips,
  art,
  title,
  isDead,
  imageClassName,
}: {
  clips: readonly BossIdleClip[];
  art: string;
  title: string;
  isDead: boolean;
  imageClassName: string;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const videoRefs = useMemo(
    () =>
      [0, 1].map((slot) => (node: HTMLVideoElement | null) => {
        if (!node) videos.current[slot]?.pause();
        videos.current[slot] = node;
      }),
    [],
  );
  const pixels = useRef(0);
  const seamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playback, setPlayback] = useState<Playback>(() => {
    const first = chooseClip(clips);
    return {
      active: 0,
      visible: null,
      outgoing: null,
      sources: [first, chooseClip(clips, first)].map((clip) => ({ clip, src: "" })),
    };
  });
  const [failed, setFailed] = useState(false);
  const [deathFrame, setDeathFrame] = useState<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const measure = () => {
      // The rectangle includes the game's virtual viewport transform; contentRect does not.
      pixels.current = element.getBoundingClientRect().width * window.devicePixelRatio;
      setPlayback((previous) => {
        if (!previous.sources[0]!.src)
          return {
            ...previous,
            sources: previous.sources.map((buffer) => ({
              ...buffer,
              src: sourceFor(buffer.clip, pixels.current),
            })),
          };
        const hidden = 1 - previous.active;
        if (hidden === previous.visible || hidden === previous.outgoing) return previous;
        const buffer = previous.sources[hidden]!;
        const src = sourceFor(buffer.clip, pixels.current);
        if (src === buffer.src) return previous;
        const sources = [...previous.sources];
        sources[hidden] = { ...buffer, src };
        return { ...previous, sources };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    let density: MediaQueryList;
    const watchDensity = () => {
      density?.removeEventListener("change", densityChanged);
      density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      density.addEventListener("change", densityChanged);
    };
    const densityChanged = () => {
      measure();
      watchDensity();
    };
    watchDensity();
    return () => {
      density.removeEventListener("change", densityChanged);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [deathFrame]);

  const active = playback.active;
  const activeSource = playback.sources[active]!.src;
  useEffect(() => {
    if (failed || isDead || active === undefined) return;
    const video = videos.current[active];
    if (!video?.getAttribute("src")) return;
    let disposed = false;
    const syncPlayback = () => {
      if (seamTimer.current !== null) clearTimeout(seamTimer.current);
      if (document.hidden) {
        for (const node of videos.current) node?.pause();
      } else {
        void video.play().catch((error: unknown) => {
          if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
        });
      }
    };
    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", syncPlayback);
      if (seamTimer.current !== null) clearTimeout(seamTimer.current);
    };
  }, [active, activeSource, failed, isDead]);

  const outgoing = playback.outgoing;
  const activeClip = playback.sources[active]!.clip;
  useEffect(() => {
    if (!activeClip || outgoing === null || isDead || failed) return;
    const incoming = active;
    const timer = setTimeout(() => {
      const hidden = videos.current[outgoing];
      hidden?.pause();
      if (hidden) hidden.currentTime = 0;
      const clip = chooseClip(clips, activeClip);
      setPlayback((previous) => {
        if (previous.outgoing !== outgoing || previous.active !== incoming) return previous;
        const sources = [...previous.sources];
        sources[outgoing] = { clip, src: sourceFor(clip, pixels.current) };
        return { ...previous, outgoing: null, sources };
      });
    }, BLEND_MS);
    return () => clearTimeout(timer);
  }, [outgoing, active, activeClip, clips, failed, isDead]);

  useLayoutEffect(() => {
    if (!isDead || deathFrame) return;
    if (seamTimer.current !== null) clearTimeout(seamTimer.current);
    for (const node of videos.current) node?.pause();
    const element = wrapper.current;
    const video = playback.visible == null ? null : videos.current[playback.visible];
    if (!element || !video || failed) return;
    const outgoing = playback.outgoing == null ? null : videos.current[playback.outgoing];
    const capture = () => {
      const frame = freezeFrame(element, video, outgoing);
      if (frame) setDeathFrame(frame);
    };
    capture();
    video.addEventListener("loadeddata", capture);
    video.addEventListener("seeked", capture);
    outgoing?.addEventListener("loadeddata", capture);
    outgoing?.addEventListener("seeked", capture);
    return () => {
      video.removeEventListener("loadeddata", capture);
      video.removeEventListener("seeked", capture);
      outgoing?.removeEventListener("loadeddata", capture);
      outgoing?.removeEventListener("seeked", capture);
    };
  }, [isDead, failed, deathFrame, playback.visible, playback.outgoing]);

  if (isDead && (deathFrame || failed || playback.visible === null))
    return <SliceDeath imageUrl={art} frame={deathFrame ?? undefined} alt={title} imageClassName={imageClassName} />;

  return (
    <div ref={wrapper} className={cn("relative isolate w-full overflow-hidden bg-black", imageClassName)}>
      <img
        src={art}
        alt={title}
        className={cn(
          "absolute inset-0 h-full w-full object-contain",
          playback.visible !== null && !failed && "opacity-0",
        )}
      />
      {!failed &&
        playback.sources.map(({ src }, slot) => (
          <video
            key={slot}
            ref={videoRefs[slot]}
            src={src || undefined}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{
              zIndex: playback.visible === slot ? 2 : 1,
              opacity: playback.visible === slot || playback.outgoing === slot ? 1 : 0,
              transition: `opacity ${BLEND_MS}ms linear`,
            }}
            onPlaying={(event) => {
              const video = event.currentTarget;
              if (
                playback.active !== slot ||
                document.hidden ||
                isDead ||
                (video.currentSrc && video.currentSrc !== video.src)
              )
                return;
              setPlayback((previous) =>
                previous.active !== slot || previous.visible === slot
                  ? previous
                  : { ...previous, visible: slot, outgoing: previous.visible },
              );
              if (seamTimer.current !== null) clearTimeout(seamTimer.current);
              if (Number.isFinite(video.duration)) {
                seamTimer.current = setTimeout(
                  () => {
                    setPlayback((previous) =>
                      previous.active === slot && previous.outgoing === null
                        ? { ...previous, active: 1 - slot }
                        : previous,
                    );
                  },
                  Math.max(0, (video.duration - video.currentTime - OVERLAP_SECONDS) * 1000),
                );
              }
            }}
            onEnded={() =>
              setPlayback((previous) =>
                !isDead && previous.active === slot && previous.outgoing === null
                  ? { ...previous, active: 1 - slot }
                  : previous,
              )
            }
            onError={() => {
              if (!isDead) setFailed(true);
            }}
          />
        ))}
    </div>
  );
}
