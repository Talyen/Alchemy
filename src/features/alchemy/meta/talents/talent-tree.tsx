// Interactive talent tree — keyword-level XP progress, unlock buttons, and reveal animations.
// Depends on game-data keywords, shared UI primitives, and talent XP math.
import { Fragment, useCallback, useMemo, useState, type CSSProperties } from "react";

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

interface TalentLayoutConfig {
  radiusX: number;
  radiusY: number;
  rotate?: number;
  startOffset?: number;
}

const talentLayouts: Partial<Record<KeywordId, TalentLayoutConfig>> = {
  physical: { radiusX: 36, radiusY: 36 },
  stun: { radiusX: 40, radiusY: 20, rotate: -23 },
  forge: { radiusX: 42, radiusY: 28, rotate: -15 },
  armor: { radiusX: 34, radiusY: 34 },
  burn: { radiusX: 29, radiusY: 29 },
  bleed: { radiusX: 27, radiusY: 33, rotate: 60, startOffset: 8 },
  freeze: { radiusX: 30, radiusY: 30 },
  mana: { radiusX: 46, radiusY: 22, rotate: -24 },
  nature: { radiusX: 34, radiusY: 34 },
  companion: { radiusX: 34, radiusY: 34 },
};

const defaultLayout: TalentLayoutConfig = { radiusX: 30, radiusY: 30 };

/** Node diameter as % of the square tree container; center via calc() — not transform — so backdrop-filter can sample art. */
const TALENT_NODE_SIZE_PERCENT = 8.64;
const TALENT_NODE_CENTER_OFFSET_PERCENT = TALENT_NODE_SIZE_PERCENT / 2;

function talentNodePositionStyle(left: number, top: number): CSSProperties {
  return {
    left: `calc(${left}% - ${TALENT_NODE_CENTER_OFFSET_PERCENT}%)`,
    top: `calc(${top}% - ${TALENT_NODE_CENTER_OFFSET_PERCENT}%)`,
  };
}

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
      <div className="font-display text-base font-bold text-amber-100/75">{talent.name ?? "Talent"}</div>
      <TooltipBody className="max-w-[240px]">
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
  const Icon = keywordIcons[talent.keywordId];
  const canInteract = isChoice && !isUnlocking;

  return (
    <div
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      onClick={canInteract ? () => onUnlock?.(talent.id) : undefined}
      onKeyDown={
        canInteract
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onUnlock?.(talent.id);
              }
            }
          : undefined
      }
      className={cn(
        "talent-node-glass relative select-none w-full h-full transition-[filter,box-shadow] duration-200 outline-none rounded-full",
        canInteract && "cursor-pointer",
        isChoice && !isUnlocking ? "talent-node-glass--choice" : "talent-node-glass--bordered",
        isUnlocking && "talent-node-unlocking",
        isSettling && "talent-node-unlocked-settle",
        !isUnlocked && !isChoice && !isUnlocking && "brightness-[0.8]",
      )}
      style={{ "--talent-glass-accent": baseColor } as CSSProperties}
      aria-label={
        isChoice ? `Unlock talent: ${talent.name ? `${talent.name} — ` : ""}${talent.description}` : undefined
      }
    >
      {isChoice && !isUnlocking && (
        <ShineBorder shineColor={shineColors} borderWidth={3} duration={8} className="rounded-full" />
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        {isUnlocked || isChoice || isUnlocking ? (
          <Icon className={cn("h-7 w-7", def?.colorClass)} />
        ) : (
          <Lock className="h-7 w-7 text-muted-foreground" />
        )}
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

  const { radiusX, radiusY, rotate, startOffset } = talentLayouts[keywordId] ?? defaultLayout;
  const rotateRad = ((rotate ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotateRad);
  const sinR = Math.sin(rotateRad);

  const positions = useMemo(() => {
    if (N === 0) return [];
    if (N === 1) return [{ left: 50, top: 50 }];

    const offset = startOffset ?? 0;
    return Array.from({ length: N }, (_, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * ((i + offset) % N)) / N;
      const dx = radiusX * Math.cos(angle);
      const dy = radiusY * Math.sin(angle);
      return {
        left: 50 + dx * cosR - dy * sinR,
        top: 50 + dx * sinR + dy * cosR,
      };
    });
  }, [N, radiusX, radiusY, cosR, sinR, startOffset]);

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
