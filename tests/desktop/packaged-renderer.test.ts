import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPackage } from "@electron/asar";
import { afterEach, expect, it } from "vitest";
import {
  verifyDesktopRenderer,
  verifyPackagedRenderer,
  verifyWindowsExecutableArchitecture,
} from "../../scripts/lib/release/release-checks.mjs";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const publicAssets = {
  "Music/Menu 1.mp3": "expected music bytes",
  "sounds/click.ogg": "expected OGG bytes",
  "sounds/click.mp3": "expected MP3 fallback bytes",
  "fonts/Inter.woff2": "expected font bytes",
  "licenses/inter-ofl.txt": "expected license bytes",
};

async function archive(files: Record<string, string>, extraPublicFiles: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-package-test-"));
  directories.push(root);
  const source = path.join(root, "source");
  const publicDirectory = path.join(root, "public");
  await mkdir(source);
  for (const [name, bytes] of Object.entries({ ...publicAssets, ...extraPublicFiles })) {
    const target = path.join(publicDirectory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(source, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const output = path.join(root, "app.asar");
  await createPackage(source, output);
  return { output, source, publicDirectory };
}

const desktopHtml =
  '<script type="module" src="./assets/index.js"></script><link rel="stylesheet" href="./assets/index.css">';
const renderer: Record<string, string> = {
  "dist/index.html": desktopHtml,
  "dist/assets/index.js": "console.log('ready');",
  "dist/assets/index.css": "body { color: white; }",
  ...Object.fromEntries(Object.entries(publicAssets).map(([name, bytes]) => [`dist/${name}`, bytes])),
};

it.each(["dist", "dist-demo"])(
  "accepts complete %s output before and after packaging without optimizer receipts",
  async (directory) => {
    const { output, source, publicDirectory } = await archive(
      Object.fromEntries(
        Object.entries({ ...renderer, "dist/Music/Battle 1.mp3": "battle music bytes" }).map(([name, bytes]) => [
          name.replace(/^dist/u, directory),
          bytes,
        ]),
      ),
      { "Music/Battle 1.mp3": "battle music bytes", "Music/.asset-hashes.json": "optimizer receipt" },
    );
    expect(() => verifyDesktopRenderer(path.join(source, directory), publicDirectory)).not.toThrow();
    expect(() => verifyPackagedRenderer(output, publicDirectory, directory)).not.toThrow();
  },
);

it.each([
  [
    Object.fromEntries(Object.entries(renderer).filter(([name]) => !name.includes("Music/"))),
    /asset is missing: Music/u,
  ],
  [{ ...renderer, "dist/Music/Menu 1.mp3": "stale bytes" }, /asset differs.*Music/u],
  [{ ...renderer, "dist/assets/index.js.map": "source code" }, /Source maps/u],
  [{ "dist/Music/Menu 1.mp3": "expected music bytes" }, /missing dist\/index.html/u],
])("rejects incomplete or contaminated package contents", async (files, error) => {
  const { output, publicDirectory } = await archive(files);
  expect(() => verifyPackagedRenderer(output, publicDirectory)).toThrow(error);
});

it.each([
  ["sounds/click.ogg", undefined],
  ["sounds/click.mp3", "stale fallback"],
  ["fonts/Inter.woff2", ""],
  ["licenses/inter-ofl.txt", undefined],
] as const)("rejects missing or altered %s before and after packaging", async (asset, replacement) => {
  const files = { ...renderer };
  if (replacement === undefined) delete files[`dist/${asset}`];
  else files[`dist/${asset}`] = replacement;
  const { output, source, publicDirectory } = await archive(files);
  for (const [stage, verify] of [
    ["renderer", () => verifyDesktopRenderer(path.join(source, "dist"), publicDirectory)],
    ["archive", () => verifyPackagedRenderer(output, publicDirectory)],
  ] as const) {
    expect(verify, stage).toThrow(
      new RegExp(`public asset (?:is missing|differs).*${asset.replaceAll(".", "\\.")}`, "u"),
    );
  }
});

it.each([
  [desktopHtml.replace("./assets/index.js", "/assets/index.js"), /must be relative/u],
  [desktopHtml.replace("./assets/index.js", "https://example.com/index.js"), /must be relative/u],
  [desktopHtml.replace("./assets/index.js", "../assets/index.js"), /outside/u],
  [desktopHtml.replace("./assets/index.js", "./assets/missing.js"), /missing/u],
  [desktopHtml.replace("./assets/index.css", "./assets/missing.css"), /missing/u],
  [desktopHtml + '<link href="./assets/missing.js" rel="modulepreload">', /missing/u],
  ['<html><div id="root"></div></html>', /application script/u],
])("rejects a renderer that cannot load from the packaged file URL", async (html, error) => {
  const { output, publicDirectory } = await archive({ ...renderer, "dist/index.html": html });
  expect(() => verifyPackagedRenderer(output, publicDirectory)).toThrow(error);
});

it("rejects an empty application script", async () => {
  const { output, publicDirectory } = await archive({ ...renderer, "dist/assets/index.js": "" });
  expect(() => verifyPackagedRenderer(output, publicDirectory)).toThrow("empty");
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
