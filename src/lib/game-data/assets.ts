import alchemyLogo from "@/assets/optimized/alchemy-logo.webp";
import anvil from "@/assets/optimized/anvil.webp";
import apple from "@/assets/optimized/apple.webp";
import bash from "@/assets/optimized/bash.webp";
import blessedAegis from "@/assets/optimized/blessed-aegis.webp";
import block from "@/assets/optimized/block.webp";
import bread from "@/assets/optimized/bread.webp";
import cardBack from "@/assets/optimized/card-back.webp";
import cleanse from "@/assets/optimized/cleanse.webp";
import discardPile from "@/assets/optimized/discard-pile.webp";
import drawPile from "@/assets/optimized/draw-pile.webp";
import fangs from "@/assets/optimized/fangs.webp";
import femaleKnight from "@/assets/optimized/female-knight.webp";
import femaleRogue from "@/assets/optimized/female-rogue.webp";
import femaleWizard from "@/assets/optimized/female-wizard.webp";
import fireball from "@/assets/optimized/fireball.webp";
import frostbolt from "@/assets/optimized/frostbolt.webp";
import goblin from "@/assets/optimized/goblin.webp";
import haste from "@/assets/optimized/haste.webp";
import heal from "@/assets/optimized/heal.webp";
import healthPotion from "@/assets/optimized/health-potion.webp";
import imp from "@/assets/optimized/imp.webp";
import lizardScout from "@/assets/optimized/lizard-scout.webp";
import maleKnight from "@/assets/optimized/male-knight.webp";
import maleRogue from "@/assets/optimized/male-rogue.webp";
import maleWizard from "@/assets/optimized/male-wizard.webp";
import manaBerries from "@/assets/optimized/mana-berries.webp";
import manaCrystal from "@/assets/optimized/mana-crystal.webp";
import manaPotion from "@/assets/optimized/mana-potion.webp";
import meteor from "@/assets/optimized/meteor.webp";
import mimic from "@/assets/optimized/mimic.webp";
import mudElemental from "@/assets/optimized/mud-elemental.webp";
import necromancer from "@/assets/optimized/necromancer.webp";
import panaceaPotion from "@/assets/optimized/panacea-potion.webp";
import plagueDoctor from "@/assets/optimized/plague-doctor.webp";
import plateMail from "@/assets/optimized/plate-mail.webp";
import poisonDagger from "@/assets/optimized/poison-dagger.webp";
import skeleton from "@/assets/optimized/skeleton.webp";
import slash from "@/assets/optimized/slash.webp";
import stab from "@/assets/optimized/stab.webp";
import steal from "@/assets/optimized/steal.webp";
import wish from "@/assets/optimized/wish.webp";

export {
  alchemyLogo,
  anvil,
  apple,
  bash,
  blessedAegis,
  block,
  bread,
  cardBack,
  cleanse,
  discardPile,
  drawPile,
  fangs,
  femaleKnight,
  femaleRogue,
  femaleWizard,
  fireball,
  frostbolt,
  goblin,
  haste,
  heal,
  healthPotion,
  imp,
  lizardScout,
  maleKnight,
  maleRogue,
  maleWizard,
  manaBerries,
  manaCrystal,
  manaPotion,
  meteor,
  mimic,
  mudElemental,
  necromancer,
  panaceaPotion,
  plagueDoctor,
  plateMail,
  poisonDagger,
  skeleton,
  slash,
  stab,
  steal,
  wish,
};

export const menuLogo = alchemyLogo;
export const battleCardBack = cardBack;
export const pileDrawArt = drawPile;
export const pileDiscardArt = discardPile;

export const characterArt = {
  knight: { male: maleKnight, female: femaleKnight },
  rogue: { male: maleRogue, female: femaleRogue },
  wizard: { male: maleWizard, female: femaleWizard },
} as const;

export const battleArt = {
  hero: femaleKnight,
  enemy: skeleton,
};
