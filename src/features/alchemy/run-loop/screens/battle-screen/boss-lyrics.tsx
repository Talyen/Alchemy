import { useGameTranslation } from "@/components/use-game-translation";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getBossMusicKey, getLyricFrame, getMusicLyrics, readMusicPlayback, type LyricFrame } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "../../../shared/stores/react/settings-store";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const translateWord = (text: string) =>
    text === "[chants]"
      ? i18n.text("ui.boss-lyrics.chants", "[chants]")
      : text === "[growls]"
        ? i18n.text("ui.boss-lyrics.growls", "[growls]")
        : text === "[vocalizing]"
          ? i18n.text("ui.boss-lyrics.vocalizing", "[vocalizing]")
          : text;
  const phrase = frame ? lines[frame.line]!.map((word) => translateWord(word.text)).join(" ") : "";
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !phrase) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !container.clientWidth) return;
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      const style = getComputedStyle(container);
      context.font = `${style.fontWeight} 36px ${style.fontFamily}`;
      // Words animate independently. Measure the complete phrase at its maximum
      // size, including each span's space, and reserve room for the 4% word pop.
      const width = phrase
        .split(" ")
        .reduce((total, word, index) => total + context.measureText(`${index ? " " : ""}${word}`).width, 0);
      container.style.fontSize = `min(calc(36px * var(--content-scale, 1)), ${(container.clientWidth * 0.95 * 36) / Math.max(1, width)}px)`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    document.fonts?.addEventListener("loadingdone", fit);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  }, [phrase]);
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
      ref={containerRef}
      className="pointer-events-none absolute inset-x-[4%] bottom-[5%] overflow-hidden text-center text-[36px] leading-relaxed font-semibold whitespace-pre [text-shadow:0_2px_5px_#000,0_0_3px_#000]"
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
              {translateWord(word.text)}
            </span>
          ))
        : null}
    </div>
  );
}
