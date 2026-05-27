import fs from "fs";
import path from "path";

const raw = fs.readFileSync("src/lib/game-data/talents-full.ts");
const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString("utf16le") : raw.toString("utf8");
const lines = text.replace(/\r/g, "").split("\n");

const poolStart = lines.findIndex((l) => l.startsWith("export const talentPool"));
const poolEnd = lines.findIndex((l) => l.startsWith("// Filter helpers"));
const defaultsStart = lines.findIndex((l) => l.startsWith("const DEFAULT_TALENT_EFFECTS"));
const computeStart = lines.findIndex((l) => l.startsWith("export function createEmptyTalentManifest"));

if ([poolStart, poolEnd, defaultsStart, computeStart].some((i) => i < 0)) {
  console.error("split markers not found", { poolStart, poolEnd, defaultsStart, computeStart });
  process.exit(1);
}

const outDir = "src/lib/game-data/talents";
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "pool"), { recursive: true });

fs.writeFileSync(path.join(outDir, "types.ts"), `${lines.slice(0, poolStart).join("\n")}\n`, "utf8");

fs.writeFileSync(path.join(outDir, "pool", "index.ts"), `${lines.slice(poolStart, poolEnd).join("\n")}\n`, "utf8");

const helpers = lines.slice(poolEnd, defaultsStart).join("\n");
fs.writeFileSync(
  path.join(outDir, "manifest-defaults.ts"),
  `${lines.slice(defaultsStart, computeStart).join("\n").replace("const DEFAULT_TALENT_EFFECTS", "export const DEFAULT_TALENT_EFFECTS")}\n`,
  "utf8",
);

fs.writeFileSync(
  path.join(outDir, "compute.ts"),
  `import type { TalentEffectManifest } from "../types";
import { talentPool } from "./pool";
import type { TalentEffectOperation, UnlockedTalents } from "../types";
import { DEFAULT_TALENT_EFFECTS } from "./manifest-defaults";

${lines.slice(computeStart).join("\n")}
`,
  "utf8",
);

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  `export * from "./types";
export { talentPool } from "./pool";
export { DEFAULT_TALENT_EFFECTS } from "./manifest-defaults";
export { createEmptyTalentManifest, computeTalentEffects } from "./compute";
${helpers}
`,
  "utf8",
);

fs.writeFileSync(
  "src/lib/game-data/talents.ts",
  `/** Re-exports talent data from the talents/ module. */
export * from "./talents/index";
`,
  "utf8",
);

console.log("split talents ok", { poolLines: poolEnd - poolStart });
