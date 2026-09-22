import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPackage } from "@electron/asar";
import { afterEach, expect, it } from "vitest";
import {
  verifyPackagedRenderer,
  verifyWindowsExecutableArchitecture,
} from "../../scripts/lib/release/release-checks.mjs";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function archive(files: Record<string, string>, musicFiles: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-package-test-"));
  directories.push(root);
  const source = path.join(root, "source");
  const music = path.join(root, "music");
  await mkdir(source);
  await mkdir(music);
  await writeFile(path.join(music, "Menu 1.mp3"), "expected music bytes");
  for (const [name, bytes] of Object.entries(musicFiles)) {
    await writeFile(path.join(music, name), bytes);
  }
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

it("accepts music filenames with spaces", async () => {
  const { output, music } = await archive(
    {
      "dist/index.html": "<html></html>",
      "dist/Music/Menu 1.mp3": "expected music bytes",
      "dist/Music/Battle 1.mp3": "battle music bytes",
    },
    { "Battle 1.mp3": "battle music bytes" },
  );
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

it("validates executable architecture rather than trusting package folder names", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-pe-test-"));
  directories.push(root);
  const executable = path.join(root, "Alchemy.exe");
  const bytes = Buffer.alloc(152);
  bytes.write("MZ");
  bytes.writeUInt32LE(128, 0x3c);
  bytes.writeUInt32LE(0x00004550, 128);
  bytes.writeUInt16LE(0x8664, 132);
  await writeFile(executable, bytes);
  expect(() => verifyWindowsExecutableArchitecture(executable)).not.toThrow();
  for (const machine of [0xaa64, 0x014c]) {
    bytes.writeUInt16LE(machine, 132);
    await writeFile(executable, bytes);
    expect(() => verifyWindowsExecutableArchitecture(executable)).toThrow("must be x64 for Steamworks");
  }
  bytes.writeUInt32LE(0xffffffff, 0x3c);
  await writeFile(executable, bytes);
  expect(() => verifyWindowsExecutableArchitecture(executable)).toThrow("Invalid Windows PE header");
  await writeFile(executable, bytes.subarray(0, 20));
  expect(() => verifyWindowsExecutableArchitecture(executable)).toThrow("Invalid Windows PE executable");
});
