// Interactive talent tree — keyword-level XP progress, unlock buttons, and reveal animations.
// Depends on game-data keywords, shared UI primitives, and talent XP math.
import { Fragment, useCallback, useMemo, useState, type ComponentType, type CSSProperties } from "react";

import { Lock } from "lucide-react";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { TalentDefinition } from "@/lib/game-data";
import { getKeywordShineColors, keywordIcons } from "@/features/alchemy/shared/config";
import { tokenizeDescription } from "../../shared/utils";
import { TooltipPanel, TooltipBody, useTooltipViewportClamp } from "../../shared/ui/tooltip-panel";
import { ShineBorder } from "@/components/ui/shine-border";
import type { KeywordId } from "@/lib/game-data";
import { TALENT_UNLOCK_ANIMATION_MS, TALENT_UNLOCK_SETTLE_MS } from "@/lib/game-constants";
import { delay } from "@/lib/animation/game-timer";
import { TalentUnlockBurst } from "./talent-unlock-burst";
import { computeTalentNodePositions, talentNodePositionStyle } from "./talent-positions";

export interface TalentLayoutProps {
  keywordId: KeywordId;
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
  choices: TalentDefinition[] | null;
  onUnlock?: (talentId: string) => void;
  onUnlockBegin?: (talentId: string) => void;
}

function TalentNodeTooltip({ talent }: { talent: TalentDefinition }) {
  const { ref, flip, dx } = useTooltipViewportClamp(8, talent.id);
  const descParts = tokenizeDescription(talent.description);

  return (
    <TooltipPanel
      ref={ref}
      flip={flip}
      width="w-60"
      visible
      className="z-50"
      style={dx !== 0 ? { marginLeft: dx } : undefined}
    >
      <div className="font-sans text-base font-bold text-amber-100/75">{talent.name ?? "Talent"}</div>
      <TooltipBody className="max-w-60">
        {descParts.map((part, i) =>
          part.keywordId ? (
            <span key={i} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
              {part.text}
            </span>
          ) : (
            <Fragment key={i}>{part.text}</Fragment>
          ),
        )}
      </TooltipBody>
    </TooltipPanel>
  );
}

function TalentNodeIcon({
  revealed,
  keywordColor,
  Icon: IconComp,
}: {
  revealed: boolean;
  keywordColor?: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  if (revealed) return <IconComp className={cn("h-7 w-7", keywordColor)} />;
  return <Lock className="h-7 w-7 text-muted-foreground" />;
}

function getTalentNodeClassName(
  canInteract: boolean,
  isChoice: boolean,
  isUnlocking: boolean,
  isSettling: boolean,
  isUnlocked: boolean,
): string {
  return cn(
    "talent-node-glass relative select-none w-full h-full transition-[filter,box-shadow] duration-200 outline-none rounded-full state-fade",
    canInteract && "cursor-pointer",
    isChoice && !isUnlocking ? "talent-node-glass--choice" : "talent-node-glass--bordered",
    isUnlocking && "talent-node-unlocking",
    isSettling && "talent-node-unlocked-settle",
    !isUnlocked && !isChoice && !isUnlocking && "brightness-[0.8]",
  );
}

function getTalentAriaLabel(isChoice: boolean, talent: TalentDefinition): string | undefined {
  if (!isChoice) return undefined;
  const namePrefix = talent.name ? `${talent.name} — ` : "";
  return `Unlock talent: ${namePrefix}${talent.description}`;
}

function TalentNodeVisual({
  isChoice,
  isUnlocking,
  shineColors,
}: {
  isChoice: boolean;
  isUnlocking: boolean;
  shineColors: readonly string[];
}) {
  if (!isChoice || isUnlocking) return null;
  return <ShineBorder shineColor={shineColors} borderWidth={3} duration={8} className="rounded-full" />;
}

function TalentNode({
  talent,
  isUnlocked,
  isChoice,
  isUnlocking,
  isSettling,
  onUnlock,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isChoice: boolean;
  isUnlocking: boolean;
  isSettling: boolean;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const shineColors = getKeywordShineColors(talent.keywordId);
  const baseColor = shineColors[0];
  const Icon = talent.icon ?? keywordIcons[talent.keywordId];
  const canInteract = isChoice && !isUnlocking;
  const revealed = isUnlocked || isChoice || isUnlocking;

  const handleKeyDown = canInteract
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onUnlock?.(talent.id);
        }
      }
    : undefined;

  return (
    <div
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      onClick={canInteract ? () => onUnlock?.(talent.id) : undefined}
      onKeyDown={handleKeyDown}
      className={getTalentNodeClassName(canInteract, isChoice, isUnlocking, isSettling, isUnlocked)}
      style={{ "--talent-glass-accent": baseColor } as CSSProperties}
      aria-label={getTalentAriaLabel(isChoice, talent)}
    >
      <TalentNodeVisual isChoice={isChoice} isUnlocking={isUnlocking} shineColors={shineColors} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <TalentNodeIcon revealed={revealed} keywordColor={def?.colorClass} Icon={Icon} />
      </div>
    </div>
  );
}

export function TalentTree({
  keywordId,
  unlockedTalents,
  allTalents,
  choices,
  onUnlock,
  onUnlockBegin,
}: TalentLayoutProps) {
  const [hoveredTalentId, setHoveredTalentId] = useState<string | null>(null);
  const [unlockingTalentId, setUnlockingTalentId] = useState<string | null>(null);
  const [settlingTalentId, setSettlingTalentId] = useState<string | null>(null);
  const unlockedIds = useMemo(() => new Set(unlockedTalents.map((t) => t.id)), [unlockedTalents]);
  const choiceIds = useMemo(() => new Set(choices?.map((c) => c.id) ?? []), [choices]);
  const nodes = allTalents;
  const N = nodes.length;

  const positions = useMemo(() => computeTalentNodePositions(keywordId, nodes.length), [keywordId, nodes.length]);

  const handleUnlock = useCallback(
    async (talentId: string) => {
      if (!onUnlock || unlockingTalentId) return;

      onUnlockBegin?.(talentId);
      setUnlockingTalentId(talentId);
      setHoveredTalentId(null);

      await delay(TALENT_UNLOCK_ANIMATION_MS);
      onUnlock(talentId);
      setUnlockingTalentId(null);
      setSettlingTalentId(talentId);

      await delay(TALENT_UNLOCK_SETTLE_MS);
      setSettlingTalentId((current) => (current === talentId ? null : current));
    },
    [onUnlock, onUnlockBegin, unlockingTalentId],
  );

  const hoveredIndex = hoveredTalentId ? nodes.findIndex((t) => t.id === hoveredTalentId) : -1;
  const hoveredTalent = hoveredIndex >= 0 ? nodes[hoveredIndex] : null;
  const hoveredPos = hoveredIndex >= 0 ? positions[hoveredIndex] : null;

  if (N === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative aspect-square h-full max-w-full">
        {nodes.map((talent, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const isUnlocking = unlockingTalentId === talent.id;
          const isSettling = settlingTalentId === talent.id;
          const accentColor = getKeywordShineColors(talent.keywordId)[0]!;

          return (
            <div
              key={talent.id}
              className={cn("absolute w-[8.64%] h-[8.64%]", (hoveredTalentId === talent.id || isUnlocking) && "z-[60]")}
              style={talentNodePositionStyle(pos.left, pos.top)}
              onPointerEnter={() => {
                if (!unlockingTalentId) setHoveredTalentId(talent.id);
              }}
              onPointerLeave={() => setHoveredTalentId(null)}
            >
              {isUnlocking ? <TalentUnlockBurst accentColor={accentColor} /> : null}
              <TalentNode
                talent={talent}
                isUnlocked={unlockedIds.has(talent.id)}
                isChoice={choiceIds.has(talent.id)}
                isUnlocking={isUnlocking}
                isSettling={isSettling}
                onUnlock={() => void handleUnlock(talent.id)}
              />
            </div>
          );
        })}

        {hoveredTalent && hoveredPos && !unlockingTalentId ? (
          <div
            key={hoveredTalent.id}
            className="pointer-events-none absolute z-[70] w-[8.64%] h-[8.64%]"
            style={talentNodePositionStyle(hoveredPos.left, hoveredPos.top)}
          >
            <TalentNodeTooltip talent={hoveredTalent} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
