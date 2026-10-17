import { afterEach, describe, expect, it, vi } from "vitest";
import { getSoundUrl, resetSoundUrlCache } from "@/lib/audio/url";
import { shouldTreatAsBackground } from "@/lib/audio/host";

afterEach(() => {
  vi.unstubAllGlobals();
  resetSoundUrlCache();
});

describe("audio boundary regressions", () => {
  it("rechecks codec support after Audio was temporarily unavailable", () => {
    resetSoundUrlCache();
    vi.stubGlobal("Audio", undefined);
    expect(getSoundUrl("test.ogg")).toMatch(/test\.ogg$/);
    vi.stubGlobal(
      "Audio",
      class {
        canPlayType() {
          return "";
        }
      },
    );
    expect(getSoundUrl("test.ogg")).toMatch(/test\.mp3$/);
  });

  it("keeps a zero-area window muted even when a focus event arrives", () => {
    expect(shouldTreatAsBackground({ hidden: false, hasFocus: true, hasVisibleArea: false, eventType: "focus" })).toBe(
      true,
    );
  });
});
