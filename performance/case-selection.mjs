export const REALISTIC_SCENARIOS = [
  "campaign-early",
  "campaign-developed",
  "labyrinth-journey",
  "wildwood-journey",
  "reward-route",
  "shop-journey",
  "meta-journey",
  "trinket-journey",
  "resume-journey",
];

const HEROES = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"];
const MODES = ["campaign", "labyrinth", "wildwood"];
const POLICIES = ["archetype", "random", "minimalist"];

export function selectCase(scenario, seed = 42) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be a uint32");
  if (scenario === "seeded-discovery") {
    return {
      scenario,
      seed,
      hero: HEROES[seed % HEROES.length],
      mode: MODES[Math.floor(seed / HEROES.length) % MODES.length],
      difficulty: `difficulty-${1 + (Math.floor(seed / (HEROES.length * MODES.length)) % 3)}`,
      policy: POLICIES[Math.floor(seed / (HEROES.length * MODES.length * 3)) % POLICIES.length],
      checkpoint: "developed-battle",
      exploratory: true,
    };
  }
  const fixed = {
    "campaign-early": [42, "knight", "campaign", "difficulty-1", "archetype", "first-battle"],
    "campaign-developed": [143, "wizard", "campaign", "difficulty-1", "archetype", "developed-battle"],
    "labyrinth-journey": [244, "rogue", "labyrinth", "difficulty-1", "archetype", "map"],
    "wildwood-journey": [345, "ranger", "wildwood", "difficulty-1", "archetype", "draft"],
    "reward-route": [42, "knight", "campaign", "difficulty-1", "archetype", "reward"],
    "shop-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "shop"],
    "meta-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "late-run"],
    "trinket-journey": [1, "knight", "campaign", "difficulty-1", "random", "trinket-battle"],
    "resume-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "developed-battle"],
  }[scenario];
  if (!fixed) throw new Error(`Unknown realistic scenario: ${scenario}`);
  const [fixedSeed, hero, mode, difficulty, policy, checkpoint] = fixed;
  return { scenario, seed: fixedSeed, hero, mode, difficulty, policy, checkpoint, exploratory: false };
}

export function chooseCheckpointStep(caseSpec, result) {
  const battles =
    result.telemetry?.battleSnapshots?.filter((snapshot) => snapshot.stage === "start" && snapshot.step > 0) ?? [];
  const action = (kind) => result.journal.find((entry) => entry.action.kind === kind && entry.step > 0);
  switch (caseSpec.checkpoint) {
    case "first-battle":
      return battles[0]?.step;
    case "map":
      return action("labyrinth-enter")?.step;
    case "developed-battle":
      return (
        battles.find((snapshot) => snapshot.run > 0 && snapshot.room >= 5)?.step ??
        battles.at(-1)?.step ??
        battles[0]?.step
      );
    case "reward":
      return action("reward")?.step;
    case "shop":
      return action("buy-card")?.step;
    case "draft":
      return action("draft")?.step ?? action("select-draft-card")?.step;
    case "late-run":
      return (
        battles.find((snapshot) => snapshot.run > 0 && snapshot.room >= 5)?.step ??
        battles[Math.floor(battles.length / 2)]?.step
      );
    case "trinket-battle":
      return battles.find((snapshot) => snapshot.run > 1 && snapshot.room >= 5)?.step;
    default:
      return undefined;
  }
}
