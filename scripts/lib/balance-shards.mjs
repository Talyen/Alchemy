import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/** Validate every shard before returning any group for the caller to write. */
export function readBalanceShards(mergeDir, identity, expected, sourceCommit) {
  const dirs = readdirSync(mergeDir)
    .sort()
    .map((name) => resolve(mergeDir, name));
  if (dirs.length === 0) throw new Error("No balance shards found to merge");
  const seen = new Set();
  const groups = [];
  for (const dir of dirs) {
    const allowed = new Set(["manifest.json", "shard.json", ...expected.map(([name]) => name)]);
    if (readdirSync(dir).some((name) => !allowed.has(name))) throw new Error(`Unexpected shard entry: ${dir}`);
    if (JSON.stringify(JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"))) !== JSON.stringify(identity))
      throw new Error(`Shard source or options differ: ${dir}`);
    const shard = JSON.parse(readFileSync(resolve(dir, "shard.json"), "utf8"));
    if (
      shard.commit !== sourceCommit ||
      shard.count !== dirs.length ||
      !Number.isSafeInteger(shard.index) ||
      shard.index < 0 ||
      shard.index >= dirs.length ||
      seen.has(shard.index)
    )
      throw new Error(`Invalid or duplicate shard: ${dir}`);
    seen.add(shard.index);
    let ordinal = 0;
    for (const [name, count] of expected) {
      const source = resolve(dir, name);
      const actual = existsSync(source) ? readdirSync(source) : [];
      const expectedNames = Array.from({ length: count }, (_, index) => index)
        .filter((index) => (ordinal + index) % dirs.length === shard.index)
        .map((index) => `${index}.json`);
      if (actual.length !== expectedNames.length || expectedNames.some((file) => !actual.includes(file)))
        throw new Error(`Shard has missing or unexpected groups: ${dir}/${name}`);
      for (const filename of expectedNames)
        groups.push({ name, filename, value: JSON.parse(readFileSync(resolve(source, filename), "utf8")) });
      ordinal += count;
    }
  }
  return groups;
}
