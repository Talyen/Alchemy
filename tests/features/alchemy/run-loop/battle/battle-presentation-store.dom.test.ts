import { setBattleActiveForTest as setHasActiveBattle } from "../../../../helpers/run-domain-store-test";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION_MS } from "@/lib/game-constants";
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
import { battlePresentation } from "@/app/battle-presentation";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { defaultGameSession } from "@/app/application-session";

describe("battle-presentation-store", () => {
  beforeEach(resetBattlePresentationAndRun);
  afterEach(() => {
    battlePresentation.getState().resetPresentation();
    vi.useRealTimers();
  });

  it("telegraphs cast motion and resets on resetPresentation", () => {
    battlePresentation.getState().telegraphCast("player");
    expect(battlePresentation.getState().playerCastToken).toBe(1);
    expect(battlePresentation.getState().enemyCastToken).toBe(0);

    battlePresentation.getState().telegraphCast("enemy");
    expect(battlePresentation.getState().enemyCastToken).toBe(1);

    battlePresentation.getState().resetPresentation();
    expect(battlePresentation.getState().playerCastToken).toBe(0);
    expect(battlePresentation.getState().enemyCastToken).toBe(0);
  });

  it("spawnCardGhost and removeCardGhost round-trip", () => {
    battlePresentation.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    const id = battlePresentation.getState().cardGhosts[0]!.id;
    battlePresentation.getState().removeCardGhost(id);
    expect(battlePresentation.getState().cardGhosts).toHaveLength(0);
  });

  it("caps overlapping ghosts, shedding the oldest", () => {
    for (let i = 0; i < 8; i += 1) {
      battlePresentation.getState().spawnCardGhost({
        art: `test-${i}.webp`,
        rect: { x: 0, y: 0, width: 10, height: 10 },
        rotation: 0,
        delay: 0,
        variant: "activate",
      });
    }
    const ghosts = battlePresentation.getState().cardGhosts;
    expect(ghosts).toHaveLength(6);
    expect(ghosts[0]?.art).toBe("test-2.webp");
  });

  it("shakeEnemy sets and clears enemyShaking", async () => {
    vi.useFakeTimers();
    battlePresentation.getState().shakeEnemy();
    expect(battlePresentation.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION_MS);
    expect(battlePresentation.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("restarts a shake timer so an older hit cannot clear a newer shake", async () => {
    vi.useFakeTimers();
    battlePresentation.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION_MS - 100);
    battlePresentation.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(150);
    expect(battlePresentation.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION_MS - 149);
    expect(battlePresentation.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("telegraphAttack bumps the acting combatant's token and maps companion onto player", () => {
    battlePresentation.getState().telegraphAttack("player");
    battlePresentation.getState().telegraphAttack("enemy");
    battlePresentation.getState().telegraphAttack("companion");
    battlePresentation.getState().telegraphAttack("player");
    const s = battlePresentation.getState();
    expect(s.playerAttackToken).toBe(3);
    expect(s.enemyAttackToken).toBe(1);
  });

  it("resetPresentation clears VFX state", () => {
    battlePresentation.setState({
      playerImpactCue: { sequence: 1, colors: keywordDefinitions.burn.shineColors, healthLost: true },
    });
    battlePresentation.getState().telegraphAttack("player");
    battlePresentation.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    battlePresentation.getState().resetPresentation();
    const s = battlePresentation.getState();
    expect(s.playerImpactCue).toBeNull();
    expect(s.playerAttackToken).toBe(0);
    expect(s.cardGhosts).toEqual([]);
  });

  it("teardownRun clears card ghosts via the presentation bridge", () => {
    battlePresentation.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    expect(battlePresentation.getState().cardGhosts).toHaveLength(1);
    teardownRun(defaultGameSession);
    expect(battlePresentation.getState().cardGhosts).toEqual([]);
  });

  it("clearBattlePresentationUi resets full presentation VFX", () => {
    battlePresentation.setState({
      playerImpactCue: { sequence: 1, colors: keywordDefinitions.freeze.shineColors, healthLost: true },
    });
    battlePresentation.getState().shakeEnemy();
    battlePresentation.getState().telegraphAttack("enemy");
    battlePresentation.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    clearBattlePresentationUi(defaultGameSession);
    const s = battlePresentation.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.playerImpactCue).toBeNull();
    expect(s.enemyShaking).toBe(false);
    expect(s.playerAttackToken).toBe(0);
    expect(s.enemyAttackToken).toBe(0);
    expect(s.floatingCombatBursts).toEqual([]);
  });

  function activateBattle() {
    vi.useFakeTimers();
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveBattle(draft, true);
        setScreen(draft, ROUTE_SCREENS.BATTLE);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    return battlePresentation.getState().showCombatTexts;
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
    const bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(2);
    expect(bursts[0]!.entries.map(({ displayText, stat }) => [stat, displayText])).toEqual([
      ["block", "-4"],
      ["block", "+5"],
      ["health", "+5"],
      ["mana", "+1"],
      ["gold", "+5"],
    ]);
    expect(bursts[1]!.entries.map(({ displayText, stat }) => [stat, displayText])).toEqual([
      ["stun", ""],
      ["physical", "-12"],
      ["burn", "-2"],
    ]);
  });

  it.each([0, 100, 249, 250, 300])("merges only during the original 250 ms window (%i)", async (elapsed) => {
    const show = activateBattle();
    const input: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 3 }];
    Object.freeze(input[0]);
    show(input);
    const original = battlePresentation.getState().floatingCombatBursts[0]!;
    const cue = battlePresentation.getState().enemyImpactCue!.sequence;
    await vi.advanceTimersByTimeAsync(elapsed);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 4 }]);
    const bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(elapsed < 250 ? 1 : 2);
    expect(bursts[0]!.id).toBe(original.id);
    expect(bursts[0]!.firstShownAt).toBe(original.firstShownAt);
    expect(bursts[0]!.entries[0]!.displayText).toBe(elapsed < 250 ? "-7" : "-3");
    expect(input[0]).toMatchObject({ amount: 3 });
    expect(original.entries[0]).toMatchObject({ amount: 3 });
    expect(battlePresentation.getState().enemyImpactCue!.sequence).toBeGreaterThan(cue);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS - elapsed);
    expect(battlePresentation.getState().floatingCombatBursts.some((burst) => burst.id === original.id)).toBe(false);
  });

  it("merges partial actions without mixing types, recipients, or resource directions", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 3 }]);
    await vi.advanceTimersByTimeAsync(100);
    show([
      { target: "enemy", kind: "damage", stat: "physical", amount: 4 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "player", kind: "damage", stat: "physical", amount: 1 },
      { target: "player", kind: "damage", stat: "block", amount: 2 },
      { target: "player", kind: "status", stat: "block", amount: 3 },
    ]);
    const bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(3);
    expect(bursts[0]!.entries[0]!.displayText).toBe("-7");
    expect(bursts.flatMap((burst) => burst.entries.map((entry) => entry.displayText))).toEqual([
      "-7",
      "-1",
      "-2",
      "+3",
      "-2",
    ]);
  });

  it("does not sum preparations or overflow reserved digit width", async () => {
    const show = activateBattle();
    const ready: CombatTextEvent = {
      target: "player",
      kind: "notice",
      stat: "nextHitCrit",
      text: "",
      signal: "prepared",
    };
    show([ready, { target: "enemy", kind: "damage", stat: "physical", amount: 9 }]);
    await vi.advanceTimersByTimeAsync(100);
    show([ready, { target: "enemy", kind: "damage", stat: "physical", amount: 90 }]);
    let bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts.filter((burst) => burst.target === "player")).toHaveLength(1);
    expect(bursts.find((burst) => burst.target === "enemy")!.entries[0]!.displayText).toBe("-99");
    await vi.advanceTimersByTimeAsync(100);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 1 }]);
    bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts.filter((burst) => burst.target === "enemy").map((burst) => burst.entries[0]!.displayText)).toEqual([
      "-99",
      "-1",
    ]);
  });

  it("keeps every incoming type when a partial merge would evict its recipient", () => {
    const show = activateBattle();
    for (const stat of ["physical", "burn", "poison"] as const) {
      show([{ target: "enemy", kind: "damage", stat, amount: 3 }]);
    }
    const original = battlePresentation.getState().floatingCombatBursts[0]!.id;
    show([
      { target: "enemy", kind: "damage", stat: "physical", amount: 4 },
      { target: "enemy", kind: "damage", stat: "holy", amount: 2 },
    ]);
    const bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(3);
    expect(bursts.some((burst) => burst.id === original)).toBe(false);
    expect(bursts.at(-1)!.entries.map((entry) => [entry.stat, entry.displayText])).toEqual([
      ["physical", "-4"],
      ["holy", "-2"],
    ]);
  });

  it("does not resurrect an evicted entry or merge after the original window closes", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 1 }]);
    const first = battlePresentation.getState().floatingCombatBursts[0]!.id;
    for (const stat of ["burn", "poison", "holy"] as const)
      show([{ target: "enemy", kind: "damage", stat, amount: 1 }]);
    expect(battlePresentation.getState().floatingCombatBursts.some((burst) => burst.id === first)).toBe(false);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 2 }]);
    const newest = battlePresentation.getState().floatingCombatBursts.at(-1)!;
    expect(newest.entries[0]!.displayText).toBe("-2");
    await vi.advanceTimersByTimeAsync(200);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 3 }]);
    await vi.advanceTimersByTimeAsync(51);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 4 }]);
    expect(battlePresentation.getState().floatingCombatBursts.at(-1)!.entries[0]!.displayText).toBe("-4");
  });

  it("starts consecutive actions immediately without merging or renewing older numbers", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    const first = battlePresentation.getState().floatingCombatBursts[0]!;
    await vi.advanceTimersByTimeAsync(300);
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
    const bursts = battlePresentation.getState().floatingCombatBursts;
    expect(bursts).toHaveLength(2);
    expect(bursts[0]).toBe(first);
    expect(bursts[1]!.id).not.toBe(first.id);
    expect(bursts.map((burst) => burst.entries[0]!.displayText)).toEqual(["-5", "-8"]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS - 300);
    expect(battlePresentation.getState().floatingCombatBursts.map((burst) => burst.id)).toEqual([bursts[1]!.id]);
    await vi.advanceTimersByTimeAsync(300);
    expect(battlePresentation.getState().floatingCombatBursts).toEqual([]);
  });

  it("caps bursts per target without dropping types from a dense new action", async () => {
    const show = activateBattle();
    show([{ target: "player", kind: "heal", stat: "health", amount: 2 }]);
    for (const amount of [1, 2, 3]) {
      show([{ target: "enemy", kind: "damage", stat: "physical", amount }]);
      await vi.advanceTimersByTimeAsync(250);
    }
    show([
      { target: "enemy", kind: "damage", stat: "physical", amount: 4 },
      { target: "enemy", kind: "damage", stat: "burn", amount: 3 },
      { target: "enemy", kind: "damage", stat: "freeze", amount: 2 },
      { target: "enemy", kind: "damage", stat: "holy", amount: 1 },
    ]);
    const bursts = battlePresentation.getState().floatingCombatBursts;
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
    const state = battlePresentation.getState();
    expect(state.enemyImpactCue).toMatchObject({ colors: keywordDefinitions.burn.shineColors, healthLost: true });
    expect(state.playerImpactCue).toMatchObject({ colors: keywordDefinitions.physical.shineColors, healthLost: true });
    show([{ target: "player", kind: "damage", stat: "block", amount: 3 }]);
    expect(battlePresentation.getState().playerImpactCue).toMatchObject({
      colors: keywordDefinitions.block.shineColors,
      healthLost: false,
    });
  });

  it("does not show feedback outside battle and cancels old lifetimes on clear", async () => {
    const show = activateBattle();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
    await vi.advanceTimersByTimeAsync(300);
    battlePresentation.getState().clearFloatingCombatTexts();
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS - 300);
    expect(battlePresentation.getState().floatingCombatBursts).toHaveLength(1);
    battlePresentation.getState().resetPresentation();
    dispatchRunSessionCommand(
      (draft) => acceptCommand(setScreen(draft, ROUTE_SCREENS.COLLECTION)),
      undefined,
      defaultGameSession,
    );
    show([{ target: "enemy", kind: "damage", stat: "physical", amount: 9 }]);
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS);
    expect(battlePresentation.getState().floatingCombatBursts).toEqual([]);
    expect(battlePresentation.getState().enemyImpactCue).toBeNull();
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
        if (build === "Holy/Leech") {
          expect(result.state.wishOptions).not.toBeNull();
        } else {
          expect(result.state.wishOptions).toBeNull();
        }
        texts.push(...result.combatTexts);
      }
      expect(texts.length).toBeGreaterThan(3);
      show(texts);
      const bursts = battlePresentation.getState().floatingCombatBursts;
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
      expect(battlePresentation.getState().floatingCombatBursts[0]!.lifetimeMs).toBe(400);
      await vi.advanceTimersByTimeAsync(399);
      expect(battlePresentation.getState().floatingCombatBursts).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(battlePresentation.getState().floatingCombatBursts).toEqual([]);
    } finally {
      localStorage.removeItem("alchemy-disable-animations");
    }
  });
});
