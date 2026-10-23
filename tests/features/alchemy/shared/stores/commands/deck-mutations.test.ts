import { describe, expect, it } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/session/gameplay-command";
import { readSessionSettings } from "@/features/alchemy/shared/stores/session/session-settings";
import type { GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { profilePersistenceCodec } from "@/features/alchemy/shared/stores/persistence/profile-codec";
import { SaveDataSchema } from "@/lib/validation";
import { battleSnapshot, defaultBattleState } from "@/lib/battle";
import type { GearInstance } from "@/lib/gear";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
  grantGearToRunWithRecord,
  grantTrinketToRunWithRecord,
} from "@/features/alchemy/shared/stores/commands/deck-mutations";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { makeTestCard } from "../../../../../fixtures/cards";
import { makeGearInstance } from "../../../../../fixtures/gear";

function initializeRogue(session: GameSession) {
  dispatchGameplayCommand(
    (draft) => {
      draft.run.activeRun.characterId = "rogue";
      draft.session.activity = { kind: "destination" };
      return acceptCommand();
    },
    undefined,
    session,
  );
}

function acquire(session: GameSession, item: GearInstance) {
  dispatchRunSessionCommand((draft) => acceptCommand(grantGearToRunWithRecord(draft, item)), undefined, session);
}

function acquireTrinket(session: GameSession, id: string) {
  dispatchRunSessionCommand((draft) => acceptCommand(grantTrinketToRunWithRecord(draft, id)), undefined, session);
}

describe("run acquisition with discovery", () => {
  it("appends cards to the deck and records each card id once", async () => {
    await using session = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });
    const card = makeTestCard();

    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendCardToRunWithDiscovery(transaction, card)),
      undefined,
      session,
    );
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendCardToRunWithDiscovery(transaction, card)),
      undefined,
      session,
    );

    const state = readGameplayState(session);
    expect(state.run.activeRun.runDeck.slice(-2)).toEqual([card, card]);
    expect(state.profile.discoveredCardIds).toEqual([card.id]);
  });

  it("appends a boon once and records its trinket id", async () => {
    await using session = createGameSession({ runtimeInputs: { generateRunSeed: () => 7 } });

    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendBoonToRunWithDiscovery(transaction, "bone-charm")),
      undefined,
      session,
    );
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(appendBoonToRunWithDiscovery(transaction, "bone-charm")),
      undefined,
      session,
    );

    const state = readGameplayState(session);
    expect(state.run.activeRun.runBoons).toEqual(["bone-charm"]);
    expect(state.profile.discoveredTrinketIds).toContain("bone-charm");
    expect(state.gear.ownedTrinketIds).toEqual([]);
    expect(state.gear.equippedTrinkets.knight).toBeNull();
  });

  it("collects and auto-equips on the receiving hero in the same commit, including live Health", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    const before = readGameplayState(session);
    const armor = makeGearInstance("leather-armor-basic", "health-armor", [{ id: "max-health", value: 7 }]);
    acquire(session, armor);
    const state = readGameplayState(session);
    expect(state.revision).toBe(before.revision + 1);
    expect(state.gear.inventories.rogue).toEqual([armor]);
    expect(state.gear.loadouts.rogue.body).toBe(armor.instanceId);
    expect(state.gear.loadouts.knight.body).toBeNull();
    expect(state.run.activeRun.runMaxHealth).toBe(before.run.activeRun.runMaxHealth + 7);
    expect(state.run.activeRun.runObtainedItems).toContainEqual({ kind: "gear", instance: armor });
    expect(before.gear.inventories.rogue).toEqual([]);
  });

  it("fills both legal hand and accessory slots without replacing any equipped item", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    for (const [definition, prefix] of [
      ["dagger-basic", "dagger"],
      ["ruby-ring-basic", "ring"],
    ] as const) {
      for (let i = 1; i <= 3; i++) acquire(session, makeGearInstance(definition, `${prefix}-${i}`));
    }
    expect(readGameplayState(session).gear.loadouts.rogue).toEqual({
      "main-hand": "dagger-1",
      "off-hand": "dagger-2",
      body: null,
      "left-accessory": "ring-1",
      "right-accessory": "ring-2",
    });
    expect(readGameplayState(session).gear.inventories.rogue).toHaveLength(6);
  });

  it.each([
    ["leather-buckler-basic", "greatsword-basic", "off-hand"],
    ["greatsword-basic", "dagger-basic", "main-hand"],
    ["leather-buckler-basic", "longbow-basic", "off-hand"],
  ] as const)("keeps %s equipped instead of displacing it with new %s", async (existingId, incomingId, slot) => {
    await using session = createGameSession();
    initializeRogue(session);
    acquire(session, makeGearInstance(existingId, "existing"));
    const before = readGameplayState(session).gear.loadouts.rogue;
    expect(before[slot]).toBe("existing");
    acquire(session, makeGearInstance(incomingId, "incoming"));
    expect(readGameplayState(session).gear.loadouts.rogue).toEqual(before);
    expect(readGameplayState(session).gear.inventories.rogue).toHaveLength(2);
  });

  it("keeps a Quiver in inventory without a bow, and equips a newly acquired Quiver with a bow", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    acquire(session, makeGearInstance("quiver-basic", "early-quiver"));
    expect(readGameplayState(session).gear.loadouts.rogue["off-hand"]).toBeNull();
    acquire(session, makeGearInstance("longbow-basic", "bow"));
    acquire(session, makeGearInstance("quiver-basic", "new-quiver"));
    expect(readGameplayState(session).gear.loadouts.rogue).toMatchObject({
      "main-hand": "bow",
      "off-hand": "new-quiver",
    });
  });

  it("honors disabled Auto Equip for Gear and permanent Trinkets without affecting collection", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    readSessionSettings(session).setAutoEquip(false);
    acquire(session, makeGearInstance("vipers-courtesy", "unique-dagger"));
    acquireTrinket(session, "bone-charm");
    const state = readGameplayState(session);
    expect(state.gear.loadouts.rogue["main-hand"]).toBeNull();
    expect(state.gear.equippedTrinkets.rogue).toBeNull();
    expect(state.gear.inventories.rogue).toHaveLength(1);
    expect(state.gear.ownedTrinketIds).toEqual(["bone-charm"]);
    expect(state.profile.discoveredUniqueIds).toContain("vipers-courtesy");
  });

  it("auto-equips Uniques and the first permanent Trinket without replacing the Trinket", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    acquire(session, makeGearInstance("vipers-courtesy", "unique-dagger"));
    acquireTrinket(session, "bone-charm");
    acquireTrinket(session, "tattered-pages");
    const state = readGameplayState(session);
    expect(state.gear.loadouts.rogue["main-hand"]).toBe("unique-dagger");
    expect(state.gear.equippedTrinkets.rogue).toBe("bone-charm");
    expect(state.gear.ownedTrinketIds).toEqual(["bone-charm", "tattered-pages"]);
  });

  it("collects during combat without changing reserved equipment or queuing an equip", async () => {
    await using session = createGameSession();
    initializeRogue(session);
    dispatchGameplayCommand(
      (draft) => {
        draft.session.activity = { kind: "battle", data: { battleState: battleSnapshot(defaultBattleState()) } };
        return acceptCommand();
      },
      undefined,
      session,
    );
    acquire(session, makeGearInstance("dagger-basic", "combat-reward"));
    acquireTrinket(session, "bone-charm");
    expect(readGameplayState(session).gear.loadouts.rogue["main-hand"]).toBeNull();
    expect(readGameplayState(session).gear.equippedTrinkets.rogue).toBeNull();
    initializeRogue(session);
    expect(readGameplayState(session).gear.loadouts.rogue["main-hand"]).toBeNull();
  });

  it("introduces Armory after acquisition even if it was visited empty, and saves acknowledgement", async () => {
    await using session = createGameSession();
    const visit = () =>
      dispatchRunSessionCommand((draft) => acceptCommand(setScreen(draft, "armory")), undefined, session);
    visit();
    expect(readGameplayState(session).profile.hasSeenArmory).toBe(false);
    acquireTrinket(session, "bone-charm");
    expect(readGameplayState(session).profile.hasSeenArmory).toBe(false);
    visit();
    const saved = SaveDataSchema.parse(profilePersistenceCodec.encode(session));
    expect(saved.hasSeenArmory).toBe(true);
    await using resumed = createGameSession();
    dispatchGameplayCommand(
      (draft) => acceptCommand(profilePersistenceCodec.hydrate(saved, draft)),
      undefined,
      resumed,
    );
    expect(readGameplayState(resumed).profile.hasSeenArmory).toBe(true);
    expect(SaveDataSchema.parse({}).autoEquip).toBe(true);
    expect(SaveDataSchema.parse({}).hasSeenArmory).toBe(false);
  });
});
