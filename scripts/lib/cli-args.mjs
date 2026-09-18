import { UsageError } from "./script-run.mjs";

// Minimal shared flag parser for simple CLIs (no new dependency).
// Supports `--flag`, `--key=value`, `--key value`, `-m value`, `-m=value`,
// and `--` passthrough. Path-selection CLIs (verify/check) stay on
// lib/changed-paths.mjs; complex CLIs (audit, performance) keep their bespoke
// validators until they migrate one flag at a time.
//
// `spec` maps flag names (without dashes) to `{ short?, takesValue? }`.
// Returns `{ flags: Set<string>, values: Map<string, string[]>, rest: string[] }`.
// Unknown flags throw UsageError (exit 2).
export function parseKnownFlags(argv, spec = {}, { usage } = {}) {
  const flags = new Set();
  const values = new Map();
  const rest = [];
  const shortToLong = new Map();
  for (const [name, options] of Object.entries(spec)) {
    if (options?.short) shortToLong.set(options.short, name);
  }
  const pushValue = (name, value, flagLabel) => {
    if (value == null || value.startsWith("-"))
      throw new UsageError(`${flagLabel} requires a value.${usage ? ` ${usage}` : ""}`);
    if (!values.has(name)) values.set(name, []);
    values.get(name).push(value);
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      rest.push(...argv.slice(index + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const equals = arg.indexOf("=");
      const name = equals === -1 ? arg.slice(2) : arg.slice(2, equals);
      const inline = equals === -1 ? null : arg.slice(equals + 1);
      const definition = spec[name];
      if (!definition) throw new UsageError(`Unknown option: ${arg}.${usage ? ` ${usage}` : ""}`);
      if (definition.takesValue) {
        if (inline != null) pushValue(name, inline, arg);
        else pushValue(name, argv[++index], arg);
      } else {
        if (inline != null) throw new UsageError(`Option does not take a value: ${arg}.`);
        flags.add(name);
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length === 2) {
      const name = shortToLong.get(arg.slice(1));
      if (!name) throw new UsageError(`Unknown option: ${arg}.${usage ? ` ${usage}` : ""}`);
      const definition = spec[name];
      if (definition.takesValue) pushValue(name, argv[++index], arg);
      else flags.add(name);
      continue;
    }
    if (arg.startsWith("-m=") || arg.startsWith("--mode=")) {
      // Back-compat for `-m=value`/`--mode=value` spellings when the spec
      // declares a value-taking `mode` (or short `m`). Anything else follows
      // the same unknown-option / no-value rules as the longhand forms.
      const name = shortToLong.get("m") ?? "mode";
      const definition = spec[name];
      if (!definition) throw new UsageError(`Unknown option: ${arg}.${usage ? ` ${usage}` : ""}`);
      if (!definition.takesValue) throw new UsageError(`Option does not take a value: ${arg}.`);
      pushValue(name, arg.slice(arg.indexOf("=") + 1), arg);
      continue;
    }
    rest.push(arg);
  }
  return { flags, values, rest };
}
