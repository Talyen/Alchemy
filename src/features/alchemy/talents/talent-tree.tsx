// Interactive talent tree — keyword-level XP progress, unlock buttons, and reveal animations.
// Depends on game-data keywords, shared UI primitives, and talent XP math.
import { Fragment, useMemo } from "react";

import { Lock } from "lucide-react";
import { keywordDefinitions } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import type { TalentDefinition } from "@/lib/game-data";
import { keywordIcons, popupClassName } from "../config";
import { tokenizeDescription } from "../utils";
import { ShineBorder } from "@/components/ui/shine-border";
import type { KeywordId } from "@/lib/game-data";

interface TalentLayoutConfig {
  radiusX: number;
  radiusY: number;
  rotate?: number;
  startOffset?: number;
}

const talentLayouts: Partial<Record<KeywordId, TalentLayoutConfig>> = {
  physical: { radiusX: 23, radiusY: 23 },
  stun: { radiusX: 40, radiusY: 20, rotate: -23 },
  forge: { radiusX: 42, radiusY: 28, rotate: -15 },
  armor: { radiusX: 34, radiusY: 34 },
  burn: { radiusX: 19, radiusY: 19 },
  bleed: { radiusX: 27, radiusY: 33, rotate: 60, startOffset: 8 },
  freeze: { radiusX: 30, radiusY: 30 },
  mana: { radiusX: 46, radiusY: 22, rotate: -24 },
  nature: { radiusX: 34, radiusY: 34 },
  companion: { radiusX: 34, radiusY: 34 },
};

const defaultLayout: TalentLayoutConfig = { radiusX: 30, radiusY: 30 };

export interface TalentLayoutProps {
  keywordId: KeywordId;
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
  choices: TalentDefinition[] | null;
  onUnlock?: (talentId: string) => void;
}

function TalentNode({
  talent,
  isUnlocked,
  isChoice,
  onUnlock,
}: {
  talent: TalentDefinition;
  isUnlocked: boolean;
  isChoice: boolean;
  onUnlock: ((talentId: string) => void) | undefined;
}) {
  const def = keywordDefinitions[talent.keywordId];
  const shineColors = def?.shineColors ?? ["#fcd34d", "#d97706", "#fcd34d"];
  const baseColor = shineColors[0];
  const Icon = keywordIcons[talent.keywordId];
  const descParts = tokenizeDescription(talent.description);

  return (
    <>
      {/* Tooltip Popup */}
      <div
        className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover:opacity-100 z-50")}
      >
        <div className="font-display text-base font-bold text-amber-100/75">Talent</div>
        <div className="mt-2 text-sm leading-6 text-muted-foreground max-w-[240px]">
          {descParts.map((part, i) =>
            part.keywordId ? (
              <span key={i} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
                {part.text}
              </span>
            ) : (
              <Fragment key={i}>{part.text}</Fragment>
            ),
          )}
        </div>
      </div>

      <div
        role={isChoice ? "button" : undefined}
        tabIndex={isChoice ? 0 : undefined}
        onClick={isChoice ? () => onUnlock?.(talent.id) : undefined}
        onKeyDown={
          isChoice
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onUnlock?.(talent.id);
                }
              }
            : undefined
        }
        className={cn(
          "relative select-none w-full h-full transition-all duration-200 outline-none rounded-full cursor-pointer hover:scale-105 active:scale-95",
          !isUnlocked && !isChoice && "brightness-[0.55]",
        )}
        style={{
          borderColor: baseColor,
          borderWidth: isChoice ? 0 : "2px",
          borderStyle: "solid",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          backgroundColor: "hsl(var(--background) / 0.2)",
          backgroundImage: "linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))",
          boxShadow: isChoice
            ? `
              inset 0 1.5px 1px rgba(255, 255, 255, 0.25),
              inset 0 -1px 1px rgba(0, 0, 0, 0.3),
              0 4px 16px rgba(0, 0, 0, 0.6)
            `.trim()
            : `
              inset 0 1.5px 1px rgba(255, 255, 255, 0.12),
              inset 0 -1px 1px rgba(0, 0, 0, 0.3),
              0 4px 12px rgba(0, 0, 0, 0.4)
            `.trim(),
        }}
        aria-label={isChoice ? `Unlock talent: ${talent.description}` : undefined}
      >
        {isChoice && <ShineBorder shineColor={shineColors} borderWidth={3} duration={8} className="rounded-full" />}
        {/* Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          {isUnlocked || isChoice ? (
            <Icon className={cn("h-7 w-7", def?.colorClass)} />
          ) : (
            <Lock className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
      </div>
    </>
  );
}

export function TalentTree({ keywordId, unlockedTalents, allTalents, choices, onUnlock }: TalentLayoutProps) {
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

  if (N === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No talents available.</p>;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative aspect-square h-full max-w-full">
        {nodes.map((talent, i) => {
          const pos = positions[i];
          if (!pos) return null;
          return (
            <div key={talent.id} className="group">
              <div
                className="absolute group-hover:z-[60] w-[8.64%] h-[8.64%]"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  transform: "translate(-50%,-50%)",
                }}
              >
                <TalentNode
                  talent={talent}
                  isUnlocked={unlockedIds.has(talent.id)}
                  isChoice={choiceIds.has(talent.id)}
                  onUnlock={onUnlock ? () => onUnlock(talent.id) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
