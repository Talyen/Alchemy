import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMappings,
  parseCatalog,
  validateMappings,
  type ReviewInventory,
  type ReviewManifest,
} from "../../scripts/lib/audio-review.mjs";
import { serveReview } from "../../scripts/lib/audio-review-server.mjs";
import { createReviewPlayer, type ReviewAudio } from "../../scripts/audio-review/playback.mjs";
import { importChoices, restoreChoices, buildChoicesExport } from "../../scripts/audio-review/choices.mjs";

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
      enemyAttackSounds: {},
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
    assignments: { cards: { slash: "blade" }, enemies: { boss: "blade" }, companions: { wolf: "blade" } },
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
    expect(mappings.find((mapping) => mapping.id === "enemy:boss")?.currentState).toBe("silent");
  });
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
        { mappingId: "enemy:boss", choice: "not-a-candidate", reviewed: true },
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
