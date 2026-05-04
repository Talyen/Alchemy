import { useState, Fragment } from "react";
import type { KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/lib/game-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keywordIcons } from "../config";
import { KeywordTag } from "./keyword-tag";
import { tokenizeDescription } from "../utils";
import type { TalentDefinition } from "../talent-pool";

const keywordBorderClasses: Record<KeywordId, string> = {
  physical: "border-slate-300",
  stun: "border-amber-300",
  block: "border-sky-300",
  forge: "border-yellow-300",
  armor: "border-yellow-200",
  health: "border-rose-400",
  burn: "border-orange-400",
  gold: "border-yellow-300",
  holy: "border-amber-200",
  wish: "border-fuchsia-300",
  ailment: "border-violet-300",
  consume: "border-zinc-300",
  poison: "border-lime-300",
  bleed: "border-red-400",
  leech: "border-pink-300",
  freeze: "border-cyan-300",
  mana: "border-sky-400",
};

function renderDescription(description: string) {
  const parts = tokenizeDescription(description);
  return parts.map((part, i) => {
    if (part.keywordId) {
      return (
        <span key={i} className={keywordDefinitions[part.keywordId]?.colorClass}>
          {part.text}
        </span>
      );
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}

export function TalentChoicesInline({
  choices,
  onChoose,
}: {
  choices: TalentDefinition[];
  onChoose: (talent: TalentDefinition) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTalent = choices.find((t) => t.id === selectedId) ?? null;

  function handleConfirm() {
    if (selectedTalent) {
      onChoose(selectedTalent);
      setSelectedId(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-center text-sm font-semibold text-amber-300">
        Choose a talent to unlock
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {choices.map((talent) => {
          const borderClass = keywordBorderClasses[talent.keywordId] ?? "border-border/60";
          const textClass = keywordDefinitions[talent.keywordId]?.colorClass ?? "text-foreground";
          const Icon = keywordIcons[talent.keywordId];
          const isSelected = selectedId === talent.id;
          return (
            <button
              key={talent.id}
              type="button"
              onClick={() => setSelectedId(talent.id)}
              className={cn(
                "flex items-center gap-2 flex-1 min-w-[180px] max-w-[240px] rounded-[14px] border bg-black px-4 py-3 text-left text-sm transition-all",
                isSelected
                  ? `${borderClass} ring-1 ring-inset ring-white/20`
                  : `${borderClass}/30 hover:${borderClass}/60`,
              )}
            >
              {Icon ? <Icon className={cn("h-4 w-4 shrink-0", textClass)} /> : null}
              <span className="font-semibold leading-snug text-muted-foreground">
                {renderDescription(talent.description)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex h-10 items-center justify-center">
        {selectedTalent ? (
          <Button onClick={handleConfirm}>
            Confirm
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TalentList({
  unlockedTalents,
  allTalents,
}: {
  unlockedTalents: TalentDefinition[];
  allTalents: TalentDefinition[];
}) {
  const unlockedIds = new Set(unlockedTalents.map((t) => t.id));

  return (
    <div>
      {allTalents.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {allTalents.map((talent) => {
            const isUnlocked = unlockedIds.has(talent.id);
            const borderClass = keywordBorderClasses[talent.keywordId] ?? "border-border/60";
            const Icon = keywordIcons[talent.keywordId];

            if (isUnlocked) {
              return (
                <div
                  key={talent.id}
                  className={cn(
                    "flex items-center gap-2 rounded-[12px] border bg-black px-3 py-2.5 text-sm font-semibold leading-snug",
                    `${borderClass}/30`,
                  )}
                >
                  {Icon ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5">
                      <Icon className="h-3 w-3" />
                    </div>
                  ) : null}
                  <span>{renderDescription(talent.description)}</span>
                </div>
              );
            }

            return (
              <div
                key={talent.id}
                className={cn(
                  "flex items-center gap-2 rounded-[12px] border border-dashed px-3 py-2.5 text-sm font-semibold leading-snug",
                  "border-border/20 bg-black/40 text-muted-foreground/40",
                )}
              >
                {Icon ? (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.03]">
                    <Icon className="h-3 w-3 opacity-30" />
                  </div>
                ) : null}
                <span>Undiscovered</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No talents available.
        </p>
      )}
    </div>
  );
}

export function TalentKeywordButton({
  keywordId,
  hasUnspent,
  isSelected,
  onClick,
}: {
  keywordId: KeywordId;
  hasUnspent: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative rounded-full border px-3 py-1.5 text-sm font-semibold inline-flex items-center gap-1.5",
        isSelected
          ? "border-primary bg-primary/20 text-primary"
          : "border-border/80 bg-card text-foreground",
      )}
      onClick={onClick}
    >
      <KeywordTag keywordId={keywordId} />
      {hasUnspent ? (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
      ) : null}
    </button>
  );
}
