// Shared by the browser and importer; only known review fields are restored.
export function restoreChoices(mappings, stored) {
  const restored = {};
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return restored;
  for (const mapping of mappings) {
    const saved = stored[mapping.id];
    if (!saved || typeof saved !== "object") continue;
    const choice = saved.choice === undefined ? "" : saved.choice;
    const valid = ["", "current", "silence", ...mapping.candidates.map((candidate) => candidate.assetId)].includes(
      choice,
    );
    if (!valid) continue;
    restored[mapping.id] = {
      choice,
      notes: typeof saved.notes === "string" ? saved.notes : "",
      reviewed: saved.reviewed === true,
    };
  }
  return restored;
}

export function importChoices(payload, mappings) {
  if (payload?.schemaVersion !== 1 || !Array.isArray(payload.choices))
    throw new Error("Expected a version 1 audio choices export");
  const records = {};
  for (const record of payload.choices) {
    if (!record || typeof record.mappingId !== "string") throw new Error("Invalid exported review choice");
    if (Object.hasOwn(records, record.mappingId)) throw new Error(`Duplicate exported mapping: ${record.mappingId}`);
    // Ignore title, instructions, candidate metadata and other attached fields.
    Object.defineProperty(records, record.mappingId, { value: record, enumerable: true });
  }
  const choices = restoreChoices(mappings, records);
  return { choices, skipped: payload.choices.length - Object.keys(choices).length };
}

export function buildChoicesExport(report, choices) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    reportGeneratedAt: report.generatedAt,
    direction: report.direction,
    note: "Review choices only. No gameplay changes applied.",
    choices: report.mappings
      .filter((mapping) => choices[mapping.id])
      .map((mapping) => {
        const choice = choices[mapping.id];
        const candidate = mapping.candidates.find((entry) => entry.assetId === choice.choice);
        return {
          mappingId: mapping.id,
          title: mapping.title,
          ...choice,
          candidate: candidate ?? null,
          currentFiles: mapping.currentFiles,
          currentState: mapping.currentState,
        };
      }),
  };
}
