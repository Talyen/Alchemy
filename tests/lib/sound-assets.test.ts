import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allRegisteredSoundFiles } from "@/lib/sound-registry";

const soundsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/sounds");

describe("registered SFX assets", () => {
  it("every registry file exists on disk", () => {
    const missing = allRegisteredSoundFiles().filter((file) => !existsSync(path.join(soundsDir, file)));
    expect(missing).toEqual([]);
  });

  it("every OGG SFX has an MP3 sibling for Safari", () => {
    const missingMp3 = allRegisteredSoundFiles()
      .filter((file) => file.endsWith(".ogg"))
      .map((file) => file.replace(/\.ogg$/i, ".mp3"))
      .filter((file) => !existsSync(path.join(soundsDir, file)));
    expect(missingMp3).toEqual([]);
  });
});
