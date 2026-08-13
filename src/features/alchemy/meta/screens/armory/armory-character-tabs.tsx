import {
  Crosshair,
  Flame,
  FlaskConical,
  Leaf,
  Lock,
  Shield,
  Sparkles,
  Swords,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import {
  characters,
  isCharacterUnlocked,
  keywordDefinitions,
  type CharacterId,
  type KeywordId,
} from "@/features/alchemy/shared/config/game-data-catalog";
import { TabBar } from "../../../shared/ui/shared-ui";

const CHARACTER_ICONS: Record<CharacterId, LucideIcon> = {
  knight: Shield,
  rogue: Swords,
  wizard: WandSparkles,
  ranger: Crosshair,
  alchemist: FlaskConical,
  warlock: Flame,
  druid: Leaf,
  wildcard: Sparkles,
};

const CHARACTER_KEYWORDS: Record<CharacterId, KeywordId> = {
  knight: "forge",
  rogue: "bleed",
  wizard: "mana",
  ranger: "archery",
  alchemist: "poison",
  warlock: "leech",
  druid: "nature",
  wildcard: "wish",
};

export function ArmoryCharacterTabs({
  activeTab,
  finishedRunCharacters,
  onSelectTab,
}: {
  activeTab: CharacterId;
  finishedRunCharacters: CharacterId[];
  onSelectTab: (id: CharacterId) => void;
}) {
  return (
    <div data-testid="armory-character-selector" className="mt-4 w-full [scrollbar-width:none] overflow-x-auto py-2">
      <div className="mx-auto w-max min-w-full px-1">
        <TabBar
          tabs={(Object.keys(characters) as CharacterId[]).map((id) => {
            const isLocked = !isCharacterUnlocked(id, finishedRunCharacters);
            return {
              id,
              label: characters[id].name,
              icon: isLocked ? Lock : CHARACTER_ICONS[id],
              disabled: isLocked,
              ...(isLocked ? {} : { iconClassName: keywordDefinitions[CHARACTER_KEYWORDS[id]].colorClass }),
            };
          })}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />
      </div>
    </div>
  );
}
