import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readDeviceDisplayPreferences } from "@/features/alchemy/shared/storage/device-display-preferences";
import { getVirtualResolutionLayout } from "@/features/alchemy/shared/ui/use-virtual-resolution";

const startupPreferences = readFileSync("public/startup-preferences.js", "utf8");

describe("startup splash sizing", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--content-scale");
    vi.restoreAllMocks();
  });

  it.each([
    [960, 540, null],
    [1280, 720, null],
    [1920, 1080, { version: 1, gameSizePercent: 120 }],
    [3440, 1440, { version: 1, gameSizePercent: 80 }],
    [1024, 768, { version: 1, gameSizePercent: 113 }],
    [1920, 1080, { version: 1, gameSizePercent: 150 }],
    [1920, 1080, { version: 2, gameSizePercent: 80 }],
  ] as const)("keeps the first-paint scale through React startup at %i x %i with %j", (width, height, saved) => {
    if (saved) localStorage.setItem("alchemy-device-display-v1", JSON.stringify(saved));
    runInNewContext(startupPreferences, { window: { innerWidth: width, innerHeight: height }, document, localStorage });

    const initialScale = Number(document.documentElement.style.getPropertyValue("--content-scale"));
    const reactScale = getVirtualResolutionLayout(width, height, readDeviceDisplayPreferences()).contentScale;
    expect(initialScale).toBeCloseTo(reactScale, 12);
  });

  it("still sizes the first paint when storage is unavailable", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("Storage blocked");
      },
    };
    runInNewContext(startupPreferences, {
      window: { innerWidth: 1920, innerHeight: 1080 },
      document,
      localStorage: blockedStorage,
    });
    expect(Number(document.documentElement.style.getPropertyValue("--content-scale"))).toBeCloseTo(
      getVirtualResolutionLayout(1920, 1080).contentScale,
      12,
    );
  });
});
