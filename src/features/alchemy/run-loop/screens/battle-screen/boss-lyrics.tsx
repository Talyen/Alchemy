import { useGameTranslation } from "@/components/use-game-translation";

import { useEffect, useState } from "react";
import { getBossMusicKey, getLyricFrame, getMusicLyrics, readMusicPlayback, type LyricFrame } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "../../../shared/stores/settings-store";

export function BossLyrics({ bossId }: { bossId: string }) {
  useGameTranslation();
  const enabled = useSettingsStore((state) => state.bossLyricsEnabled);
  const musicKey = getBossMusicKey(bossId);
  const lines = musicKey ? getMusicLyrics(musicKey) : undefined;
  return enabled && musicKey && lines ? <SungLyrics key={bossId} musicKey={musicKey} lines={lines} /> : null;
}

function SungLyrics({ musicKey, lines }: { musicKey: string; lines: NonNullable<ReturnType<typeof getMusicLyrics>> }) {
  const i18n = useGameTranslation();
  const [frame, setFrame] = useState<LyricFrame | null>(null);
  useEffect(() => {
    let previous: LyricFrame | null = null;
    let animationFrame = 0;
    const update = () => {
      const playback = readMusicPlayback();
      const next =
        !document.hidden && playback?.key === musicKey && playback.audible
          ? getLyricFrame(lines, playback.currentTime)
          : null;
      // Poll only this leaf; React and the rest of battle stay idle between word changes.
      if (next?.line !== previous?.line || next?.visible !== previous?.visible || next?.active !== previous?.active) {
        previous = next;
        setFrame(next);
      }
      animationFrame = window.requestAnimationFrame(update);
    };
    update();
    return () => window.cancelAnimationFrame(animationFrame);
  }, [lines, musicKey]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-full mb-3 flex min-h-8 flex-wrap items-center justify-center gap-x-[0.3em] px-8 text-center text-3xl font-semibold [text-shadow:0_2px_5px_#000,0_0_3px_#000]"
      data-testid="boss-lyrics"
      aria-label={i18n.text("ui.boss-lyrics.1", "Song lyrics")}
    >
      {frame
        ? lines[frame.line]!.slice(0, frame.visible).map((word, index) => (
            <span
              key={`${frame.line}:${index}`}
              className={cn(
                "boss-lyric-word inline-block",
                index === frame.active ? "text-gold-pale" : "text-muted-foreground",
              )}
            >
              {index > 0 ? " " : ""}
              {word.text}
            </span>
          ))
        : null}
    </div>
  );
}
