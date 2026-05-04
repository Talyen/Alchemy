import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Coins, House, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import { campfire, characters, characterArt, keywordDefinitions, type BattleCard, type CharacterGender, type CharacterId, type KeywordId } from "@/lib/game-data";
import { setMusicVolume } from "@/lib/audio";

import { cn } from "@/lib/utils";
import { computeTalentPoints, xpForNextPoint, xpToNextPoint, type TalentXP } from "@/lib/talents";
import { battleCardWidthClass, cardSurfaceClass, handCardWidthClass, keywordIcons, resolutionOptions, staticCardTransform } from "../config";
import { BattleCardButton, CollectionGrid, CollectionPagination, CollectionTabs, DestinationChoices, PlaceholderScreen, ResolutionSelect, TalentChoicesInline, TalentKeywordButton, TalentList } from "../components";
import { getCollectionTotalPages } from "../ui/collection-ui";
import { ConfirmationDialog } from "../ui/shared-ui";
import { KeywordTag } from "../ui/keyword-tag";
import type { CollectionTab, Destination, ResolutionOption } from "../types";
import type { UnlockedTalents, TalentDefinition } from "../talent-pool";
import { getTalentsForKeyword, sampleTalentChoices } from "../talent-pool";
import { clearTiltFromEvent, getHoverId, setTiltFromEvent } from "../utils";
import { useShimmerController } from "../hooks";

export function MenuScreen({ onPlay, onCollection, onOptions, onTalents, logoSrc, hasActiveBattle }: { onPlay: () => void; onCollection: () => void; onOptions: () => void; onTalents: () => void; logoSrc: string; hasActiveBattle?: boolean }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
      <img src={logoSrc} alt="Alchemy logo" className="w-full max-w-[430px] object-contain" loading="eager" />

      <div className="grid gap-3">
        <Button size="lg" className="w-56 justify-center text-base" onClick={onPlay}>
          {hasActiveBattle ? "Resume Run" : "Play"}
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onCollection}>
          Collection
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onOptions}>
          Options
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={onTalents}>
          Talents
        </Button>
        <Button size="lg" variant="outline" className="w-56 justify-center text-base" onClick={() => window.close()}>
          Quit
        </Button>
      </div>
    </div>
  );
}

const defaultGender: Record<CharacterId, CharacterGender> = {
  knight: "male",
  rogue: "male",
  wizard: "female",
};

export function CharacterSelectScreen({ onConfirm, onBack }: { onConfirm: (characterId: CharacterId, gender: CharacterGender) => void; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState<CharacterId | null>(null);
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const charIds = Object.keys(characters) as CharacterId[];
  const selectedChar = selectedId ? characters[selectedId] : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      <h1 className="text-4xl font-semibold text-foreground">Choose Your Hero</h1>

      <div className="flex flex-wrap items-start justify-center gap-12">
        {charIds.map((id) => {
          const char = characters[id];
          const gender = defaultGender[id];
          const art = characterArt[char.id][gender];
          const isSelected = selectedId === id;
          const isShimmer = shimmerState?.cardId === id;

          return (
            <div key={id} className="flex flex-col items-center gap-3 rounded-[26px] border border-border/60 bg-card/60 px-6 pb-6 pt-5">
              <button
                type="button"
                className={cn(
                  "tilt-surface relative rounded-[22px]",
                  battleCardWidthClass,
                  isSelected && "ring-2 ring-primary",
                )}
                style={{ "--card-base-transform": staticCardTransform } as React.CSSProperties}
                data-tilt-strength="15"
                onMouseMove={setTiltFromEvent}
                onMouseEnter={() => maybeTriggerShimmer(id)}
                onMouseLeave={clearTiltFromEvent}
                onClick={() => setSelectedId(id)}
              >
                <div className={cn("pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[22px]", isShimmer ? "card-shimmer-active" : "")}>
                  <div key={isShimmer ? shimmerState?.token : undefined} className={cn("card-shimmer-sweep", isShimmer ? "opacity-100" : "opacity-0")} />
                </div>
                <img
                  src={art}
                  alt={char.name}
                  className={cn(cardSurfaceClass, "w-full rounded-[22px]")}
                />
              </button>

              <p className="text-2xl font-semibold text-foreground">{char.name}</p>

              <div className="flex flex-wrap justify-center gap-1">
                {char.keywords.map((kw) => (
                  <KeywordTag key={kw} keywordId={kw} pill />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-4">
        <Button
          size="lg"
          className="w-40"
          disabled={!selectedChar}
          onClick={() => {
            if (selectedChar) {
              onConfirm(selectedChar.id, defaultGender[selectedChar.id]);
            }
          }}
        >
          Continue
        </Button>
        <Button size="lg" variant="outline" className="w-40" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

export function RewardsScreen({
  rewardChoices,
  rewardGold,
  hoveredCardId,
  onHoverChange,
  shimmerState,
  onHoverShimmer,
  selectedRewardId,
  onSelectReward,
  onAddCard,
  onSkip,
}: {
  rewardChoices: BattleCard[];
  rewardGold: number;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
  selectedRewardId: string | null;
  onSelectReward: (cardId: string) => void;
  onAddCard: () => void;
  onSkip: () => void;
}) {
  const selectedRewardCard = rewardChoices.find((card) => card.id === selectedRewardId) ?? null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 className="text-4xl font-semibold text-foreground">Victory!</h1>
        <p className="mt-3 text-base text-muted-foreground">Choose a Card to add to your Deck</p>

        <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
          {rewardChoices.map((card) => {
            const hoverId = getHoverId("reward", card.id);

            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={hoveredCardId === hoverId}
                onHoverStart={() => {
                  onHoverChange(hoverId);
                  onHoverShimmer(hoverId);
                }}
                onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
                onClick={() => onSelectReward(card.id)}
                ariaLabel={`Select ${card.title}`}
                tiltStrength={15}
                shimmerActive={shimmerState?.cardId === hoverId}
                shimmerToken={shimmerState?.token}
                className="w-[clamp(189px,18.7vh,286px)]"
                wrapperClassName="relative flex justify-center"
                selected={selectedRewardId === card.id}
              />
            );
          })}
        </div>

        <div className="mt-8 text-center text-lg font-medium text-yellow-300">
          <span className="inline-flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Found {rewardGold} Gold
          </span>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="min-w-40" disabled={!selectedRewardCard} onClick={onAddCard}>
            Add Card
          </Button>
          <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DestinationScreen({
  destinationOptions,
  onChoose,
  destinationButtonRefs,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  destinationButtonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <h1 className="text-4xl font-semibold text-foreground">
          Choose Destination
        </h1>

        <DestinationChoices
          destinationOptions={destinationOptions}
          onChoose={onChoose}
          buttonRefs={destinationButtonRefs}
        />
      </div>
    </div>
  );
}

export function CampfireScreen({
  playerHealth,
  maxHp,
  onContinue,
}: {
  playerHealth: number;
  maxHp: number;
  onContinue: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [displayHp, setDisplayHp] = useState(playerHealth);
  const [done, setDone] = useState(false);

  function handleRest() {
    setResting(true);
    const targetHp = Math.min(maxHp, playerHealth + Math.floor(maxHp * 0.3));
    const start = playerHealth;
    const duration = 1200;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const current = Math.round(start + (targetHp - start) * t);
      setDisplayHp(current);
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setDone(true);
      }
    }

    requestAnimationFrame(animate);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 text-center">
      <img src={campfire} alt="Campfire" className="w-full max-w-[400px] object-contain" />

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">HP</span>
          <span className="text-muted-foreground">{displayHp} / {maxHp}</span>
        </div>
        <div className="mt-2 h-4 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-100 ease-linear"
            style={{ width: `${(displayHp / maxHp) * 100}%` }}
          />
        </div>
      </div>

      {!resting ? (
        <Button size="lg" onClick={handleRest}>
          Rest
        </Button>
      ) : null}

      {done ? (
        <Button size="lg" variant="outline" onClick={onContinue}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

export function OptionsScreen({
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  selectedResolution,
  onResolutionChange,
  showClearSaveConfirm,
  onOpenClearSaveConfirm,
  onCloseClearSaveConfirm,
  onConfirmClearSave,
  musicVol,
  sfxVol,
  onMusicVolChange,
  onSfxVolChange,
}: {
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  selectedResolution: ResolutionOption;
  onResolutionChange: (resolution: ResolutionOption) => void;
  showClearSaveConfirm: boolean;
  onOpenClearSaveConfirm: () => void;
  onCloseClearSaveConfirm: () => void;
  onConfirmClearSave: () => void;
  musicVol: number;
  sfxVol: number;
  onMusicVolChange: (v: number) => void;
  onSfxVolChange: (v: number) => void;
}) {
  const [tab, setTab] = useState<"display" | "sound" | "other">("display");

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="alchemy-shell mt-6 mb-auto flex w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" />
            Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" />
              Return to Battle
            </Button>
          ) : null}
        </div>

        <h1 className="mt-8 text-center text-3xl font-semibold text-foreground">Options</h1>

        <div className="mt-6 flex justify-center gap-2">
          {(["display", "sound", "other"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold capitalize",
                tab === t
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/80 bg-card text-foreground",
              )}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-6 text-left">
          {tab === "display" ? <ResolutionSelect selectedResolution={selectedResolution} resolutionOptions={resolutionOptions} onChange={onResolutionChange} /> : null}

          {tab === "sound" ? (
            <div className="space-y-5">
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <p className="text-sm font-semibold text-foreground">Music Volume</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicVol}
                  onChange={(e) => {
                    onMusicVolChange(Number(e.target.value));
                    setMusicVolume(Number(e.target.value) / 100);
                  }}
                  className="mt-3 w-full accent-primary"
                />
              </div>
              <div className="surface-muted rounded-[22px] border border-border/70 p-5">
                <p className="text-sm font-semibold text-foreground">Sound Effects Volume</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxVol}
                  onChange={(e) => onSfxVolChange(Number(e.target.value))}
                  className="mt-3 w-full accent-primary"
                />
              </div>
            </div>
          ) : null}

          {tab === "other" ? (
            <div className="surface-muted rounded-[22px] border border-border/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Save Data</p>
                  <p className="mt-1 text-sm text-muted-foreground">Clear discovered collection progress and saved options.</p>
                </div>
                <Button variant="destructive" onClick={onOpenClearSaveConfirm}>
                  Clear Save Data
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showClearSaveConfirm ? (
        <ConfirmationDialog
          title="Clear Save Data?"
          description="This will reset your saved resolution setting and all discovered collection progress. This cannot be undone."
          confirmLabel="Clear Save Data"
          onConfirm={onConfirmClearSave}
          onCancel={onCloseClearSaveConfirm}
        />
      ) : null}
    </div>
  );
}

export function CollectionScreen({
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  collectionTab,
  onSelectTab,
  hoveredCardId,
  onHoverChange,
  discoveredCardIds,
  encounteredEnemyIds,
  discoveredTrinketIds,
  page,
  onPageChange,
}: {
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  collectionTab: CollectionTab;
  onSelectTab: (tab: CollectionTab) => void;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const totalPages = getCollectionTotalPages(collectionTab);

  return (
    <div className="alchemy-shell m-4 flex h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-[1620px] flex-col items-center justify-start overflow-visible rounded-[30px] border border-border/80 px-8 py-8 text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" onClick={onMainMenu}>
          <House className="h-4 w-4" />
          Main Menu
        </Button>
        {hasActiveBattle ? (
          <Button onClick={onReturnToBattle}>
            <Swords className="h-4 w-4" />
            Return to Battle
          </Button>
        ) : null}
      </div>

      <h1 className="mt-8 min-h-[44px] text-4xl font-semibold text-foreground">Collection</h1>
      <CollectionTabs collectionTab={collectionTab} onSelectTab={onSelectTab} />

      <div className="mt-12 flex min-h-[640px] flex-col items-center overflow-visible">
        <CollectionGrid
          collectionTab={collectionTab}
          hoveredCardId={hoveredCardId}
          discoveredCardIds={discoveredCardIds}
          encounteredEnemyIds={encounteredEnemyIds}
          discoveredTrinketIds={discoveredTrinketIds}
          onHoverChange={onHoverChange}
          page={page}
          shimmerState={shimmerState}
          onHoverShimmer={maybeTriggerShimmer}
        />
        <CollectionPagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

export function TalentsScreen({
  hasActiveBattle,
  onMainMenu,
  onReturnToBattle,
  talentXP,
  runTalentXP,
  unlockedTalents,
  onUnlockTalent,
  onResetTalents,
}: {
  hasActiveBattle: boolean;
  onMainMenu: () => void;
  onReturnToBattle: () => void;
  talentXP: TalentXP;
  runTalentXP?: TalentXP;
  unlockedTalents: UnlockedTalents;
  onUnlockTalent: (keywordId: KeywordId, talentId: string) => void;
  onResetTalents: () => void;
}) {
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordId>("physical");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const keywordIds = Object.keys(keywordDefinitions) as KeywordId[];
  const choicesCache = useRef<Record<string, TalentDefinition[]>>({});

  const currentXP = talentXP[selectedKeyword] ?? 0;
  const runXP = runTalentXP?.[selectedKeyword] ?? 0;
  const totalXP = currentXP + runXP;
  const totalPoints = computeTalentPoints(totalXP);
  const nextXP = xpForNextPoint(totalPoints);
  const progress = xpToNextPoint(totalXP);
  const progressPercent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));

  const unlockedIds = unlockedTalents[selectedKeyword] ?? [];
  const spentPoints = unlockedIds.length;
  const unspentPoints = Math.max(0, totalPoints - spentPoints);

  const allTalentsForKeyword = getTalentsForKeyword(selectedKeyword);
  const allUnlocked = spentPoints >= allTalentsForKeyword.length;

  const unlockedTalentsForKeyword = allTalentsForKeyword.filter((t) => unlockedIds.includes(t.id));

  const currentChoices = useMemo(() => {
    const cached = choicesCache.current[selectedKeyword];
    if (cached) return cached;
    if (!allUnlocked && unspentPoints > 0) {
      const c = sampleTalentChoices(selectedKeyword, unlockedIds, 3);
      if (c.length > 0) {
        choicesCache.current[selectedKeyword] = c;
        return c;
      }
    }
    return null;
  }, [selectedKeyword, unlockedIds, unspentPoints, allUnlocked]);

  function handleChooseTalent(talent: TalentDefinition) {
    onUnlockTalent(selectedKeyword, talent.id);
    delete choicesCache.current[selectedKeyword];
  }

  function handleReset() {
    onResetTalents();
    choicesCache.current = {};
    setShowResetConfirm(false);
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="alchemy-shell mt-6 mb-auto flex w-full max-w-3xl flex-col rounded-[28px] px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={onMainMenu}>
            <House className="h-4 w-4" />
            Main Menu
          </Button>
          {hasActiveBattle ? (
            <Button onClick={onReturnToBattle}>
              <Swords className="h-4 w-4" />
              Return to Battle
            </Button>
          ) : null}
        </div>

        <h1 className="mt-8 text-center text-3xl font-semibold text-foreground">Talents</h1>

        <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 text-left">
          <div className="flex flex-wrap justify-center gap-2">
            {keywordIds.map((kw) => {
              const kwXP = (talentXP[kw] ?? 0) + (runTalentXP?.[kw] ?? 0);
              const kwPoints = computeTalentPoints(kwXP);
              const kwUnlockedIds = unlockedTalents[kw] ?? [];
              const hasUnspent = kwPoints - kwUnlockedIds.length > 0;
              return (
                <TalentKeywordButton
                  key={kw}
                  keywordId={kw}
                  hasUnspent={hasUnspent}
                  isSelected={selectedKeyword === kw}
                  onClick={() => setSelectedKeyword(kw)}
                />
              );
            })}
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="rounded-full border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground"
            >
              Reset Talents
            </button>
          </div>

          <div className="surface-muted rounded-[22px] border border-border/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                <KeywordTag keywordId={selectedKeyword} /> XP Progress
              </p>
              <p className="text-xs text-muted-foreground">
                {totalXP} XP / {nextXP} XP — {totalPoints} point{totalPoints !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {currentChoices ? (
            <TalentChoicesInline choices={currentChoices} onChoose={handleChooseTalent} />
          ) : (
            <TalentList
              unlockedTalents={unlockedTalentsForKeyword}
              allTalents={allTalentsForKeyword}
            />
          )}
        </div>
      </div>

      {showResetConfirm ? (
        <ConfirmationDialog
          title="Reset Talents?"
          description="This will refund all your talent points so you can choose again. Any unspent talent points will also be available."
          confirmLabel="Reset Talents"
          tone="default"
          onConfirm={handleReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      ) : null}
    </div>
  );
}

export function GameOverScreen({
  runTalentXP,
  talentXP,
  onMainMenu,
}: {
  runTalentXP: TalentXP;
  talentXP: TalentXP;
  onMainMenu: () => void;
}) {
  const [animate, setAnimate] = useState(false);
  const keywordIds = (Object.keys(runTalentXP) as KeywordId[]).filter((kw) => (runTalentXP[kw] ?? 0) > 0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 text-center">
      <div>
        <h1 className="text-5xl font-bold text-red-400">Defeat</h1>
        <p className="mt-3 text-lg text-muted-foreground">Your run has ended.</p>
      </div>

      {keywordIds.length > 0 ? (
        <div className="w-full max-w-md">
          <p className="mb-4 text-sm font-semibold text-foreground">Talent Progress This Run</p>
          <div className="grid gap-4">
            {keywordIds.map((kw) => {
              const runXP = runTalentXP[kw] ?? 0;
              const totalXP = (talentXP[kw] ?? 0) + runXP;
              const points = computeTalentPoints(totalXP);
              const nextXP = xpForNextPoint(points);
              const progress = xpToNextPoint(totalXP);
              const percent = Math.min(100, Math.round(((nextXP - progress) / nextXP) * 100));
              const Icon = keywordIcons[kw];
              const def = keywordDefinitions[kw];
              return (
                <div key={kw} className="surface-muted rounded-[18px] border border-border/70 p-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {Icon ? (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
                          <Icon className={cn("h-4 w-4", def?.colorClass)} />
                        </div>
                      ) : null}
                      <span className={cn("text-sm font-semibold", def?.colorClass)}>
                        {def?.label ?? kw}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">+{runXP} XP</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                      style={{ width: `${animate ? percent : 0}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[11px] text-muted-foreground">
                    {totalXP} / {nextXP} XP
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No talent XP earned this run.</p>
      )}

      <Button size="lg" className="min-w-44" onClick={onMainMenu}>
        Return to Main Menu
      </Button>
    </div>
  );
}
