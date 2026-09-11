import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import type { CombatTextEvent } from "@/lib/battle";
import {
  companionLibrary,
  computeTalentEffects,
  getTalentsForKeyword,
  keywordDefinitions,
  type KeywordId,
} from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { patchBattleState, makeTestCard } from "../../../../fixtures/battle";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";

describe("battle-presentation-store", () => {
  beforeEach(resetBattlePresentationAndRun);
  afterEach(() => {
    useBattlePresentationStore.getState().resetPresentation();
    vi.useRealTimers();
  });

  it("initializes with empty presentation state", () => {
    const s = useBattlePresentationStore.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.floatingCombatBursts).toEqual([]);
    expect(s.enemyShaking).toBe(false);
    expect(s.playerShaking).toBe(false);
    expect(s.companionShaking).toBe(false);
    expect(s.playerImpactCue).toBeNull();
    expect(s.enemyImpactCue).toBeNull();
    expect(s.playerAttackToken).toBe(0);
    expect(s.enemyAttackToken).toBe(0);
    expect(s.playerCastToken).toBe(0);
    expect(s.enemyCastToken).toBe(0);
  });

  it("telegraphs cast motion and resets on resetPresentation", () => {
    useBattlePresentationStore.getState().telegraphCast("player");
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(1);
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(0);

    useBattlePresentationStore.getState().telegraphCast("enemy");
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(1);

    useBattlePresentationStore.getState().resetPresentation();
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(0);
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(0);
  });

  it("telegraphAttack maps companion to the player lunge token", () => {
    useBattlePresentationStore.getState().telegraphAttack("companion");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(1);

    useBattlePresentationStore.getState().telegraphAttack("player");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(2);
    expect(useBattlePresentationStore.getState().enemyAttackToken).toBe(0);

    useBattlePresentationStore.getState().telegraphAttack("enemy");
    expect(useBattlePresentationStore.getState().enemyAttackToken).toBe(1);
  });

  it("spawnCardGhost and removeCardGhost round-trip", () => {
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    const id = useBattlePresentationStore.getState().cardGhosts[0]!.id;
    useBattlePresentationStore.getState().removeCardGhost(id);
    expect(useBattlePresentationStore.getState().cardGhosts).toHaveLength(0);
  });

  it("shakeEnemy sets and clears enemyShaking", async () => {
    vi.useFakeTimers();
    useBattlePresentationStore.getState().shakeEnemy();
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("restarts a shake timer so an older hit cannot clear a newer shake", async () => {
    vi.useFakeTimers();
    useBattlePresentationStore.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION - 100);
    useBattlePresentationStore.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(150);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION - 149);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("telegraphAttack bumps the acting combatant's token and maps companion onto player", () => {
    useBattlePresentationStore.getState().telegraphAttack("player");
    useBattlePresentationStore.getState().telegraphAttack("enemy");
    useBattlePresentationStore.getState().telegraphAttack("companion");
    useBattlePresentationStore.getState().telegraphAttack("player");
    const s = useBattlePresentationStore.getState();
    expect(s.playerAttackToken).toBe(3);
    expect(s.enemyAttackToken).toBe(1);
  });

  it("resetPresentation clears VFX state", () => {
    useBattlePresentationStore.setState({
      playerImpactCue: { sequence: 1, colors: keywordDefinitions.burn.shineColors, healthLost: true },
    });
    useBattlePresentationStore.getState().telegraphAttack("player");
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    useBattlePresentationStore.getState().resetPresentation();
    const s = useBattlePresentationStore.getState();
    expect(s.playerImpactCue).toBeNull();
    expect(s.playerAttackToken).toBe(0);
    expect(s.cardGhosts).toEqual([]);
  });

  it("teardownRun clears card ghosts via the presentation bridge", () => {
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    expect(useBattlePresentationStore.getState().cardGhosts).toHaveLength(1);
    teardownRun();
    expect(useBattlePresentationStore.getState().cardGhosts).toEqual([]);
  });

  it("clearBattlePresentationUi resets full presentation VFX", () => {
    useBattlePresentationStore.setState({
      playerImpactCue: { sequence: 1, colors: keywordDefinitions.freeze.shineColors, healthLost: true },
    });
    useBattlePresentationStore.getState().shakeEnemy();
    useBattlePresentationStore.getState().telegraphAttack("enemy");
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    clearBattlePresentationUi();
    const s = useBattlePresentationStore.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.playerImpactCue).toBeNull();
    expect(s.enemyShaking).toBe(false);
    expect(s.playerAttackToken).toBe(0);
    expect(s.enemyAttackToken).toBe(0);
    expect(s.floatingCombatBursts).toEqual([]);
  });

  function activateBattle() {
    vi.useFakeTimers();
    dispatchRunSessionCommand((draft) => {
      setHasActiveBattle(draft, true);
      setScreen(draft, ROUTE_SCREENS.BATTLE);
    });
    return useBattlePresentationStore.getState().showCombatTexts;
  }

  it("consolidates copied events within the action, retaining types, signs, and notices", () => {
    const show = activateBattle();
    const events: CombatTextEvent[] = [
      { target: "player", kind: "status", stat: "block", amount: 2 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "player", kind: "damage", stat: "block", amount: 4 },
      { target: "player", kind: "heal", stat: "health", amount: 3 },
      { target: "player", kind: "status", stat: "block", amount: 3 },
      { target: "player", kind: "heal", stat: "health", amount: 2 },
      { target: "player", kind: "status", stat: "mana", amount: 1 },
      { target: "player", kind: "status", stat: "gold", amount: 3 },
      { target: "player", kind: "status", stat: "gold", amount: 2 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 7 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "notice", stat: "stun", text: "Stunned" },
      { target: "enemy", kind: "status", stat: "burn", amount: 2 },
    ];
    const original = structuredClone(events);
    events.forEach(Object.freeze);
    show(events);
    expect(events).toEqual(original);
    const bursts = useBattlePresentationStore.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(2);
    expect(bursts[0]!.entries.map(({ displayText, stat }) => [stat, displayText])).toEqual([
      ["block", "-4"],
      ["block", "+5"],
      ["health", "+5"],
      ["mana", "+1"],
      ["gold", "+5"],
    ]);
    expect(bursts[1]!.entries.map(({ displayText, stat }) => [stat, displayText])).toEqual([
      ["stun", "Stunned"],
      ["physical", "-12"],
      ["burn", "-2"],
    ]);
  });

  it("starts consecutive actions immediately without merging or renewing older numbers", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    const first = useBattlePresentationStore.getState().floatingCombatBursts[0]!;
    await vi.advanceTimersByTimeAsync(300);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
    const bursts = useBattlePresentationStore.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(2);
    expect(bursts[0]).toBe(first);
    expect(bursts[1]!.id).not.toBe(first.id);
    expect(bursts.map((burst) => burst.entries[0]!.displayText)).toEqual(["-5", "-8"]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS - 300);
    expect(useBattlePresentationStore.getState().floatingCombatBursts.map((burst) => burst.id)).toEqual([
      bursts[1]!.id,
    ]);
    await vi.advanceTimersByTimeAsync(300);
    expect(useBattlePresentationStore.getState().floatingCombatBursts).toEqual([]);
  });

  it("caps bursts per target without dropping types from a dense new action", () => {
    const show = activateBattle();
    show([{ target: "player", kind: "heal", stat: "health", amount: 2 }]);
    for (const amount of [1, 2, 3]) show([{ target: "enemy", kind: "damage", stat: "physical", amount }]);
    show([
      { target: "enemy", kind: "damage", stat: "physical", amount: 4 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 3 },
      { target: "enemy", kind: "damage", stat: "freeze", amount: 2 },
      { target: "enemy", kind: "damage", stat: "holy", amount: 1 },
    ]);
    const bursts = useBattlePresentationStore.getState().floatingCombatBursts;
    expect(bursts.filter((burst) => burst.target === "player")).toHaveLength(1);
    const enemy = bursts.filter((burst) => burst.target === "enemy");
    expect(enemy.map((burst) => burst.entries[0]!.displayText)).toEqual(["-2", "-3", "-4"]);
    expect(enemy[2]!.entries).toHaveLength(4);
  });

  it("selects one strongest Health impact per target, ahead of Block and rewards", () => {
    const show = activateBattle();
    show([
      { target: "enemy", kind: "damage", stat: "physical", amount: 5 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 8 },
      { target: "enemy", kind: "damage", stat: "freeze", amount: 8 },
      { target: "player", kind: "damage", stat: "block", amount: 40 },
      { target: "player", kind: "damage", stat: "physical", amount: 1 },
      { target: "player", kind: "heal", stat: "health", amount: 20 },
    ]);
    const state = useBattlePresentationStore.getState();
    expect(state.enemyImpactCue).toMatchObject({ colors: keywordDefinitions.burn.shineColors, healthLost: true });
    expect(state.playerImpactCue).toMatchObject({ colors: keywordDefinitions.physical.shineColors, healthLost: true });
    show([{ target: "player", kind: "damage", stat: "block", amount: 3 }]);
    expect(useBattlePresentationStore.getState().playerImpactCue).toMatchObject({
      colors: keywordDefinitions.block.shineColors,
      healthLost: false,
    });
  });

  it("does not show feedback outside battle and cancels old lifetimes on clear", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    await vi.advanceTimersByTimeAsync(300);
    useBattlePresentationStore.getState().clearFloatingCombatTexts();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS - 300);
    expect(useBattlePresentationStore.getState().floatingCombatBursts).toHaveLength(1);
    useBattlePresentationStore.getState().resetPresentation();
    dispatchRunSessionCommand((draft) => setScreen(draft, ROUTE_SCREENS.COLLECTION));
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 9 }]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS);
    expect(useBattlePresentationStore.getState().floatingCombatBursts).toEqual([]);
    expect(useBattlePresentationStore.getState().enemyImpactCue).toBeNull();
  });

  it.each(["Holy/Leech", "Nature/Poison", "Dodge/Companion"] as const)(
    "presents a dense %s resolution as complete typed bursts rather than a text queue",
    (build) => {
      const show = activateBattle();
      const keywords: KeywordId[] = ["holy", "leech", "nature", "poison", "mana", "dodge", "companion"];
      const talentEffects = computeTalentEffects(
        Object.fromEntries(
          keywords.map((keyword) => [keyword, getTalentsForKeyword(keyword).map((talent) => talent.id)]),
        ),
      );
      const card = makeTestCard({
        cost: 0,
        effects: [
          {
            kind: "damage",
            damageType: build === "Holy/Leech" ? "holy" : "nature",
            amount: 20,
            lifesteal: build === "Holy/Leech",
          },
        ],
      });
      const initial = patchBattleState({
        hand: [card],
        enemyHealth: 400,
        enemyMaxHealth: 1000,
        playerHealth: 20,
        playerMaxHealth: 100,
        mana: 0,
        maxMana: 10,
        talentEffects,
        enemyStatuses: { poison: 1 },
        activeCompanion: companionLibrary.wolf,
        rng: () => (build === "Dodge/Companion" ? 0 : 0.09),
      });
      const texts: CombatTextEvent[] = [];
      if (build === "Dodge/Companion") {
        applyEnemyAbility(
          initial,
          makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
          texts,
        );
        expect(texts).toContainEqual(expect.objectContaining({ kind: "notice", stat: "dodge", target: "player" }));
      } else {
        const result = playBattleCardResolved(initial, card.id, 0);
        expect(result.state.wishOptions).toBeNull();
        texts.push(...result.combatTexts);
      }
      expect(texts.length).toBeGreaterThan(3);
      show(texts);
      const bursts = useBattlePresentationStore.getState().floatingCombatBursts;
      expect(bursts).toHaveLength(2);
      const entries = bursts.flatMap((burst) => burst.entries);
      expect(entries).toHaveLength(texts.length);
      expect(entries).toEqual(expect.arrayContaining(texts.map((event) => expect.objectContaining(event))));
    },
  );

  it("keeps a readable lifetime when fast animations are enabled", async () => {
    const show = activateBattle();
    localStorage.setItem("alchemy-disable-animations", "true");
    try {
      show([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
      expect(useBattlePresentationStore.getState().floatingCombatBursts[0]!.lifetimeMs).toBe(400);
      await vi.advanceTimersByTimeAsync(399);
      expect(useBattlePresentationStore.getState().floatingCombatBursts).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(useBattlePresentationStore.getState().floatingCombatBursts).toEqual([]);
    } finally {
      localStorage.removeItem("alchemy-disable-animations");
    }
  });
});
