import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMappings,
  loadGameInventory,
  parseCatalog,
  readLibraryCatalog,
  validateMappings,
  type ReviewInventory,
  type ReviewManifest,
} from "../../scripts/audio-review/core.mjs";
import { serveReview } from "../../scripts/audio-review/server.mjs";
import { createReviewPlayer, type ReviewAudio } from "../../scripts/audio-review/playback.mjs";
import { importChoices, restoreChoices, buildChoicesExport } from "../../scripts/audio-review/choices.mjs";
import { prepareReviewMedia } from "../../scripts/audio-review/media.mjs";

it("shares identical excerpts across source IDs and fades their edges without silencing a late start", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-audio-excerpt-"));
  try {
    const samples = 48_000;
    const wave = Buffer.alloc(44 + samples * 2);
    wave.write("RIFF", 0);
    wave.writeUInt32LE(wave.length - 8, 4);
    wave.write("WAVEfmt ", 8);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(1, 22);
    wave.writeUInt32LE(48_000, 24);
    wave.writeUInt32LE(96_000, 28);
    wave.writeUInt16LE(2, 32);
    wave.writeUInt16LE(16, 34);
    wave.write("data", 36);
    wave.writeUInt32LE(samples * 2, 40);
    for (let sample = 0; sample < samples; sample++) wave.writeInt16LE(8192, 44 + sample * 2);
    const comment = Buffer.from("recording provenance ".repeat(64) + "\0");
    const info = Buffer.alloc(20 + comment.length + (comment.length % 2));
    info.write("LIST");
    info.writeUInt32LE(info.length - 8, 4);
    info.write("INFOICMT", 8);
    info.writeUInt32LE(comment.length, 16);
    comment.copy(info, 20);
    const taggedWave = Buffer.concat([wave.subarray(0, 36), info, wave.subarray(36)]);
    taggedWave.writeUInt32LE(taggedWave.length - 8, 4);
    await writeFile(path.join(root, "constant.wav"), taggedWave);
    await writeFile(path.join(root, "renamed.wav"), taggedWave);
    const output = path.join(root, "previews");
    const options = {
      root,
      libraryRoot: root,
      output,
      mappings: [
        {
          currentFiles: [],
          candidates: [
            { assetId: "constant", path: "constant.wav", start: 0.25, duration: 0.1, note: "fixture" },
            { assetId: "renamed", path: "renamed.wav", start: 0.25, duration: 0.1, note: "same recording" },
          ],
        },
      ],
    };
    const result = await prepareReviewMedia(options);
    expect(result.failures).toEqual([]);
    expect(result.media["renamed:0.25:0.1"]).toMatchObject({
      id: "renamed:0.25:0.1",
      sourcePath: path.join(root, "renamed.wav"),
      available: true,
      duration: 0.1,
      original: result.media["constant:0.25:0.1"].original,
      matched: result.media["constant:0.25:0.1"].matched,
    });
    const preview = await readFile(path.join(output, result.media["constant:0.25:0.1"].original!));
    let offset = 12;
    while (preview.toString("ascii", offset, offset + 4) !== "data") {
      const size = preview.readUInt32LE(offset + 4);
      offset += 8 + size + (size % 2);
    }
    const pcm = preview.subarray(offset + 8, offset + 8 + preview.readUInt32LE(offset + 4));
    expect(pcm.length).toBe(4800 * 2 * 2);
    expect(pcm.readInt16LE(0)).toBe(0);
    expect(pcm.readInt16LE(2400 * 4)).toBeGreaterThan(5000);
    expect(Math.abs(pcm.readInt16LE(pcm.length - 2))).toBeLessThan(100);
    const cacheName = (await readdir(path.join(output, "media"))).find((file) => file.endsWith(".json"))!;
    const cachePath = path.join(output, "media", cacheName);
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    cached.duration = (preview.length - 78) / (48000 * 2 * 2);
    await writeFile(cachePath, JSON.stringify(cached));
    expect(await prepareReviewMedia(options)).toEqual(result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function fixture() {
  const inventory: ReviewInventory = {
    cards: [{ id: "slash", title: "Slash", keywords: ["physical"] }],
    enemies: [{ id: "boss", title: "Boss", enemyType: "boss", abilityIds: ["slash"] }],
    companions: [{ id: "wolf", title: "Wolf" }],
    screens: ["battle"],
    destinations: ["Combat"],
    keywords: ["physical"],
    registry: {
      cardSounds: { slash: ["slash.ogg"], "wolf-companion": ["wolf.ogg"] },
      battleEventSounds: { hit: "hit.ogg" },
      uiSounds: {},
      stingerSounds: {},
    },
  };
  const manifest: ReviewManifest = {
    schemaVersion: 1,
    direction: "Tactile fantasy",
    libraryRootDefault: "/library",
    reviewPolicy: "Unheard",
    families: [
      {
        id: "blade",
        title: "Blade",
        rationale: "Material match",
        candidates: [{ assetId: "asset", path: "combat/slash.flac", start: 0, duration: 1, note: "Whole take" }],
      },
    ],
    actions: [
      {
        id: "hit",
        title: "Impact",
        group: "Battle",
        family: "blade",
        screens: ["battle"],
        trigger: "Resolved hit",
        current: "battleEventSounds.hit",
        currentState: "registered-unused",
        note: "Unwired",
        priority: "P1",
        evidence: ["controller.ts"],
      },
    ],
    assignments: { cards: { slash: "blade" }, companions: { wolf: "blade" } },
    destinationCoverage: ["Combat"],
    keywordCoverage: { physical: ["hit"] },
    sequences: [],
  };
  const catalog = parseCatalog(
    'asset_id,path,original_sha256,stored_sha256,original_names,source_libraries,license_reference,duration_seconds,review_required,provenance_ids\r\nasset,combat/slash.flac,raw-hash,stored-hash,"Sword, attack ""one""\nsecond line",Pack,unverified,1,False,source\r\n',
  );
  return { inventory, manifest, catalog };
}

describe("whole-game audio review coverage", () => {
  it("rejects omitted content, omitted cue registrations, and relocated catalog candidates rather than publishing incomplete coverage", () => {
    const { inventory, manifest, catalog } = fixture();
    expect(() => validateMappings(manifest, inventory, catalog)).not.toThrow();
    inventory.cards.push({ id: "new-card", title: "New", keywords: [] });
    expect(() => validateMappings(manifest, inventory, catalog)).toThrow(/cards coverage: missing \[new-card\]/);
    inventory.cards.pop();
    inventory.registry.uiSounds.newAction = "new.ogg";
    expect(() => validateMappings(manifest, inventory, catalog)).toThrow(/uiSounds coverage/);
    delete inventory.registry.uiSounds.newAction;
    catalog[0].path = "relocated.flac";
    expect(() => validateMappings(manifest, inventory, catalog)).toThrow(/Missing or relocated candidate/);
  });

  it("identifies an existing recording through its authored source hash and distinguishes unused references from audible gameplay", () => {
    const { inventory, manifest, catalog } = fixture();
    const mappings = buildMappings(manifest, inventory, catalog, {
      "slash.ogg": { hashes: ["encoded-hash", "raw-hash"] },
    });
    const slash = mappings.find((mapping) => mapping.id === "card:slash")!;
    expect(slash.status).toBe("retained");
    expect(slash.candidates[0].identicalTo).toEqual(["slash.ogg"]);
    expect(slash.candidates[0].originalName).toBe('Sword, attack "one"\nsecond line');
    expect(mappings.find((mapping) => mapping.id === "hit")?.status).toBe("addition");
    expect(mappings.some((mapping) => mapping.id.startsWith("enemy:"))).toBe(false);
  });
});

it("reconstructs missing catalog metadata from preserved masters, and rejects false identities", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "alchemy-audio-catalog-"));
  try {
    await mkdir(path.join(root, "magic"));
    const relative = "magic/purge__example_pack__abc123.flac";
    await writeFile(path.join(root, relative), "master bytes");
    const candidate = { assetId: "abc123", path: relative, start: 0, duration: 1, note: "Unheard" };
    const result = await readLibraryCatalog(root, [candidate, candidate]);
    expect(result.metadataSource).toBe("filenames-and-file-hashes");
    expect(result.catalog).toHaveLength(1);
    expect(result.catalog[0]).toMatchObject({
      asset_id: "abc123",
      path: relative,
      original_names: "purge",
      source_libraries: "example pack",
      original_sha256: "",
      review_required: "True",
    });
    expect(result.catalog[0].stored_sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(readLibraryCatalog(root, [{ ...candidate, assetId: "false-id" }])).rejects.toThrow(
      /identity mismatch/,
    );
    await expect(readLibraryCatalog(root, [{ ...candidate, path: "../master.flac" }])).rejects.toThrow(
      /escapes its owner/,
    );
    await mkdir(path.join(root, "reference"));
    await writeFile(path.join(root, "reference/catalog.csv"), "malformed");
    await expect(readLibraryCatalog(root, [candidate])).rejects.toThrow(/Invalid library catalog/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

describe("private preview serving", () => {
  it("serves seekable prepared media while rejecting arbitrary paths, writes, invalid ranges and symlink escapes", async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "alchemy-audio-review-"));
    const directory = path.join(temporary, "board");
    await mkdir(path.join(directory, "media"), { recursive: true });
    await writeFile(path.join(directory, "index.html"), "board");
    await writeFile(path.join(directory, "choices.mjs"), "export {};");
    await writeFile(path.join(directory, "media/clip.wav"), "0123456789");
    await writeFile(path.join(temporary, "private.txt"), "private");
    await symlink(path.join(temporary, "private.txt"), path.join(directory, "report.md"));
    const server = await serveReview(
      directory,
      { media: { clip: { available: true, original: "media/clip.wav", matched: "media/clip.wav" } } },
      0,
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing server address");
    const url = `http://127.0.0.1:${address.port}`;
    try {
      const range = await fetch(`${url}/media/clip.wav`, { headers: { Range: "bytes=2-5" } });
      expect(range.status).toBe(206);
      expect(range.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(await range.text()).toBe("2345");
      expect((await fetch(`${url}/media/clip.wav`, { headers: { Range: "bytes=99-" } })).status).toBe(416);
      expect((await fetch(`${url}/private.txt`)).status).toBe(404);
      expect((await fetch(`${url}/report.md`)).status).toBe(404);
      expect((await fetch(`${url}/`, { method: "POST" })).status).toBe(405);
      expect(await (await fetch(`${url}/`)).text()).toBe("board");
      const choicesModule = await fetch(`${url}/choices.mjs`);
      expect(choicesModule.headers.get("content-type")).toContain("text/javascript");
      expect(await choicesModule.text()).toBe("export {};");
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await rm(temporary, { recursive: true, force: true });
    }
  });
});

it("imports matching decisions without trusting attached candidate metadata and allows newer browser decisions to win", () => {
  const { inventory, manifest, catalog } = fixture();
  const mappings = buildMappings(manifest, inventory, catalog, {});
  const imported = importChoices(
    {
      schemaVersion: 1,
      note: "Untrusted attached text",
      choices: [
        {
          mappingId: "card:slash",
          choice: "asset",
          reviewed: true,
          notes: "Good",
          candidate: { path: "wrong-source.wav" },
        },
        { mappingId: "companion:wolf", choice: "not-a-candidate", reviewed: true },
      ],
    },
    mappings,
  );
  expect(imported.skipped).toBe(1);
  expect(imported.choices).toEqual({ "card:slash": { choice: "asset", reviewed: true, notes: "Good" } });
  const originalExport = buildChoicesExport({ mappings, direction: "Fantasy", generatedAt: "now" }, imported.choices);
  expect(originalExport.choices[0].candidate).toMatchObject({ assetId: "asset", path: "combat/slash.flac" });
  const browser = restoreChoices(mappings, { "card:slash": { choice: "silence", reviewed: true, notes: "Newer" } });
  const merged = buildChoicesExport(
    { mappings, direction: "Fantasy", generatedAt: "now" },
    { ...imported.choices, ...browser },
  );
  expect(merged.choices[0]).toMatchObject({ choice: "silence", reviewed: true, notes: "Newer", candidate: null });
});

afterEach(() => vi.useRealTimers());

describe("audition playback lifetime", () => {
  it("a new audition cancels queued sequence repetitions and disposes old audio even when its play rejection arrives late", async () => {
    vi.useFakeTimers();
    const audio: Array<ReviewAudio & { pause: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> }> = [];
    let rejectOld: ((reason: Error) => void) | undefined;
    const status = vi.fn();
    const player = createReviewPlayer({
      createAudio: () => {
        const item = {
          volume: 1,
          onended: null,
          onerror: null,
          play: () =>
            new Promise<void>((_resolve, reject) => {
              rejectOld = reject;
            }),
          pause: vi.fn(),
          load: vi.fn(),
          removeAttribute: vi.fn(),
        };
        audio.push(item);
        return item;
      },
      schedule: (callback, ms) => setTimeout(callback, ms),
      cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      onStatus: status,
      readVolume: () => 0.4,
    });
    const pending = player.sequence(
      [
        { at: 0, duration: 1, url: "old.wav", title: "Old" },
        { at: 2, duration: 1, url: "queued.wav", title: "Queued" },
      ],
      3,
    );
    await vi.advanceTimersByTimeAsync(1);
    const reject = rejectOld!;
    expect(audio).toHaveLength(1);
    player.play("new.wav", "New");
    reject(new Error("late failure"));
    await pending;
    await vi.advanceTimersByTimeAsync(10000);
    expect(audio).toHaveLength(2);
    expect(audio[0].pause).toHaveBeenCalledOnce();
    expect(audio[0].load).toHaveBeenCalledOnce();
    expect(audio[1].pause).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("Playing: New");
    player.stop();
    expect(audio[1].pause).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("a shared card/companion selection overrides independent choices and survives import and export", () => {
  const { inventory, manifest, catalog } = fixture();
  manifest.sharedChoices = { "companion:wolf": "card:slash" };
  const mappings = buildMappings(manifest, inventory, catalog, {});
  const records = {
    "card:slash": { choice: "asset", notes: "Use this take", reviewed: true },
    "companion:wolf": { choice: "silence", notes: "Earlier independent choice", reviewed: true },
  };
  const choices = restoreChoices(mappings, records);
  expect(choices["companion:wolf"]).toEqual(choices["card:slash"]);
  const exported = buildChoicesExport({ mappings, direction: "Fantasy", generatedAt: "now" }, records);
  expect(exported.choices.find((choice) => choice.mappingId === "companion:wolf")).toMatchObject({
    choice: "asset",
    candidate: { assetId: "asset" },
    notes: "Use this take",
  });
  const imported = importChoices(
    { schemaVersion: 1, choices: [{ mappingId: "card:slash", ...records["card:slash"] }] },
    mappings,
  );
  expect(imported.skipped).toBe(0);
  expect(imported.choices["companion:wolf"]).toEqual(imported.choices["card:slash"]);
  expect(restoreChoices(mappings, { "companion:wolf": records["companion:wolf"] })).toEqual({});
  manifest.sharedChoices["card:slash"] = "companion:wolf";
  expect(() => validateMappings(manifest, inventory, catalog)).toThrow(/Invalid shared sound choice/);
});

it("keeps the current Sound desk manifest aligned with live catalogs and registrations", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../Docs/design/audio-review/mappings.json", import.meta.url), "utf8"),
  ) as ReviewManifest;
  const catalog = [
    ...new Map(
      manifest.families
        .flatMap((family) => family.candidates)
        .map((candidate) => [candidate.assetId, { asset_id: candidate.assetId, path: candidate.path }]),
    ).values(),
  ];
  const inventory = await loadGameInventory();
  expect(() => validateMappings(manifest, inventory, catalog)).not.toThrow();
  const focusedIds = new Set(manifest.battleFocus);
  for (const id of focusedIds) {
    expect(id.startsWith("enemy:")).toBe(false);
    const source = manifest.sharedChoices?.[id];
    if (source) expect(focusedIds.has(source)).toBe(true);
  }
});
