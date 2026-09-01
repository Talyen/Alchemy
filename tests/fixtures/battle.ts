import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { dealDamageToEnemy } from "@/lib/battle/damage";
import { defaultBattleState } from "@/lib/battle";
import { BASE_PLAYER_MANA } from "@/lib/game-constants";
import { makeTestCard } from "./cards";
import { seededRng } from "./rng";

export { makeTestCard, makeTestCardWithId } from "./cards";
export { seededRng } from "./rng";

export function makeCombatTexts(): CombatTextEvent[] {
  return [];
}

export function makeEffect(
  damageType: string,
  amount: number,
  extras: Partial<BattleCardEffect> = {},
): BattleCardEffect {
  return {
    kind: "damage",
    damageType: damageType as import("@/lib/game-data/types").DamageType,
    amount,
    ...extras,
  } as BattleCardEffect;
}

export function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 10, ...overrides });
}

const chanceFailRng = () => 0.99;

export function makeStateWithFailedRolls(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeState({ rng: chanceFailRng, ...overrides });
}

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

export function dealDamage(state: BattleState, card: BattleCard, texts: CombatTextEvent[] = makeCombatTexts()) {
  const effect = card.effects.find((candidate): candidate is DamageEffect => candidate.kind === "damage");
  if (!effect) throw new Error("dealDamage fixture: card has no damage effect");
  return dealDamageToEnemy(state, card, effect, texts);
}

export function makeTestBattleState(overrides: Partial<BattleState> = {}): BattleState {
  const base = defaultBattleState();
  const merged = {
    ...base,
    mana: BASE_PLAYER_MANA,
    maxMana: BASE_PLAYER_MANA,
    rng: seededRng(42),

    appliesFightPacing: false,
  };
  return {
    ...merged,
    ...overrides,
    playerCC: overrides.playerCC ? { ...merged.playerCC, ...overrides.playerCC } : merged.playerCC,
    enemyCC: overrides.enemyCC ? { ...merged.enemyCC, ...overrides.enemyCC } : merged.enemyCC,
  };
}

export type BattleStatePatch = Omit<
  Partial<BattleState>,
  | "playerStatuses"
  | "enemyStatuses"
  | "trinketEffects"
  | "talentEffects"
  | "gearEffects"
  | "flags"
  | "enemyMitigation"
  | "playerCC"
  | "enemyCC"
  | "currentEnemy"
> & {
  playerStatuses?: Partial<BattleState["playerStatuses"]>;
  enemyStatuses?: Partial<BattleState["enemyStatuses"]>;
  trinketEffects?: Partial<BattleState["trinketEffects"]>;
  talentEffects?: Partial<BattleState["talentEffects"]>;
  gearEffects?: Partial<BattleState["gearEffects"]>;
  flags?: Partial<BattleState["flags"]>;
  enemyMitigation?: Partial<BattleState["enemyMitigation"]>;
  playerCC?: Partial<BattleState["playerCC"]>;
  enemyCC?: Partial<BattleState["enemyCC"]>;
  currentEnemy?: Partial<BattleState["currentEnemy"]>;
};

export function patchBattleState(patch: BattleStatePatch = {}): BattleState {
  const base = makeTestBattleState();
  return {
    ...base,
    ...patch,
    playerStatuses: patch.playerStatuses ? { ...base.playerStatuses, ...patch.playerStatuses } : base.playerStatuses,
    enemyStatuses: patch.enemyStatuses ? { ...base.enemyStatuses, ...patch.enemyStatuses } : base.enemyStatuses,
    trinketEffects: patch.trinketEffects ? { ...base.trinketEffects, ...patch.trinketEffects } : base.trinketEffects,
    talentEffects: patch.talentEffects ? { ...base.talentEffects, ...patch.talentEffects } : base.talentEffects,
    gearEffects: patch.gearEffects ? { ...base.gearEffects, ...patch.gearEffects } : base.gearEffects,
    flags: patch.flags ? { ...base.flags, ...patch.flags } : base.flags,
    enemyMitigation: patch.enemyMitigation
      ? { ...base.enemyMitigation, ...patch.enemyMitigation }
      : base.enemyMitigation,
    playerCC: patch.playerCC ? { ...base.playerCC, ...patch.playerCC } : base.playerCC,
    enemyCC: patch.enemyCC ? { ...base.enemyCC, ...patch.enemyCC } : base.enemyCC,
    currentEnemy: patch.currentEnemy ? { ...base.currentEnemy, ...patch.currentEnemy } : base.currentEnemy,
  };
}

function dodgeThenMissRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0.01 : 0.99;
  };
}

export function incomingPhysical(overrides: Parameters<typeof patchBattleState>[0] = {}) {
  return patchBattleState({
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    rng: dodgeThenMissRng(),
    enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    ...overrides,
  });
}

export function slashDeck(count: number): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `slash-${index}`,
      title: "Slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
  );
}

export function blockDeck(count: number): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `block-${index}`,
      title: "Block",
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    }),
  );
}

export function statusDeck(
  status: "burn" | "poison" | "bleed" | "stun" | "freeze",
  amount: number,
  count: number,
): BattleCard[] {
  return Array.from({ length: count }, (_, index) =>
    makeTestCard({
      id: `${status}-${index}`,
      title: status,
      effects: [{ kind: "damage", damageType: status, amount }],
    }),
  );
}
