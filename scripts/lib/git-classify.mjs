const DESTRUCTIVE = new Set(["reset", "checkout", "restore", "clean", "switch", "branch", "push"]);

const GLOBAL_OPTIONS_WITH_VALUE = new Set(["-c", "--git-dir", "--work-tree", "--namespace", "-C"]);

const GLOBAL_OPTIONS_NO_VALUE = new Set([
  "--help",
  "--version",
  "--html-path",
  "--man-path",
  "--info-path",
  "--paginate",
  "--no-pager",
  "--no-replace-objects",
  "--bare",
  "--literal-pathspecs",
  "--glob-pathspecs",
  "--noglob-pathspecs",
  "--icase-pathspecs",
]);

export function extractSubcommand(argv) {
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") return { subcommand: argv[i + 1] ?? "", subIndex: i + 1, args: argv.slice(i + 1) };
    if (arg.startsWith("-")) {
      if (GLOBAL_OPTIONS_WITH_VALUE.has(arg)) {
        i += 2;
        continue;
      }
      if (arg.includes("=")) {
        i += 1;
        continue;
      }
      if (GLOBAL_OPTIONS_NO_VALUE.has(arg)) {
        i += 1;
        continue;
      }
      if (arg.startsWith("-c")) {
        i += 1;
        if (!arg.includes("=") && i < argv.length && !argv[i].startsWith("-")) i += 1;
        continue;
      }
      i += 1;
      continue;
    }
    return { subcommand: arg, subIndex: i, args: argv.slice(i) };
  }
  return { subcommand: "", subIndex: -1, args: [] };
}

export function isDestructive(parsedArgs) {
  const { subcommand, args } = extractSubcommand(parsedArgs);
  if (!DESTRUCTIVE.has(subcommand)) return false;

  if (subcommand === "reset") {
    return args.includes("--hard") || args.includes("--merge") || args.includes("--keep");
  }
  if (subcommand === "checkout") {
    if (args.includes("--")) return true;
    if (args.includes("-f") || args.includes("--force")) return true;
    if (args.includes(".")) return true;
    return false;
  }
  if (subcommand === "restore") {
    return true;
  }
  if (subcommand === "clean") {
    return args.some((a) => a.startsWith("-") && a.includes("f"));
  }
  if (subcommand === "switch") {
    return args.includes("-f") || args.includes("--force") || args.includes("--discard-changes");
  }
  if (subcommand === "branch") {
    return args.includes("-D");
  }
  if (subcommand === "push") {
    return args.includes("--force") || args.includes("-f") || args.some((a) => a.startsWith("--force"));
  }
  return false;
}
