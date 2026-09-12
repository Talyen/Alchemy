import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPackage } from "@electron/asar";
import { afterEach, expect, it } from "vitest";
import { verifyPackagedRenderer } from "../../scripts/lib/release-checks.mjs";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function archive(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-package-test-"));
  directories.push(root);
  const source = path.join(root, "source");
  const music = path.join(root, "music");
  await mkdir(source);
  await mkdir(music);
  await writeFile(path.join(music, "Menu 1.mp3"), "expected music bytes");
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(source, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const output = path.join(root, "app.asar");
  await createPackage(source, output);
  return { output, music };
}

const renderer = { "dist/index.html": "<html></html>", "dist/Music/Menu 1.mp3": "expected music bytes" };

it("accepts a complete renderer archive", async () => {
  const { output, music } = await archive(renderer);
  expect(() => verifyPackagedRenderer(output, music)).not.toThrow();
});

it.each([
  [{ "dist/index.html": "<html></html>" }, /music is missing/u],
  [{ ...renderer, "dist/Music/Menu 1.mp3": "stale bytes" }, /music differs/u],
  [{ ...renderer, "dist/assets/index.js.map": "source code" }, /Source maps/u],
  [{ "dist/Music/Menu 1.mp3": "expected music bytes" }, /missing dist\/index.html/u],
])("rejects incomplete or contaminated package contents", async (files, error) => {
  const { output, music } = await archive(files);
  expect(() => verifyPackagedRenderer(output, music)).toThrow(error);
});
