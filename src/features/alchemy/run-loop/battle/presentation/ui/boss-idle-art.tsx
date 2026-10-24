import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SliceDeath } from "./slice-death";

function chooseClip(clips: readonly string[], previous?: string): string {
  const choices = clips.filter((clip) => clip !== previous);
  return choices[Math.floor(Math.random() * choices.length)] ?? clips[0]!;
}

export function BossIdleArt({
  clips,
  art,
  title,
  isDead,
  imageClassName,
}: {
  clips: readonly string[];
  art: string;
  title: string;
  isDead: boolean;
  imageClassName: string;
}) {
  const videos = useRef<Array<HTMLVideoElement | null>>([]);
  const [playback, setPlayback] = useState(() => {
    const first = chooseClip(clips);
    return { active: 0, visible: null as number | null, sources: [first, chooseClip(clips, first)] };
  });
  const [failed, setFailed] = useState(false);
  const [deathImage, setDeathImage] = useState<string | null>(null);

  useEffect(() => {
    if (failed || isDead) return;
    const video = videos.current[playback.active];
    if (!video) return;
    let disposed = false;
    const syncPlayback = () => {
      if (document.hidden) video.pause();
      else
        void video.play().catch((error: unknown) => {
          if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
        });
    };
    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [playback.active, failed, isDead]);

  useLayoutEffect(() => {
    if (!isDead) return;
    const video = playback.visible === null ? null : videos.current[playback.visible];
    let image = art;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0);
        image = canvas.toDataURL();
      }
    }
    for (const node of videos.current) node?.pause();
    setDeathImage(image);
  }, [isDead, art, playback.visible]);

  if (deathImage) return <SliceDeath imageUrl={deathImage} alt={title} imageClassName={imageClassName} />;

  return (
    <div className={cn("relative w-full overflow-hidden", imageClassName)}>
      <img src={art} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      {!failed &&
        playback.sources.map((source, slot) => (
          <video
            key={slot}
            ref={(node) => {
              videos.current[slot] = node;
            }}
            src={source}
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-contain",
              playback.visible !== slot && "opacity-0",
            )}
            onPlaying={() => {
              if (playback.active !== slot || playback.visible === slot) return;
              const nextSource = chooseClip(clips, source);
              setPlayback((previous) => {
                if (previous.active !== slot || previous.visible === slot) return previous;
                const sources = [...previous.sources];
                // Keep the outgoing last frame until the incoming video is actually playing.
                // Only then recycle the hidden decoder to preload a different next clip.
                if (previous.visible !== null) sources[previous.visible] = nextSource;
                return { ...previous, visible: slot, sources };
              });
            }}
            onEnded={() =>
              setPlayback((previous) => (previous.active === slot ? { ...previous, active: 1 - slot } : previous))
            }
            onError={() => setFailed(true)}
          />
        ))}
    </div>
  );
}
