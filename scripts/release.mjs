import { parseReleaseArgs, runRelease } from "./lib/release-runner.mjs";

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: npm run release -- [--dry-run] [--hotfix]");
    return;
  }
  const { dryRun, hotfix } = parseReleaseArgs(argv);
  await runRelease(
    hotfix
      ? { label: "Hotfix", gates: [["check:ship"], ["test:e2e:critical"]], bumpArgs: ["--release-as", "patch"], dryRun }
      : { label: "Release", gates: [["check:ship:full"]], dryRun },
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
