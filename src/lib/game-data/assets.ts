// Imported asset references (all .webp) consumed by game-data barrel readers and UI.
// The prebuild step optimizes PNG source files into webp; this file only sees the output.
import type { KeywordId } from "./types";

import alchemist from "@/assets/optimized/alchemist.webp";
import alchemyLogo from "@/assets/optimized/alchemy-logo.webp";
import alchemyLogoArcaneMana from "@/assets/optimized/alchemy-logo-arcane-mana.webp";
import alchemyLogoFireIron from "@/assets/optimized/alchemy-logo-fire-iron.webp";
import alchemyLogoFrost from "@/assets/optimized/alchemy-logo-frost.webp";
import alchemyLogoHolyBlock from "@/assets/optimized/alchemy-logo-holy-block.webp";
import alchemyLogoNatureBleed from "@/assets/optimized/alchemy-logo-nature-bleed.webp";
import alchemyLogoPoison from "@/assets/optimized/alchemy-logo-poison.webp";
import discardPile from "@/assets/optimized/discard-pile.webp";
import drawPile from "@/assets/optimized/draw-pile.webp";
import druid from "@/assets/optimized/druid.webp";
import knight from "@/assets/optimized/knight.webp";
import pointerCursor from "@/assets/optimized/pointer-c-shaded.webp";
import ranger from "@/assets/optimized/ranger.webp";
import rogue from "@/assets/optimized/rogue.webp";
import talentBgArmor from "@/assets/optimized/talent-bg-armor.webp";
import talentBgBleed from "@/assets/optimized/talent-bg-bleed.webp";
import talentBgBurn from "@/assets/optimized/talent-bg-burn.webp";
import talentBgCompanion from "@/assets/optimized/talent-bg-companion.webp";
import talentBgForge from "@/assets/optimized/talent-bg-forge.webp";
import talentBgFreeze from "@/assets/optimized/talent-bg-freeze.webp";
import talentBgLeech from "@/assets/optimized/talent-bg-leech.webp";
import talentBgMana from "@/assets/optimized/talent-bg-mana.webp";
import talentBgNature from "@/assets/optimized/talent-bg-nature.webp";
import talentBgPhysical from "@/assets/optimized/talent-bg-physical.webp";
import talentBgStun from "@/assets/optimized/talent-bg-stun.webp";
import warlock from "@/assets/optimized/warlock.webp";
import wildcard from "@/assets/optimized/wildcard.webp";
import wizard from "@/assets/optimized/wizard.webp";
import theCampaign from "@/assets/optimized/the-campaign.webp";
import theLabyrinth from "@/assets/optimized/the-labyrinth.webp";
import theWildwoods from "@/assets/optimized/the-wildwoods.webp";
import placeholderGameMode from "@/assets/optimized/placeholder-game-mode.webp";

export { default as acidPotion } from "@/assets/optimized/acid-potion.webp";
export { default as alchemistShopBg } from "@/assets/optimized/alchemist-shop.webp";
export { default as alchemyLab } from "@/assets/optimized/alchemy-lab.webp";
export { default as antivenomPotion } from "@/assets/optimized/antivenom-potion.webp";
export { default as anvil } from "@/assets/optimized/anvil.webp";
export { default as apple } from "@/assets/optimized/apple.webp";
export { default as bash } from "@/assets/optimized/bash.webp";
export { default as bearCompanion } from "@/assets/optimized/bear-companion.webp";
export { default as blackjack } from "@/assets/optimized/blackjack.webp";
export { default as blessedAegis } from "@/assets/optimized/blessed-aegis.webp";
export { default as block } from "@/assets/optimized/block.webp";
export { default as bloodOffering } from "@/assets/optimized/blood-offering.webp";
export { default as bloodthorn } from "@/assets/optimized/bloodthorn.webp";
export { default as boneCharm } from "@/assets/optimized/bone-charm.webp";
export { default as bossCombat } from "@/assets/optimized/boss-combat.webp";
export { default as brassCenser } from "@/assets/optimized/brass-censer.webp";
export { default as bread } from "@/assets/optimized/bread.webp";
export { default as briarShield } from "@/assets/optimized/briar-shield.webp";
export { default as burningBlade } from "@/assets/optimized/burning-blade.webp";
export { default as campfire } from "@/assets/optimized/campfire.webp";
export { default as cardBack } from "@/assets/optimized/card-back.webp";
export { default as cauterize } from "@/assets/optimized/cauterize.webp";
export { default as cinderbloom } from "@/assets/optimized/cinderbloom.webp";
export { default as cleanse } from "@/assets/optimized/cleanse.webp";
export { default as coldSnap } from "@/assets/optimized/cold-snap.webp";
export { default as combustion } from "@/assets/optimized/combustion.webp";
export { default as concussiveShot } from "@/assets/optimized/concussive-shot.webp";
export { default as companionsCollar } from "@/assets/optimized/companions-collar.webp";
export { default as corruptionAltar } from "@/assets/optimized/corruption-altar.webp";
export { default as crystalGarden } from "@/assets/optimized/crystal-garden.webp";
export { default as cutpurseKnife } from "@/assets/optimized/cutpurse-knife.webp";
export { default as darkPact } from "@/assets/optimized/dark-pact.webp";
export { default as difficulty1Art } from "@/assets/optimized/difficulty-1.webp";
export { default as difficulty2Art } from "@/assets/optimized/difficulty-2.webp";
export { default as difficulty3Art } from "@/assets/optimized/difficulty-3.webp";
export { default as eliteEnemyBg } from "@/assets/optimized/elite-enemy.webp";
export { default as exorcism } from "@/assets/optimized/exorcism.webp";
export { default as fangs } from "@/assets/optimized/fangs.webp";
export { default as faustianBargain } from "@/assets/optimized/faustian-bargain.webp";
export { default as fireArrow } from "@/assets/optimized/fire-arrow.webp";
export { default as fireball } from "@/assets/optimized/fireball.webp";
export { default as frostbolt } from "@/assets/optimized/frostbolt.webp";
export { default as frostWhelpCompanion } from "@/assets/optimized/frost-whelp-companion.webp";
export { default as frozenPocketwatch } from "@/assets/optimized/frozen-pocketwatch.webp";
export { default as goblin } from "@/assets/optimized/goblin.webp";
export { default as goldArt } from "@/assets/optimized/gold.webp";
export { default as goldenRetrieverCompanion } from "@/assets/optimized/golden-retriever-companion.webp";
export { default as graspingVines } from "@/assets/optimized/grasping-vines.webp";
export { default as grovesFavor } from "@/assets/optimized/groves-favor.webp";
export { default as haste } from "@/assets/optimized/haste.webp";
export { default as heal } from "@/assets/optimized/heal.webp";
export { default as healthPotion } from "@/assets/optimized/health-potion.webp";
export { default as herbGarden } from "@/assets/optimized/herb-garden.webp";
export { default as holyRadiance } from "@/assets/optimized/holy-radiance.webp";
export { default as iceShot } from "@/assets/optimized/ice-shot.webp";
export { default as huntersLodge } from "@/assets/optimized/hunters-lodge.webp";
export { default as icyHeart } from "@/assets/optimized/icy-heart.webp";
export { default as imp } from "@/assets/optimized/imp.webp";
export { default as impCompanion } from "@/assets/optimized/imp-companion.webp";
export { default as ironBear } from "@/assets/optimized/iron-bear.webp";
export { default as ironwoodBuckler } from "@/assets/optimized/ironwood-buckler.webp";
export { default as judgment } from "@/assets/optimized/judgment.webp";
export { default as kindling } from "@/assets/optimized/kindling.webp";
export { default as libraryOwlCompanion } from "@/assets/optimized/library-owl-companion.webp";
export { default as lightningArrow } from "@/assets/optimized/lightning-arrow.webp";
export { default as lightningBolt } from "@/assets/optimized/lightning-bolt.webp";
export { default as livingArmor } from "@/assets/optimized/living-armor.webp";
export { default as lizardScout } from "@/assets/optimized/lizard-scout.webp";
export { default as lizardScoutCompanion } from "@/assets/optimized/lizard-scout-companion.webp";
export { default as luckPotion } from "@/assets/optimized/luck-potion.webp";
export { default as luckyClover } from "@/assets/optimized/lucky-clover.webp";
export { default as manaBerries } from "@/assets/optimized/mana-berries.webp";
export { default as manaCrystal } from "@/assets/optimized/mana-crystal.webp";
export { default as manaPotion } from "@/assets/optimized/mana-potion.webp";
export { default as manaShield } from "@/assets/optimized/mana-shield.webp";
export { default as manaMothCompanion } from "@/assets/optimized/mana-moth-companion.webp";
export { default as merchantsFavor } from "@/assets/optimized/merchants-favor.webp";
export { default as merchantShopBg } from "@/assets/optimized/merchant-shop.webp";
export { default as meteor } from "@/assets/optimized/meteor.webp";
export { default as meteorite } from "@/assets/optimized/meteorite.webp";
export { default as mimic } from "@/assets/optimized/mimic.webp";
export { default as mixedPotion } from "@/assets/optimized/mixed-potion.webp";
export { default as mortarAndPestle } from "@/assets/optimized/mortar-and-pestle.webp";
export { default as mudElemental } from "@/assets/optimized/mud-elemental.webp";
export { default as mysteryBg } from "@/assets/optimized/mystery.webp";
export { default as necromancer } from "@/assets/optimized/necromancer.webp";
export { default as normalEnemyBg } from "@/assets/optimized/normal-enemy.webp";
export { default as obsidianHammer } from "@/assets/optimized/obsidian-hammer.webp";
export { default as orchard } from "@/assets/optimized/orchard.webp";
export { default as packTactics } from "@/assets/optimized/pack-tactics.webp";
export { default as panaceaPotion } from "@/assets/optimized/panacea-potion.webp";
export { default as pantherCompanion } from "@/assets/optimized/panther-companion.webp";
export { default as parasiticBloom } from "@/assets/optimized/parasitic-bloom.webp";
export { default as phoenixCompanion } from "@/assets/optimized/phoenix-companion.webp";
export { default as placeholderCard } from "@/assets/optimized/placeholder-card.webp";
export { default as placeholderDestination } from "@/assets/optimized/placeholder-destination.webp";
export { default as placeholderDifficulty } from "@/assets/optimized/placeholder-difficulty.webp";
export { default as placeholderEnemy } from "@/assets/optimized/placeholder-enemy.webp";
export { default as placeholderHomestead } from "@/assets/optimized/placeholder-homestead.webp";
export { default as placeholderMystery } from "@/assets/optimized/placeholder-mystery.webp";
export { default as placeholderTrinket } from "@/assets/optimized/placeholder-trinket.webp";
export { default as plagueDoctor } from "@/assets/optimized/plague-doctor.webp";
export { default as plagueDoctorsMask } from "@/assets/optimized/plague-doctors-mask.webp";
export { default as plateMail } from "@/assets/optimized/plate-mail.webp";
export { default as pixieCompanion } from "@/assets/optimized/pixie-companion.webp";
export { default as poisonDagger } from "@/assets/optimized/poison-dagger.webp";
export { default as prayer } from "@/assets/optimized/prayer.webp";
export { default as raiseSkeletonCompanion } from "@/assets/optimized/raise-skeleton-companion.webp";
export { default as rayOfFrost } from "@/assets/optimized/ray-of-frost.webp";
export { default as roulette } from "@/assets/optimized/roulette.webp";
export { default as resonantChimes } from "@/assets/optimized/resonant-chimes.webp";
export { default as runicQuill } from "@/assets/optimized/runic-quill.webp";
export { default as sanctifiedPlate } from "@/assets/optimized/sanctified-plate.webp";
export { default as serratedArrowhead } from "@/assets/optimized/serrated-arrowhead.webp";
export { default as serratedEdge } from "@/assets/optimized/serrated-edge.webp";
export { default as shieldBash } from "@/assets/optimized/shield-bash.webp";
export { default as shieldScarabCompanion } from "@/assets/optimized/shield-scarab-companion.webp";
export { default as sinEatersLantern } from "@/assets/optimized/sin-eaters-lantern.webp";
export { default as skeleton } from "@/assets/optimized/skeleton.webp";
export { default as slash } from "@/assets/optimized/slash.webp";
export { default as smellingSalts } from "@/assets/optimized/smelling-salts.webp";
export { default as smite } from "@/assets/optimized/smite.webp";
export { default as smugglersMap } from "@/assets/optimized/smugglers-map.webp";
export { default as stab } from "@/assets/optimized/stab.webp";
export { default as steal } from "@/assets/optimized/steal.webp";
export { default as stoneskinPotion } from "@/assets/optimized/stoneskin-potion.webp";
export { default as sunburst } from "@/assets/optimized/sunburst.webp";
export { default as sunderArmor } from "@/assets/optimized/sunder-armor.webp";
export { default as sunderingCharm } from "@/assets/optimized/sundering-charm.webp";
export { default as tatteredPages } from "@/assets/optimized/tattered-pages.webp";
export { default as tithe } from "@/assets/optimized/tithe.webp";
export { default as theBlightTreant } from "@/assets/optimized/the-blight-treant.webp";
export { default as theForgeGolem } from "@/assets/optimized/the-forge-golem.webp";
export { default as theFrostwarden } from "@/assets/optimized/the-frostwarden.webp";
export { default as thornMail } from "@/assets/optimized/thorn-mail.webp";
export { default as thunderstone } from "@/assets/optimized/thunderstone.webp";
export { default as vanguardsCrest } from "@/assets/optimized/vanguards-crest.webp";
export { default as venomArrow } from "@/assets/optimized/venom-arrow.webp";
export { default as venomFangs } from "@/assets/optimized/venom-fangs.webp";
export { default as wheatField } from "@/assets/optimized/wheat-field.webp";
export { default as willOWispCompanion } from "@/assets/optimized/will-o-wisp-companion.webp";
export { default as wish } from "@/assets/optimized/wish.webp";
export { default as wishingPotion } from "@/assets/optimized/wishing-potion.webp";
export { default as wishingWellCoin } from "@/assets/optimized/wishing-well-coin.webp";
export { default as wolfCompanion } from "@/assets/optimized/wolf-companion.webp";

export { alchemist };
export { alchemyLogo };
export { alchemyLogoArcaneMana };
export { alchemyLogoFireIron };
export { alchemyLogoFrost };
export { alchemyLogoHolyBlock };
export { alchemyLogoNatureBleed };
export { alchemyLogoPoison };
export { discardPile };
export { drawPile };
export { druid };
export { knight };
export { pointerCursor };
export { ranger };
export { rogue };
export { talentBgArmor };
export { talentBgBleed };
export { talentBgBurn };
export { talentBgCompanion };
export { talentBgForge };
export { talentBgFreeze };
export { talentBgLeech };
export { talentBgMana };
export { talentBgNature };
export { talentBgPhysical };
export { talentBgStun };
export { warlock };
export { wildcard };
export { wizard };

export { theCampaign, theLabyrinth, theWildwoods, placeholderGameMode };

export const menuLogo = alchemyLogo;
export const menuLogoVariants = [
  alchemyLogo,
  alchemyLogoArcaneMana,
  alchemyLogoFireIron,
  alchemyLogoFrost,
  alchemyLogoHolyBlock,
  alchemyLogoNatureBleed,
  alchemyLogoPoison,
];
export const pileDrawArt = drawPile;
export const pileDiscardArt = discardPile;

export const characterArt = {
  knight,
  ranger,
  rogue,
  wizard,
  alchemist,
  warlock,
  druid,
  wildcard,
} as const;

export const cursorArt = {
  pointer: pointerCursor,
} as const;

const mysteryArtModules = import.meta.glob("@/assets/optimized/mystery-*.webp", {
  eager: true,
  import: "default",
});

function mysteryEventArtKey(path: string): string {
  const filename = path.split("/").pop() ?? "";
  return filename.replace(/^mystery-/, "").replace(/\.webp$/, "");
}

export const mysteryEventArt = Object.fromEntries(
  Object.entries(mysteryArtModules)
    .filter(([path]) => !path.includes("placeholder"))
    .map(([path, url]) => [mysteryEventArtKey(path), url as string]),
) as Record<string, string>;

const assetModules = import.meta.glob("@/assets/optimized/*.webp", {
  eager: true,
  import: "default",
});
export const allGameArt = Object.entries(assetModules)
  .filter(([path]) => !path.includes("/mystery-"))
  .map(([, url]) => url as string);

export const talentBackgroundArt: Partial<Record<KeywordId, string>> = {
  physical: talentBgPhysical,
  stun: talentBgStun,
  forge: talentBgForge,
  armor: talentBgArmor,
  burn: talentBgBurn,
  bleed: talentBgBleed,
  freeze: talentBgFreeze,
  mana: talentBgMana,
  leech: talentBgLeech,
  nature: talentBgNature,
  companion: talentBgCompanion,
};
