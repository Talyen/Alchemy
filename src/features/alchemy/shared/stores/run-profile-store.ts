// Permanent meta-progression store (talents + homestead) — survives run teardown.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  tryUnlockTalent,
  xpThresholdForPoints,
  type KeywordId,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import {
  createInitialPermanentFields,
  createInitialTalentState,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { createHomesteadProfileActions, type HomesteadProfileActions } from "./slices/progress-homestead-actions";

export interface RunProfileActions extends HomesteadProfileActions {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  clearPermanentData: () => void;
  /** Apply persisted talent progression during boot / save hydration. */
  applyTalentState: (talentXP: TalentXP, unlockedTalents: UnlockedTalents) => void;
  /** Merge a finished run's XP into permanent talent XP; returns the multiplied run-end snapshot. */
  mergeRunTalentXPIntoProfile: (runTalentXP: TalentXP, multiplier: number) => TalentXP;
}

export type RunProfileStore = PermanentProgressFields & RunProfileActions;

export const useRunProfileStore = create<RunProfileStore>()(
  immer((set) => ({
    ...createInitialPermanentFields(),

    unlockTalent: (keywordId, talentId) =>
      set((profile) => {
        const result = tryUnlockTalent(keywordId, talentId, profile.talentXP, profile.unlockedTalents);
        if (result.unlockedTalents) {
          profile.unlockedTalents = result.unlockedTalents;
        }
      }),

    unlockAllTalents: import.meta.env.DEV
      ? () =>
          set((profile) => {
            const next: UnlockedTalents = {};
            const xp: TalentXP = {};
            for (const talent of talentPool) {
              next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
            }
            for (const [keyword, ids] of Object.entries(next)) {
              xp[keyword as KeywordId] = xpThresholdForPoints(ids.length);
            }
            profile.unlockedTalents = next;
            profile.talentXP = xp;
          })
      : () => {},

    resetUnlockedTalents: () =>
      set((profile) => {
        profile.unlockedTalents = {};
      }),

    clearPermanentData: () =>
      set((profile) => {
        Object.assign(profile, createInitialPermanentFields());
      }),

    applyTalentState: (talentXP, unlockedTalents) =>
      set((profile) => {
        Object.assign(profile, createInitialTalentState(talentXP, unlockedTalents));
      }),

    mergeRunTalentXPIntoProfile: (runTalentXP, multiplier) => {
      const snapshot = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
      set((profile) => {
        profile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, profile.talentXP, multiplier);
      });
      return snapshot;
    },

    ...createHomesteadProfileActions(set),
  })),
);

/** Imperative access to the permanent profile store API. */
export function getRunProfileStore(): RunProfileStore {
  return useRunProfileStore.getState();
}

/** Restore permanent progression to a fresh-save baseline (dev wipe and tests). */
export function resetRunProfileStore(): void {
  useRunProfileStore.setState(createInitialPermanentFields());
}

/** Field-only projection for snapshots and flattened views. */
export function readRunProfileFields(profile: PermanentProgressFields): PermanentProgressFields {
  return {
    talentXP: profile.talentXP,
    unlockedTalents: profile.unlockedTalents,
    materialInventory: profile.materialInventory,
    constructedBuildings: profile.constructedBuildings,
    plantedFarms: profile.plantedFarms,
    completedResearch: profile.completedResearch,
    bondedCompanions: profile.bondedCompanions,
    effects: profile.effects,
  };
}
