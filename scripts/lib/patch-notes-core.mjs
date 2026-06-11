// Parses conventional commits into player-facing patch note sections.

const PLAYER_TYPES = new Set(["feat", "fix", "balance", "perf"]);
const HIDDEN_TYPES = new Set(["chore", "refactor", "test", "ci", "build", "style", "docs"]);

export function parseConventionalCommit(subject) {
  const match = /^(?<type>\w+)(?:\((?<scope>[\w-]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/u.exec(subject.trim());
  if (!match?.groups) {
    return { type: "other", scope: null, description: subject.trim(), include: false };
  }
  const type = match.groups.type;
  const include = PLAYER_TYPES.has(type);
  const hidden = HIDDEN_TYPES.has(type);
  return {
    type,
    scope: match.groups.scope ?? null,
    description: match.groups.description,
    include: include && !hidden,
  };
}

export function buildPatchNotesMarkdown(version, commits, knownIssues = []) {
  const sections = {
    Features: [],
    Fixes: [],
    Balance: [],
    Performance: [],
  };

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit);
    if (!parsed.include) continue;
    const line = parsed.scope ? `**${parsed.scope}:** ${parsed.description}` : parsed.description;
    if (parsed.type === "feat") sections.Features.push(line);
    else if (parsed.type === "fix") sections.Fixes.push(line);
    else if (parsed.type === "balance") sections.Balance.push(line);
    else if (parsed.type === "perf") sections.Performance.push(line);
  }

  const lines = [`# Alchemy v${version}`, ""];
  for (const [title, items] of Object.entries(sections)) {
    if (items.length === 0) continue;
    lines.push(`## ${title}`, "");
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## Known issues", "");
  if (knownIssues.length === 0) {
    lines.push("- None reported.", "");
  } else {
    for (const issue of knownIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
