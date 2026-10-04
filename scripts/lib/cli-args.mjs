import { UsageError } from "./script-run.mjs";

// Minimal shared flag parser for simple CLIs (no new dependency).
// Supports `--flag`, `--key=value`, `--key value`, `-m value`, `-m=value`,
// and `--` passthrough. Path-selection CLIs (verify/check) stay on
// lib/verification/changed-paths.mjs; complex CLIs (audit, performance) keep their bespoke
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
    const option = /^(--[^=]*|-.)(?:=([\s\S]*))?$/.exec(arg);
    if (option) {
      const label = option[1];
      const name = label.startsWith("--") ? label.slice(2) : shortToLong.get(label.slice(1));
      const definition = name && Object.hasOwn(spec, name) ? spec[name] : undefined;
      if (!definition) throw new UsageError(`Unknown option: ${arg}.${usage ? ` ${usage}` : ""}`);
      const inline = option[2];
      if (definition.takesValue) pushValue(name, inline ?? argv[++index], arg);
      else {
        if (inline !== undefined) throw new UsageError(`Option does not take a value: ${arg}.`);
        flags.add(name);
      }
      continue;
    }
    rest.push(arg);
  }
  return { flags, values, rest };
}
