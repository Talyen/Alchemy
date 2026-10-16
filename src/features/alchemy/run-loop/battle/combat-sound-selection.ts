import type { CombatTextEvent } from "@/lib/battle";
import type { playBattleEvent } from "@/lib/audio";

type BattleSound = Parameters<typeof playBattleEvent>[0];
interface Candidate {
  sound: BattleSound;
  amount: number;
  priority: number;
  critical: boolean;
}

const CONTROL_PRIORITY = ["shatter", "dodge", "freezeProc", "stunProc"] as const;
const RESOURCE_PRIORITY = [
  "purge",
  "cleanse",
  "playerHeal",
  "manaChange",
  "armorGain",
  "forgeGain",
  "thornsGain",
  "gainGold",
  "wishAppear",
  "drawCards",
] as const;
const PERIODIC_SOUNDS: Partial<Record<CombatTextEvent["stat"], BattleSound>> = {
  burn: "burnTick",
  poison: "poisonTick",
  bleed: "bleedTick",
};
const DAMAGE_SOUNDS: Partial<Record<CombatTextEvent["stat"], BattleSound>> = {
  burn: "hitBurn",
  freeze: "hitFreeze",
  stun: "hitStun",
  holy: "hitHoly",
  poison: "hitPiercing",
  bleed: "hitPiercing",
};
const CRITICAL_SOUNDS: Partial<Record<CombatTextEvent["stat"], BattleSound>> = {
  burn: "hitBurnCritical",
  freeze: "hitFreezeCritical",
  stun: "hitStunCritical",
  holy: "hitHolyCritical",
  poison: "hitPiercingCritical",
  bleed: "hitPiercingCritical",
};
const STATUS_SOUNDS: Partial<Record<CombatTextEvent["stat"], BattleSound>> = {
  forge: "forgeGain",
  thorns: "thornsGain",
  gold: "gainGold",
  wish: "wishAppear",
  draw: "drawCards",
};

/** Resolved damage, restored Health and Block compete; Mana, Gold and preparation remain fallbacks. */
export function selectCombatSound(events: CombatTextEvent[], hasFocalSound: boolean): BattleSound | undefined {
  const controls = new Set<BattleSound>();
  const resources = new Set<BattleSound>();
  const numeric = new Map<string, Candidate>();
  function add(key: string, sound: BattleSound, amount: number, priority: number, critical = false) {
    const existing = numeric.get(key);
    if (existing) {
      existing.amount = Math.min(Number.MAX_SAFE_INTEGER, existing.amount + amount);
      if (critical) {
        existing.sound = sound;
        existing.critical = true;
      }
    } else numeric.set(key, { sound, amount, priority, critical });
  }
  for (const event of events) {
    if (event.kind === "notice") {
      if (event.signal === "reaction" && event.reactionId === "shatter") controls.add("shatter");
      else if (event.stat === "dodge") controls.add("dodge");
      if (event.signal === "purge" || event.text === "Purged") resources.add("purge");
      else if (event.signal === "cleanse") resources.add("cleanse");
      else if (!event.signal) {
        if (event.stat === "freeze") controls.add("freezeProc");
        else if (event.stat === "stun") controls.add("stunProc");
        else if (event.stat === "wish") resources.add("wishAppear");
      }
      continue;
    }
    if (!Number.isFinite(event.amount) || event.amount <= 0) continue;
    if (event.stat === "armor") {
      if (event.kind !== "damage") resources.add("armorGain");
      continue;
    }
    if (event.stat === "mana") {
      if (event.kind !== "damage") resources.add("manaChange");
      continue;
    }
    if (event.kind === "damage" && event.impact !== false) {
      if (event.stat === "block") add("absorbed", "blockAbsorb", event.absorbedDamage ?? event.amount, 2);
      else {
        const healthLost = event.healthLost ?? event.amount;
        if (!Number.isFinite(healthLost) || healthLost <= 0) continue;
        const ordinary =
          (event.periodic ? PERIODIC_SOUNDS[event.stat] : undefined) ??
          DAMAGE_SOUNDS[event.stat] ??
          (event.target === "enemy" ? "enemyHit" : "playerHit");
        add(
          "damage:" + event.stat + (event.periodic ? ":periodic" : ":direct"),
          event.critical ? (CRITICAL_SOUNDS[event.stat] ?? "hitCritical") : ordinary,
          healthLost,
          0,
          event.critical,
        );
      }
    } else if (event.kind === "heal" && event.stat === "health") {
      add("heal", "playerHeal", event.amount, 1);
    } else if (event.kind === "status" || event.kind === "multiply") {
      if (event.stat === "block" && event.kind === "status") add("block", "blockGain", event.amount, 2);
      else {
        const sound = STATUS_SOUNDS[event.stat];
        if (sound) resources.add(sound);
      }
    }
  }
  const control = CONTROL_PRIORITY.find((sound) => controls.has(sound));
  if (control) return control;
  let strongest: Candidate | undefined;
  for (const candidate of numeric.values()) {
    if (
      !strongest ||
      candidate.amount > strongest.amount ||
      (candidate.amount === strongest.amount && candidate.priority < strongest.priority)
    )
      strongest = candidate;
  }
  if (hasFocalSound) return strongest?.critical ? strongest.sound : undefined;
  return strongest?.sound ?? RESOURCE_PRIORITY.find((sound) => resources.has(sound));
}
