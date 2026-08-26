// Post-reward navigation targets shared by victory finalization and run-flow routing.
export const REWARD_ROUTES = {
  COMPANION_REWARD: "companion-reward",
  LABYRINTH_VICTORY: "labyrinth-victory",
  LABYRINTH_MAP: "labyrinth-map",
  WILDWOOD_VICTORY: "wildwood-victory",
  ACT_COMPLETE: "act-complete",
  DESTINATION: "destination",
} as const;

export type RewardRoute = (typeof REWARD_ROUTES)[keyof typeof REWARD_ROUTES];
