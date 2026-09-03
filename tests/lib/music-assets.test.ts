import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allRegisteredMusicFiles } from "@/lib/audio-music";

const musicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/Music");

describe("registered music assets", () => {
  it("keeps every registered track on disk", () => {
    const missing = allRegisteredMusicFiles().filter((file) => !existsSync(path.join(musicDir, file)));
    expect(missing).toEqual([]);
  });

  it("registers every music file on disk", () => {
    const registered = new Set(allRegisteredMusicFiles());
    const onDisk = readdirSync(musicDir).filter((file) => !file.startsWith("."));
    expect(onDisk.filter((file) => !registered.has(file))).toEqual([]);
  });
});
