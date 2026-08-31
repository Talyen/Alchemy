import { describe, expect, it } from "vitest";
import type { AlchemyDesktopApi } from "@/lib/desktop-api";

describe("desktop bridge contract", () => {
  it("keeps the renderer bridge methods explicit", () => {
    const api = {
      isDesktop: false,
      setDisplayMode: async () => undefined,
      quit: async () => undefined,
      listSaveCandidates: async () => [],
      writeSave: async () => true,
      clearSave: async () => true,
      steamGetName: async () => null,
      steamSetRichPresence: async () => true,
      steamCloudRead: async () => null,
      steamCloudWrite: async () => true,
      steamCloudDelete: async () => true,
    } satisfies AlchemyDesktopApi;

    expect(Object.keys(api)).toEqual([
      "isDesktop",
      "setDisplayMode",
      "quit",
      "listSaveCandidates",
      "writeSave",
      "clearSave",
      "steamGetName",
      "steamSetRichPresence",
      "steamCloudRead",
      "steamCloudWrite",
      "steamCloudDelete",
    ]);
  });
});
