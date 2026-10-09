import { describe, expect, it } from "vitest";
import { resolveTypedEnemyHit } from "@/lib/battle/typed-hit-resolution";
import { applyDamageStatuses, applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { prepareWildwoodBossInDraft } from "@/features/alchemy/run-loop/run/wildwood-commands";
import { SIMPLE_HANDLERS } from "@/lib/battle/effect-handlers/simple-handlers";
import { applyCardHitReactions } from "@/lib/battle/card-hit-reactions";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { defaultTalentEffects } from "@/lib/battle";
import { cardById, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";

describe("Combat feedback and reward regressions", () => {
  describe("Bug 1: Pre-hit eligibility snapshot in resolveTypedEnemyHit", () => {
    it("preserves eligibility snapshot when applying damage status riders", () => {
      const eligibility = patchBattleState({
        playerStatuses: { block: 0 },
        gearEffects: { freezeGrantsBlockAndMana: 1 },
      });
      // Damaged state has block = 5, but eligibility snapshot had block = 0
      const state = patchBattleState({
        playerStatuses: { block: 5 },
        gearEffects: { freezeGrantsBlockAndMana: 1 },
        enemyHealth: 50,
      });

      const combatTexts: CombatTextEvent[] = [];
      const result = resolveTypedEnemyHit(
        state,
        { kind: "damage", damageType: "freeze", amount: 4 },
        4,
        combatTexts,
        eligibility,
      );

      // Since eligibility had 0 block, freezeGrantsBlockAndMana should have granted Block
      expect(result.state.playerStatuses.block).toBe(5 + 4);
    });
  });

  describe("Bug 2: Armor strip combat text feedback for poisonStripArmor and physicalStripArmorWhileBlocked", () => {
    it("emits armor damage combat text when poisonStripArmor removes enemy armor", () => {
      const state = patchBattleState({
        enemyMitigation: { armor: 3 },
        talentEffects: { ...defaultTalentEffects, poisonStripArmor: true },
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = applyPoisonTalentRiders(state, 5, combatTexts);

      expect(next.enemyMitigation.armor).toBe(2);
      expect(combatTexts).toContainEqual({
        target: "enemy",
        kind: "damage",
        stat: "armor",
        amount: 1,
        impact: false,
      });
    });

    it("emits armor damage combat text when physicalStripArmorWhileBlocked removes enemy armor", () => {
      const state = patchBattleState({
        playerStatuses: { block: 4 },
        enemyMitigation: { armor: 5 },
        talentEffects: { ...defaultTalentEffects, physicalStripArmorWhileBlocked: true },
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = applyDamageStatuses(state, { kind: "damage", damageType: "physical", amount: 6 }, 6, combatTexts);

      expect(next.enemyMitigation.armor).toBe(3);
      expect(combatTexts).toContainEqual({
        target: "enemy",
        kind: "damage",
        stat: "armor",
        amount: 2,
        impact: false,
      });
    });
  });

  describe("Bug 3: CC immunity feedback on cooldown for multiply-enemy-status", () => {
    it("emits Immune to Freeze notice when enemy status multiplier is blocked by player CC cooldown", () => {
      const state = patchBattleState({
        playerStatuses: { freeze: 10 },
        playerCC: { cooldown: 2, stunSkipTurns: 0, freezeSkipTurns: 0 },
        currentEnemy: { abilityIds: ["chill-spike"] },
      });
      const abilityCard: BattleCard = {
        id: "chill-spike",
        title: "Chill Spike",
        descriptionLines: [],
        art: "",
        cost: 0,
        effects: [{ kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
      };
      const combatTexts: CombatTextEvent[] = [];
      const next = applyEnemyAbility(state, abilityCard, combatTexts);

      expect(next.playerStatuses.freeze).toBe(10);
      expect(combatTexts).toContainEqual({
        target: "player",
        kind: "notice",
        stat: "freeze",
        signal: "immune",
        text: "Immune to Freeze",
      });
    });
  });

  describe("Bug 5: Turn-end mana tracking forwarded in resolveHasteTurn", () => {
    it("preserves manaAtTurnEnd on haste turns so wellspringKeepMana awards bonus mana", () => {
      const state = patchBattleState({
        mana: 3,
        maxMana: 3,
        playerStatuses: { haste: 1 },
        talentEffects: { ...defaultTalentEffects, wellspringKeepMana: 2 },
      });
      const resolution = endPlayerTurn(state);

      expect(resolution.kind).toBe("haste");
      // Player had unspent mana (3 > 0), so wellspringKeepMana grants 2 bonus mana
      expect(resolution.state.mana).toBe(3 + 2);
    });
  });

  describe("Bug 6: prepareWildwoodBossInDraft passes updated deck length", () => {
    it("commits the removed deck and next boss together", async () => {
      const session = createGameSession();
      dispatchGameplayCommand(
        (draft) => {
          draft.run.activeRun.contentSystemType = CONTENT_SYSTEMS.WILDWOOD;
          draft.run.activeRun.runDeck = Array.from({ length: 9 }, (_, uid) => ({ ...cardById["slash"]!, uid }));
          setHasActiveRun(draft, true);
          draft.session.activity = { kind: "wildwood-removal" };
          draft.session.wildwoodDraft = {
            ...createInitialWildwoodDraftState("knight", () => 0.5),
            phase: "removal",
          };
          return acceptCommand();
        },
        undefined,
        session,
      );

      const result = dispatchRunSessionCommand(
        (draft) => {
          const prepared = prepareWildwoodBossInDraft(draft, 0);
          return prepared ? acceptCommand(prepared) : rejectCommand("failed", null);
        },
        undefined,
        session,
      );

      expect(result).not.toBeNull();
      expect(readActiveRun(session).runDeck.length).toBe(8);
      expect(readRunSession(session).wildwoodDraft?.phase).toBe("battle");
      await session.dispose();
    });
  });

  describe("scaled empty draws", () => {
    it.each([0, 0.4, 1, 2])(
      "only grants an emergency Wish for a positive resolved draw at multiplier %s",
      (multiplier) => {
        const state = patchBattleState({ deck: [], discard: [], hand: [] });
        const next = SIMPLE_HANDLERS["random-draw"](
          state,
          makeTestCard(),
          { kind: "random-draw", minAmount: 1, maxAmount: 1 },
          multiplier,
          [],
        );
        if (Math.round(multiplier) > 0) {
          expect(next.wishOptions?.length).toBeGreaterThan(0);
          expect(next.wishQueue).toEqual([]);
        } else {
          expect(next.wishOptions).toBeNull();
          expect(next.wishQueue).toEqual([]);
        }
      },
    );
  });

  describe("Bug 8: Guard companionFreezeDamageVsFrozen in card-hit-reactions", () => {
    it("does not dispatch follow-up freeze hit when companionFreezeDamageVsFrozen is 0", () => {
      const state = patchBattleState({
        enemyHealth: 50,
        enemyCC: { freezeSkipTurns: 2, stunSkipTurns: 0, cooldown: 0 },
        talentEffects: { ...defaultTalentEffects, companionFreezeDamageVsFrozen: 0 },
      });
      const combatTexts: CombatTextEvent[] = [];
      const testCard = makeTestCard();
      applyCardHitReactions(
        state,
        {
          source: "card-attack",
          resolvedDamage: 5,
          card: testCard,
          effect: { kind: "damage", damageType: "physical", amount: 5 },
          origin: "companion",
        },
        {
          state,
          healthDamage: 5,
          previousHealth: 50,
          enemyWasAlive: true,
          critical: false,
          eligibility: state,
          resolvedDamage: 5,
        },
        combatTexts,
      );

      // No follow-up hit dispatched
      const followUp = combatTexts.find((t) => t.stat === "freeze" && t.kind === "damage");
      expect(followUp).toBeUndefined();
    });

    it("dispatches follow-up freeze hit when companionFreezeDamageVsFrozen > 0", () => {
      const state = patchBattleState({
        enemyHealth: 50,
        enemyCC: { freezeSkipTurns: 2, stunSkipTurns: 0, cooldown: 0 },
        talentEffects: { ...defaultTalentEffects, companionFreezeDamageVsFrozen: 4 },
      });
      const combatTexts: CombatTextEvent[] = [];
      const testCard = makeTestCard();
      applyCardHitReactions(
        state,
        {
          source: "card-attack",
          resolvedDamage: 5,
          card: testCard,
          effect: { kind: "damage", damageType: "physical", amount: 5 },
          origin: "companion",
        },
        {
          state,
          healthDamage: 5,
          previousHealth: 50,
          enemyWasAlive: true,
          critical: false,
          eligibility: state,
          resolvedDamage: 5,
        },
        combatTexts,
      );

      const followUp = combatTexts.find((t) => t.stat === "freeze" && t.kind === "damage");
      expect(followUp).toBeDefined();
    });
  });

  describe("Bug 9: Guard companion summoning card in applyConsumeGearRiders", () => {
    it("does not grant armorOnConsume when playing a summon-companion card", () => {
      const summonCard = makeTestCard({
        consume: true,
        effects: [{ kind: "summon-companion", companionId: "wolf" }],
      });
      const state = patchBattleState({
        playerStatuses: { armor: 0 },
        gearEffects: { armorOnConsume: 3 },
      });
      const next = handlePostPlayCardDestination(state, summonCard, {
        triggerConsumeRiders: true,
        combatTexts: [],
      });

      expect(next.playerStatuses.armor).toBe(0);
    });

    it("grants armorOnConsume when playing an ordinary consume card", () => {
      const regularCard = makeTestCard({
        consume: true,
        effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
      });
      const state = patchBattleState({
        playerStatuses: { armor: 0 },
        gearEffects: { armorOnConsume: 3 },
      });
      const next = handlePostPlayCardDestination(state, regularCard, {
        triggerConsumeRiders: true,
        combatTexts: [],
      });

      expect(next.playerStatuses.armor).toBe(3);
    });
  });

  describe("Bug 10: Guard burnOnDodgeBurning on dodge", () => {
    it("does not dispatch follow-up burn hit when burnOnDodgeBurning is 0 against burning enemy", () => {
      const state = patchBattleState({
        enemyStatuses: { burn: 5 },
        talentEffects: { ...defaultTalentEffects, burnOnDodgeBurning: 0 },
        enemyHealth: 50,
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = applyDodgeTalentStatuses(state, combatTexts);

      const burnHit = combatTexts.find((t) => t.stat === "burn" && t.kind === "damage");
      expect(burnHit).toBeUndefined();
      expect(next.enemyHealth).toBe(50);
    });

    it("dispatches follow-up burn hit when burnOnDodgeBurning > 0 against burning enemy", () => {
      const state = patchBattleState({
        enemyStatuses: { burn: 5 },
        talentEffects: { ...defaultTalentEffects, burnOnDodgeBurning: 3 },
        enemyHealth: 50,
      });
      const combatTexts: CombatTextEvent[] = [];
      const next = applyDodgeTalentStatuses(state, combatTexts);

      const burnHit = combatTexts.find((t) => t.stat === "burn" && t.kind === "damage");
      expect(burnHit).toBeDefined();
      expect(next.enemyHealth).toBeLessThan(50);
    });
  });
});
