import { expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { setMuted, resetAudioRuntimeForTests } from "@/lib/audio";
import { uiSounds } from "@/lib/audio/sound-registry";
import type { Screen } from "@/lib/routing";
import { installCleanAudio } from "../helpers/audio-fixture";
import { deferred } from "../helpers/deferred";
import { soundedFakeAudio } from "../helpers/fake-audio";
import { advance, installFrames } from "./timing";

it("failed audio output cannot strand a committed navigation", async () => {
  installFrames();
  installCleanAudio({ rejectPlay: true });
  const originalNavigate = uiSounds.navigate;
  (uiSounds as Record<string, unknown>).navigate = "denied-03.ogg";
  let screen: Screen = "menu";
  let pending = false;
  const navigation = createScreenNavigation(
    {
      readScreen: () => screen,
      showScreen: (next) => {
        screen = next;
      },
      onPendingChange: (next) => {
        pending = next;
      },
    },
    defaultGameSession,
  );
  try {
    navigation.navigateTo("options");
    await advance(1000);
    expect(soundedFakeAudio().length).toBeGreaterThan(0);
    expect(screen).toBe("options");
    expect(pending).toBe(false);
    navigation.navigateTo("collection");
    await advance(1000);
    expect(screen).toBe("collection");
    expect(pending).toBe(false);
  } finally {
    (uiSounds as Record<string, unknown>).navigate = originalNavigate;
    navigation.cancelPending();
    resetAudioRuntimeForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

it("delayed media completion and muting cannot revive a cancelled navigation", async () => {
  installFrames();
  const playback = deferred<void>();
  installCleanAudio({
    onCreate: (element) => {
      element.play.mockReturnValue(playback.promise);
    },
  });
  const originalNavigate = uiSounds.navigate;
  (uiSounds as Record<string, unknown>).navigate = "denied-03.ogg";
  let screen: Screen = "menu";
  let pending = false;
  const navigation = createScreenNavigation(
    {
      readScreen: () => screen,
      showScreen: (next) => {
        screen = next;
      },
      onPendingChange: (next) => {
        pending = next;
      },
    },
    defaultGameSession,
  );
  try {
    navigation.navigateTo("options");
    navigation.navigateTo("collection");
    setMuted(true);
    await advance(1000);
    expect(screen).toBe("collection");
    expect(pending).toBe(false);
    playback.resolve();
    await advance(1);
    expect(screen).toBe("collection");
    expect(pending).toBe(false);
    expect(soundedFakeAudio().length).toBeGreaterThan(0);
    expect(soundedFakeAudio().every((element) => element.muted)).toBe(true);
  } finally {
    (uiSounds as Record<string, unknown>).navigate = originalNavigate;
    navigation.cancelPending();
    setMuted(false);
    resetAudioRuntimeForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
