const DESTRUCTIVE = new Set(["reset", "checkout", "restore", "clean", "switch", "branch", "push"]);

const GLOBAL_OPTIONS_WITH_VALUE = new Set(["-c", "--git-dir", "--work-tree", "--namespace", "-C"]);

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
    if (hasForceFlag(args)) return true;
    if (args.includes(".")) return true;
    return false;
  }
  if (subcommand === "restore") {
    return true;
  }
  if (subcommand === "clean" || subcommand === "push") {
    const end = args.indexOf("--");
    const options = args.slice(1, end < 0 ? undefined : end);
    const takesValue =
      subcommand === "clean" ? ["-e", "--exclude"] : ["--repo", "--receive-pack", "--exec", "-o", "--push-option"];
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      if (takesValue.includes(option)) index++;
      else if (option === "--dry-run" || /^-[dfinqxXvu]*n[dfinqxXvu]*$/u.test(option)) return false;
    }
  }
  if (subcommand === "clean") {
    return args.some((a) => a.startsWith("-") && a.includes("f"));
  }
  if (subcommand === "switch") {
    return hasForceFlag(args) || args.includes("--discard-changes");
  }
  if (subcommand === "branch") {
    return (
      args.some((arg) => /^-[qrvadfD]*D[qrvadfD]*$/u.test(arg)) ||
      (hasForceFlag(args) && args.some((arg) => arg === "--delete" || /^-[qrvadf]*d[qrvadf]*$/u.test(arg)))
    );
  }
  if (subcommand === "push") {
    let options = true;
    for (let index = 1; index < args.length; index++) {
      const arg = args[index];
      if (options && arg === "--") {
        options = false;
        continue;
      }
      if (options && ["--repo", "--receive-pack", "--exec", "-o", "--push-option"].includes(arg)) {
        index++;
        continue;
      }
      if (options && (arg.startsWith("--force") || /^-[^-]*f/u.test(arg))) return true;
      if (arg.startsWith("+")) return true;
    }
    return false;
  }
  return false;
}

function hasForceFlag(args) {
  // Only valueless short flags may cluster: -bfeature and -cfeature name a
  // branch and must not be mistaken for an embedded force flag.
  return args.some((arg) => arg === "--force" || /^-[qmdtlfp23varD]*f[qmdtlfp23varDf]*$/u.test(arg));
}
