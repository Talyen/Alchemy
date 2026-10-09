import { expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { injectSaveState } from "../../../../e2e/save-injection";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { savedActivityFixture } from "../../../../fixtures/run-activity";
import { emptyShopState } from "@/lib/active-run-session";
import { cardById } from "@/lib/game-data";

it("seeds a playable current-format activity and preserves explicit visit overrides", async () => {
  let payload: Record<string, unknown> | undefined;
  const page = {
    evaluate: vi.fn(async () => false),
    addInitScript: vi.fn(async (_script: unknown, args: { save: Record<string, unknown> }) => {
      payload = args.save;
    }),
  } as unknown as Page;
  await injectSaveState(page, {});
  let loaded = evaluateSaveCandidates([JSON.stringify(payload)]);
  expect(loaded.status).toEqual({ kind: "ok" });
  expect(loaded.data.activeRun?.activity).toMatchObject({
    kind: "destination",
    data: { destinations: ["Normal Combat", "Campfire", "Card Shop"] },
  });
  const activity = savedActivityFixture("shop", {
    ...emptyShopState(),
    cards: [cardById.slash!],
    purchasedSlotKeys: ["slash-0"],
    refreshesLeft: 1,
  });
  await injectSaveState(page, { activity, gold: 42 });
  loaded = evaluateSaveCandidates([JSON.stringify(payload)]);
  expect(loaded.status).toEqual({ kind: "ok" });
  expect(loaded.data.gold).toBe(42);
  expect(loaded.data.activeRun?.activity).toEqual(activity);
  for (const kind of ["campfire", "transmutation"] as const) {
    const visit = savedActivityFixture(kind);
    await injectSaveState(page, { activity: visit, runDeck: [cardById.slash!] });
    const restored = evaluateSaveCandidates([JSON.stringify(payload)]);
    expect(restored.status).toEqual({ kind: "ok" });
    expect(restored.data.activeRun?.activity).toEqual(visit);
    expect(restored.data.activeRun?.activity).toMatchObject({
      data: { offers: [], result: null, original: null, completed: false },
    });
  }
  for (const key of ["activeCombat", "currentScreen", "interruptedFlow", "shopState"])
    expect(loaded.data.activeRun).not.toHaveProperty(key);
});
