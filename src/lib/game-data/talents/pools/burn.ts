import { talentFor } from "../talent-builder";
import { setEffect } from "../types";

const t = talentFor("burn");

export const burnTalents = [
  t(
    "burn-dmg-1",
    "Flashpoint",
    "Your first Burn card each combat costs no mana",
    "Thermometer",
    setEffect("firstBurnCardFree", true),
  ),
  t(
    "burn-dmg-2",
    "Thermal Vent",
    "Burn cards have a 10% chance to grant 3 Forge",
    "WavesArrowUp",
    setEffect("forgeOnBurnCard", 3),
    setEffect("forgeOnBurnCardChance", 10),
  ),
  t(
    "burn-dmg-5",
    "Smoke Screen",
    "When you Dodge a Burning enemy, deal 2 Burn damage",
    "Shield",
    setEffect("burnOnDodgeBurning", 2),
  ),
  t(
    "burn-dmg-4",
    "Combustible",
    "10% chance when you Consume a card to detonate the enemy's Burn",
    "Bomb",
    setEffect("consumeDetonatesBurnChance", 10),
  ),
  t(
    "burn-first-double",
    "Wildfire",
    "Burn cards have a 10% chance to play twice",
    "TrendingUp",
    setEffect("burnCardPlayTwiceChance", 10),
  ),
  t(
    "burn-remove-armor",
    "Melting Point",
    "Burn hits remove enemy Armor equal to the damage dealt",
    "Droplets",
    setEffect("burnRemovesEnemyArmor", true),
  ),
  t(
    "burn-dmg-3",
    "Heat Exhaustion",
    "Burn hits have a 10% chance to also deal Stun damage",
    "TrendingDown",
    setEffect("burnStunChance", 10),
  ),
  t(
    "burn-dmg-6",
    "Burning Wish",
    "When you Wish, deal 1 Burn damage to the enemy",
    "Sparkles",
    setEffect("burnOnWish", 1),
  ),
  t(
    "burn-double-chance",
    "Smoldering",
    "Burn has a 10% chance to not decay",
    "Wind",
    setEffect("burnPreventDecayChance", 10),
  ),
  t(
    "burn-half-damage",
    "Fire Resistance",
    "Take half Burn damage",
    "ShieldCheck",
    setEffect("receiveHalfBurnDamage", true),
  ),
];
