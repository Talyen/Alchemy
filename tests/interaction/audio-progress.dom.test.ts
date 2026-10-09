import { expect, it, vi } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { resetAudioRuntimeForTests } from "@/lib/audio";
import type { Screen } from "@/lib/routing";
import { installCleanAudio } from "../helpers/audio-fixture";
import { soundedFakeAudio } from "../helpers/fake-audio";
import { advance, installFrames } from "./timing";

it("failed audio output cannot strand a committed navigation", async () => {
  installFrames();
  installCleanAudio({ rejectPlay: true });
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
    navigation.cancelPending();
    resetAudioRuntimeForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
