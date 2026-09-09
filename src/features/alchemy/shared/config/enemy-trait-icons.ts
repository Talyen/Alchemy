import {
  Anvil,
  Bone,
  Bug,
  Coins,
  Droplet,
  Droplets,
  Flame,
  Heart,
  HeartCrack,
  Mountain,
  PawPrint,
  Scale,
  Shield,
  Snowflake,
  Sparkles,
  Sprout,
  Stars,
  Sun,
  Swords,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { EnemyTrait } from "./game-data-catalog";
import { extractKeywordIds } from "./keywords";
import { keywordIcons } from "./metadata";

const traitIcons: Record<string, LucideIcon> = {
  banshee: Volume2,
  bandit: Swords,
  "blood-cultist": Droplet,
  brawler: Stars,
  vampire: Droplets,
  "zealot-enemy": Flame,
  inquisitor: Scale,
  cleric: Heart,
  paladin: Shield,
  "fire-imp": Flame,
  "giant-spider": Bug,
  "winter-wolf": Snowflake,
  "dire-wolf": PawPrint,
  hellhound: Flame,
  "stone-golem": Shield,
  "ice-wraith": Snowflake,
  "frost-elemental": Snowflake,
  "rusting-carapace": Anvil,
  "starting-block": Shield,
  "glacial-shell": Snowflake,
  "iron-hide": Shield,
  seraph: Sun,
  "stone-titan": Mountain,
  "blood-countess": HeartCrack,
  regeneration: Sprout,
  "brittle-bones": Bone,
  "trinket-hoarder": Coins,
  "gold-trove": Coins,
  amorphous: Droplet,
  "cinder-skin": Flame,
};

export function getEnemyTraitIcon(trait: EnemyTrait, encounterModifier = false): LucideIcon {
  const icon = Object.hasOwn(traitIcons, trait.id) ? traitIcons[trait.id] : undefined;
  if (icon) return icon;
  const keyword = extractKeywordIds(trait.description)[0];
  return keyword ? keywordIcons[keyword] : encounterModifier ? Sparkles : Shield;
}
