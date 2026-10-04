import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
});

it("preserves review choices, undo, and export without crossing review namespaces", async () => {
  const reviewId = "battle-focus-v1";
  vi.resetModules();
  const storageKey = "alchemy-audio-review:v1" + (reviewId ? `:${reviewId}` : "");
  const legacy = JSON.stringify({
    "card:stab": { choice: "silence", reviewed: true, notes: "Old whole-game decision" },
  });
  if (reviewId) localStorage.setItem("alchemy-audio-review:v1", legacy);
  document.documentElement.innerHTML = await readFile(path.resolve("scripts/audio-review/board.html"), "utf8");
  const candidate = {
    assetId: "source-id",
    mediaId: "source-id:0:1",
    originalName: "Sword take",
    path: "combat/take.flac",
    source: "Pack",
    identicalTo: [],
    licenseReference: "Unverified",
    provenanceIds: "source",
    start: 0,
    duration: 1,
    originalDuration: 1,
    note: "Whole take",
    reviewRequired: true,
  };
  const template = {
    group: "Cards",
    familyTitle: "Blades",
    status: "replacement",
    currentFiles: ["old.ogg"],
    currentState: "playing",
    rationale: "Blade identity",
    trigger: "Accepted play",
    note: "No game writes",
    screens: ["battle"],
    evidence: ["card-play.ts"],
    candidates: [candidate],
  };
  const report = {
    reviewId,
    direction: "Tactile fantasy",
    generatedAt: "2026-10-03",
    libraryRoot: "/library",
    mappings: [
      { ...template, id: "card:slash", title: "Slash" },
      {
        ...template,
        id: "card:stab",
        title: "Stab",
        candidates: [candidate, ...[1, 2, 3].map((i) => ({ ...candidate, assetId: `source-alt-${i}` }))],
      },
      { ...template, id: "card:bash", title: "Bash" },
      { ...template, id: "companion:linked", title: "Linked companion", choiceFrom: "card:slash" },
    ],
    initialChoices: { "card:slash": { choice: "current", notes: "Imported note", reviewed: true } },
    inventory: { screens: ["battle"] },
    media: {
      "source-id:0:1": { available: true, duration: 1, gainDb: 0, original: "original.wav", matched: "matched.wav" },
      "current:old.ogg": {
        available: true,
        duration: 1,
        gainDb: 0,
        original: "old-original.wav",
        matched: "old-matched.wav",
      },
    },
    sequences: [],
    catalogCount: 1,
    missingCatalogPaths: [],
    failures: [],
  };
  localStorage.setItem(
    storageKey,
    JSON.stringify({ "card:slash": { choice: "source-id", notes: "Newer browser note", reviewed: true } }),
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => report }));
  const play = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal(
    "Audio",
    class {
      volume = 1;
      onended = null;
      onerror = null;
      play = play;
      pause() {}
      removeAttribute() {}
      load() {}
    },
  );
  let exported = "";
  vi.stubGlobal(
    "Blob",
    class {
      constructor(parts: string[]) {
        exported = parts.join("");
      }
    },
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = vi.fn().mockReturnValue("blob:review");
      static override revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await import("../../scripts/audio-review/board.mjs");
  await vi.waitFor(() => expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:stab"));
  expect(document.querySelectorAll(".mapping")).toHaveLength(1);
  expect(document.getElementById("progress-text")!.textContent).toContain("1 / 3 chosen");
  document.querySelector<HTMLButtonElement>('[aria-label="Listen to Recommended for Stab"]')!.click();
  expect(play).toHaveBeenCalledOnce();
  expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:stab");
  expect(JSON.parse(localStorage.getItem(storageKey)!)["card:stab"]).toBeUndefined();
  const notes = document.querySelector<HTMLTextAreaElement>('[aria-label="Listening notes for Stab"]')!;
  notes.value = "Shorten the tail";
  notes.dispatchEvent(new Event("input"));
  notes.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
  expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:stab");
  document.querySelector<HTMLButtonElement>('[aria-label="Choose Recommended for Stab"]')!.click();
  expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:bash");
  expect(JSON.parse(localStorage.getItem(storageKey)!)["card:stab"]).toEqual({
    choice: "source-id",
    notes: "Shorten the tail",
    reviewed: true,
  });
  document.getElementById("undo")!.click();
  expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:stab");
  expect(JSON.parse(localStorage.getItem(storageKey)!)["card:stab"]).toEqual({
    choice: "",
    notes: "Shorten the tail",
    reviewed: false,
  });
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "5", bubbles: true }));
  expect(JSON.parse(localStorage.getItem(storageKey)!)["card:stab"].choice).toBe("source-alt-3");
  document.getElementById("undo")!.click();
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "1", bubbles: true }));
  expect(document.querySelector(".mapping")?.getAttribute("data-mapping-id")).toBe("card:bash");
  document.querySelector<HTMLButtonElement>('[aria-label="Choose no sound for Bash"]')!.click();
  expect(document.querySelector(".mapping")).toBeNull();
  expect(document.getElementById("progress-text")!.textContent).toContain("3 / 3 chosen");
  const scope = document.getElementById("audition") as HTMLSelectElement;
  scope.value = "chosen";
  scope.dispatchEvent(new Event("change"));
  expect(
    document
      .querySelector<HTMLButtonElement>('[aria-label="Choose Recommended for Slash"]')!
      .getAttribute("aria-pressed"),
  ).toBe("true");
  vi.useFakeTimers();
  document.getElementById("export")!.click();
  const payload = JSON.parse(exported);
  expect(payload.choices).toHaveLength(4);
  expect(payload.choices[3]).toMatchObject({
    mappingId: "companion:linked",
    choice: "source-id",
    notes: "Newer browser note",
    reviewed: true,
  });
  expect(payload.choices[0]).toMatchObject({
    mappingId: "card:slash",
    choice: "source-id",
    reviewed: true,
    notes: "Newer browser note",
    candidate: { assetId: "source-id", path: "combat/take.flac", start: 0, duration: 1 },
    currentFiles: ["old.ogg"],
  });
  expect(payload.choices[1]).toMatchObject({
    mappingId: "card:stab",
    choice: "current",
    notes: "Shorten the tail",
    reviewed: true,
    candidate: null,
  });
  expect(payload.choices[2]).toMatchObject({
    mappingId: "card:bash",
    choice: "silence",
    reviewed: true,
    candidate: null,
  });
  expect(payload.note).toBe("Review choices only. No gameplay changes applied.");
  if (reviewId) expect(localStorage.getItem("alchemy-audio-review:v1")).toBe(legacy);
  vi.runAllTimers();
});
