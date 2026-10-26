import { FlaskRound, Heart, HeartPulse, Tag, WandSparkles, type LucideIcon } from "lucide-react";
import { buildDescriptionMessage, keywordDefinitions, type KeywordId } from "@/lib/game-data";
import { extractKeywordIds } from "@/lib/keyword-text";
import { cn } from "@/lib/utils";
import { keywordIcons } from "../../../shared/config/metadata";
import { HomesteadResourceArtwork, matTextColor, type HomesteadResource } from "../../../shared/ui/material-icons";
import type { HomesteadNodeModel } from "./node-model";

interface EffectIcon {
  Icon: LucideIcon;
  colorClass: string;
}

function keywordIcon(keyword: KeywordId): EffectIcon {
  return {
    Icon: keyword === "health" ? HeartPulse : keywordIcons[keyword],
    colorClass: keywordDefinitions[keyword].colorClass,
  };
}

function resourceIcon(line: string): { resource: HomesteadResource } | undefined {
  const message = buildDescriptionMessage([{ text: line }], true);
  for (const slot of Object.values(message.slots)) {
    if ("resourceId" in slot) return { resource: slot.resourceId as HomesteadResource };
  }
  return undefined;
}

function getBonusIcon(
  node: HomesteadNodeModel,
  line: string,
  production: boolean,
): EffectIcon | { resource: HomesteadResource } | undefined {
  if (production) return resourceIcon(line);
  if (!node.companion) {
    switch (node.id) {
      case "alchemy-lab":
        return { Icon: FlaskRound, colorClass: matTextColor.herbs };
      case "chicken-coop":
        return { Icon: Heart, colorClass: keywordDefinitions.health.colorClass };
      case "library":
      case "botanical-distillation":
        return { Icon: Tag, colorClass: keywordDefinitions.gold.colorClass };
      case "detect-magic":
        return { Icon: WandSparkles, colorClass: matTextColor.gems };
    }
  }
  // The first authored keyword is the primary effect, before localization or
  // secondary Forge/Mana scaling. Resource gains use their existing artwork.
  const keyword = extractKeywordIds(line)[0];
  if (keyword === "gold") return resourceIcon(line);
  if (keyword) return keywordIcon(keyword);
  if (node.companion) return keywordIcon("companion");
  return undefined;
}

export function HomesteadBonusIcon({
  node,
  line,
  production,
}: {
  node: HomesteadNodeModel;
  line: string;
  production: boolean;
}) {
  const icon = getBonusIcon(node, line, production);
  if (!icon) return null;
  return (
    <span className="inline-flex h-6 w-5 shrink-0 items-center justify-center">
      {"resource" in icon ? (
        <HomesteadResourceArtwork resource={icon.resource} className="max-w-none" />
      ) : (
        <icon.Icon aria-hidden="true" className={cn("h-5 w-5", icon.colorClass)} />
      )}
    </span>
  );
}
