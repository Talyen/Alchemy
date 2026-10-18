export const REALISTIC_SCENARIOS = [
  "campaign-early",
  "campaign-developed",
  "labyrinth-journey",
  "wildwood-journey",
  "reward-route",
  "shop-journey",
  "meta-journey",
  "campfire-brewing",
  "transmutation-journey",
  "crafting-journey",
  "trinket-journey",
  "resume-journey",
];

const HEROES = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"];
const MODES = ["campaign", "labyrinth", "wildwood"];
const POLICIES = ["archetype", "random", "minimalist"];

// Separate decision labels keep checkpoint and UI choices independent of one another.
export function chooseDiscoveryIndex(seed, label, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Discovery choice requires candidates");
  let hash = seed >>> 0;
  for (const character of label) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) % count;
}

export function selectDiscoverySeed(cycle, slot) {
  if (!Number.isSafeInteger(cycle) || cycle < 0 || !Number.isInteger(slot) || slot < 0 || slot >= MODES.length)
    throw new Error("Discovery requires a nonnegative cycle and a mode slot from 0 to 2");
  const combinations = HEROES.length * MODES.length;
  const high = chooseDiscoveryIndex(cycle, `nightly:${cycle}:${slot}`, Math.floor(0x100000000 / combinations));
  // Preserve one mode per slot and rotate through every hero in eight cycles.
  return high * combinations + slot * HEROES.length + (((cycle % HEROES.length) + slot * 3) % HEROES.length);
}

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
      checkpoint: "random-battle",
      exploratory: true,
      discoveryVersion: 1,
    };
  }
  const fixed = {
    "campaign-early": [42, "knight", "campaign", "difficulty-1", "archetype", "first-battle"],
    "campaign-developed": [143, "wizard", "campaign", "difficulty-1", "archetype", "developed-battle"],
    "labyrinth-journey": [244, "rogue", "labyrinth", "difficulty-1", "archetype", "map"],
    "wildwood-journey": [345, "ranger", "wildwood", "difficulty-1", "archetype", "draft"],
    "reward-route": [42, "knight", "campaign", "difficulty-1", "archetype", "reward"],
    "shop-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "shop"],
    "campfire-brewing": [42, "knight", "campaign", "difficulty-1", "archetype", "campfire"],
    "transmutation-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "transmutation"],
    "crafting-journey": [42, "knight", "campaign", "difficulty-1", "archetype", "craft"],
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
    case "random-battle": {
      if (!battles.length) return undefined;
      // Balance boss/non-boss discovery before sampling within the chosen group,
      // so numerous early encounters do not drown out reachable bosses.
      const groups = [battles.filter((battle) => !battle.boss), battles.filter((battle) => battle.boss)].filter(
        (group) => group.length > 0,
      );
      const group = groups[chooseDiscoveryIndex(caseSpec.seed, "encounter-kind", groups.length)];
      return group[chooseDiscoveryIndex(caseSpec.seed, "checkpoint", group.length)].step;
    }
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
    case "campfire":
      return action("campfire")?.step;
    case "transmutation":
      return action("transmutation-source")?.step;
    case "craft":
      return action("craft")?.step;
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
