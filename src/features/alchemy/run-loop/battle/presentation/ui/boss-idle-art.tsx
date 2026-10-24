import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BossIdleClip } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { SliceDeath } from "./slice-death";

const BLEND_MS = 180;
const OVERLAP_SECONDS = 0.24;
const VIDEO_INSET = 0.03;
const VIDEO_SCALE = 1 - 2 * VIDEO_INSET;

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
  const [deathImage, setDeathImage] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const measure = () => {
      // The rectangle includes the game's virtual viewport transform; contentRect does not.
      pixels.current = element.getBoundingClientRect().width * VIDEO_SCALE * window.devicePixelRatio;
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
  }, []);

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
    if (!isDead) return;
    const video = playback.visible == null ? null : videos.current[playback.visible];
    let image = art;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "black";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const insetX = canvas.width * VIDEO_INSET,
          insetY = canvas.height * VIDEO_INSET;
        const width = canvas.width * VIDEO_SCALE,
          height = canvas.height * VIDEO_SCALE;
        const outgoing = playback.outgoing == null ? null : videos.current[playback.outgoing];
        if (outgoing && outgoing.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          context.drawImage(outgoing, insetX, insetY, width, height);
          context.globalAlpha = Number(getComputedStyle(video).opacity);
        }
        context.drawImage(video, insetX, insetY, width, height);
        image = canvas.toDataURL();
      }
    }
    for (const node of videos.current) node?.pause();
    setDeathImage(image);
  }, [isDead, art, playback.visible, playback.outgoing]);

  if (deathImage) return <SliceDeath imageUrl={deathImage} alt={title} imageClassName={imageClassName} />;

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
            className="pointer-events-none absolute object-contain"
            style={{
              inset: `${VIDEO_INSET * 100}%`,
              width: `${VIDEO_SCALE * 100}%`,
              height: `${VIDEO_SCALE * 100}%`,
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
                previous.active === slot && previous.outgoing === null ? { ...previous, active: 1 - slot } : previous,
              )
            }
            onError={() => setFailed(true)}
          />
        ))}
    </div>
  );
}
