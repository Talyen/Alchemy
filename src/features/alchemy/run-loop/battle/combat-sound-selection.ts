import type { CombatTextEvent } from "@/lib/battle";
import type { playBattleEvent } from "@/lib/audio";

type BattleSound = Parameters<typeof playBattleEvent>[0];

const ACCENT_PRIORITY = ["shatter", "wildfire", "critHit", "dodge", "freezeProc", "stunProc"] as const;
const DAMAGE_PRIORITY = ["burnTick", "poisonTick", "bleedTick", "playerHit", "blockAbsorb", "enemyHit"] as const;
const RESOURCE_PRIORITY = [
  "playerHeal",
  "cleanse",
  "manaChange",
  "armorChange",
  "forgeGain",
  "blockGain",
  "thornsGain",
  "gainGold",
  "wishAppear",
  "drawCards",
] as const;

/** Amounts compete only within damage; Mana, Gold, and statuses use semantic priority. */
export function selectCombatSound(events: CombatTextEvent[], hasFocalSound: boolean): BattleSound | undefined {
  const accents = new Set<BattleSound>();
  const resources = new Set<BattleSound>();
  const damage = new Map<BattleSound, number>();
  for (const event of events) {
    if (event.kind === "notice") {
      if (event.text === "Shatter · Critical") accents.add("shatter");
      else if (event.text === "Wildfire") accents.add("wildfire");
      else if (event.stat === "dodge") accents.add("dodge");
      if (event.signal === "cleanse" || event.signal === "purge" || event.text === "Purged") resources.add("cleanse");
      else if (!event.signal) {
        if (event.stat === "freeze") accents.add("freezeProc");
        else if (event.stat === "stun") accents.add("stunProc");
        else if (event.stat === "wish") resources.add("wishAppear");
      }
      continue;
    }
    if (event.amount <= 0) continue;
    if (event.stat === "armor") {
      resources.add("armorChange");
      continue;
    }
    if (event.stat === "mana") {
      resources.add("manaChange");
      continue;
    }
    if (event.kind === "damage" && event.impact !== false) {
      if (event.critical) accents.add("critHit");
      const sound: BattleSound =
        event.periodic && event.stat === "burn"
          ? "burnTick"
          : event.periodic && event.stat === "poison"
            ? "poisonTick"
            : event.periodic && event.stat === "bleed"
              ? "bleedTick"
              : event.target === "enemy"
                ? "enemyHit"
                : event.stat === "block"
                  ? "blockAbsorb"
                  : "playerHit";
      damage.set(sound, Math.max(damage.get(sound) ?? 0, event.amount));
    } else if (event.kind === "heal" && event.stat === "health") resources.add("playerHeal");
    else if (event.kind === "status" || event.kind === "multiply") {
      if (event.stat === "forge") resources.add("forgeGain");
      else if (event.stat === "block") resources.add("blockGain");
      else if (event.stat === "thorns") resources.add("thornsGain");
      else if (event.stat === "gold") resources.add("gainGold");
      else if (event.stat === "wish") resources.add("wishAppear");
      else if (event.stat === "draw") resources.add("drawCards");
    }
  }
  const accent = ACCENT_PRIORITY.find((sound) => accents.has(sound));
  if (accent || hasFocalSound) return accent;
  let strongest: BattleSound | undefined;
  let magnitude = 0;
  for (const sound of DAMAGE_PRIORITY) {
    const amount = damage.get(sound) ?? 0;
    if (amount > magnitude) {
      strongest = sound;
      magnitude = amount;
    }
  }
  return strongest ?? RESOURCE_PRIORITY.find((sound) => resources.has(sound));
}
