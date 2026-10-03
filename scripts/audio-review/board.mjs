import { createReviewPlayer } from "./playback.mjs";
import { restoreChoices, buildChoicesExport } from "./choices.mjs";

const document = globalThis.document;
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "alchemy-audio-review:v1";
let report,
  choices = {},
  focusId = null,
  lastChoice = null;
const labels = {
  replacement: "Replace cue",
  addition: "Add cue",
  retained: "Keep recording",
  silence: "Keep quiet",
  gap: "Gap",
};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, ariaLabel) {
  const node = element("button", text);
  node.type = "button";
  if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
  node.addEventListener("click", action);
  return node;
}

const player = createReviewPlayer({
  createAudio: (url) => new globalThis.Audio(url),
  schedule: (callback, ms) => globalThis.setTimeout(callback, ms),
  cancel: (timer) => globalThis.clearTimeout(timer),
  onStatus: (message) => {
    $("now-playing").textContent = message;
  },
  readVolume: () => Number($("volume").value) / 100,
});

function persist() {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
    return true;
  } catch {
    return false;
  }
}

function matches(mapping) {
  const query = $("search").value.toLowerCase().trim();
  const group = $("group").value,
    scope = $("audition").value;
  const chosen = Boolean(choices[mapping.id]?.choice);
  return (
    (group === "All" || mapping.group === group) &&
    ($("status").value === "all" || mapping.status === $("status").value) &&
    ($("screen").value === "all" || mapping.screens.includes($("screen").value)) &&
    (scope === "all" || (scope === "remaining" && !chosen) || (scope === "chosen" && chosen)) &&
    (!query ||
      [
        mapping.id,
        mapping.title,
        mapping.familyTitle,
        mapping.trigger,
        ...(mapping.keywords ?? []),
        ...mapping.candidates.map(
          (candidate) => `${candidate.originalName} ${candidate.path} ${candidate.assetId} ${candidate.source}`,
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query))
  );
}

function queue() {
  return report.mappings.filter(matches);
}
function currentMapping() {
  return report.mappings.find((mapping) => mapping.id === focusId);
}
function mediaFor(id) {
  return report.media[id];
}
function mediaUrl(media) {
  return media[$("level").value];
}

function playMedia(id, title) {
  const media = mediaFor(id);
  if (!media?.available) {
    player.stop();
    $("now-playing").textContent = `Preview unavailable: ${title}`;
    return;
  }
  player.play(mediaUrl(media), title);
}

function choose(mapping, choice) {
  const before = queue();
  const position = before.findIndex((entry) => entry.id === mapping.id);
  lastChoice = { id: mapping.id, previous: choices[mapping.id] ? { ...choices[mapping.id] } : null };
  choices[mapping.id] = { notes: "", ...choices[mapping.id], choice, reviewed: true };
  const persisted = persist();
  player.stop();
  if ($("advance").checked) {
    const after = queue();
    const next = before.slice(position + 1).find((entry) => after.some((remaining) => remaining.id === entry.id));
    focusId = next?.id ?? after[0]?.id ?? null;
  }
  // With advance disabled the chosen row remains visible even in Remaining.
  render(!$("advance").checked);
  if ($("advance").checked) $("mappings").querySelector("h2")?.focus({ preventScroll: true });
  $("decision-status").textContent =
    `${persisted ? "Saved" : "Chosen in memory; export before closing"}: ${mapping.title}.`;
}

function undo() {
  if (!lastChoice) return;
  const { id, previous } = lastChoice;
  if (previous) choices[id] = previous;
  else delete choices[id];
  lastChoice = null;
  const persisted = persist();
  focusId = id;
  player.stop();
  render(true);
  $("mappings").querySelector("h2")?.focus({ preventScroll: true });
  $("decision-status").textContent = persisted ? "Last choice undone." : "Undone in memory; export before closing.";
}

function navigate(direction) {
  player.stop();
  const entries = queue();
  const index = entries.findIndex((mapping) => mapping.id === focusId);
  if (index < 0) focusId = entries[0]?.id ?? null;
  else focusId = entries[Math.max(0, Math.min(entries.length - 1, index + direction))]?.id ?? null;
  render();
}

function cueCard(mapping, candidate, index, currentFile) {
  const current = candidate === null;
  const label = current ? "Current" : index === 0 ? "Recommended" : `Alternative ${index}`;
  const choice = current ? "current" : candidate.assetId;
  const media = currentFile ? mediaFor(`current:${currentFile}`) : candidate ? mediaFor(candidate.mediaId) : null;
  const tile = element("div", undefined, `cue ${current ? "current" : index === 0 ? "recommended" : ""}`);
  tile.append(element("div", `${current ? 1 : index + 2} · ${label}`, "cue-label"));
  const name = current ? (currentFile ?? "No specific cue") : candidate.originalName;
  const title = element("p", name, "cue-name");
  title.title = name;
  tile.append(
    title,
    element(
      "p",
      media?.available ? `${media.duration.toFixed(2)}s` : current && !currentFile ? "Silent" : "Preview unavailable",
      "cue-info",
    ),
  );
  const actions = element("div", undefined, "cue-actions");
  if (media) {
    const play = button(
      current && mapping.currentState !== "playing" ? "▶ Listen reference" : "▶ Listen",
      () => playMedia(current ? `current:${currentFile}` : candidate.mediaId, `${mapping.title} / ${label}`),
      `Listen to ${label} for ${mapping.title}`,
    );
    play.disabled = !media.available;
    actions.append(play);
  }
  const selected = choices[mapping.id]?.choice === choice;
  const pick = button(
    selected ? "✓ Chosen" : current ? "Keep current" : "Choose this",
    () => choose(mapping, choice),
    `Choose ${label} for ${mapping.title}`,
  );
  pick.className = "choose";
  pick.setAttribute("aria-pressed", String(selected));
  pick.disabled = !current && !media?.available;
  actions.append(pick);
  tile.append(actions);
  const details = element("details");
  details.append(element("summary", "Source details"));
  if (current) {
    details.append(
      element(
        "p",
        currentFile
          ? `Shipped cue: public/sounds/${currentFile}. ${mapping.currentState === "playing" ? "Currently used." : "Registered but unused; keep current preserves that silence."}`
          : "No cue registered. Keep current preserves this behavior.",
      ),
    );
  } else {
    for (const text of [
      `${report.libraryRoot}/${candidate.path}`,
      `Asset: ${candidate.assetId}. Pack: ${candidate.source}.`,
      `Provenance: ${candidate.licenseReference}`,
      `Excerpt: ${candidate.start}s + ${candidate.duration}s. ${candidate.note}`,
      `Metadata-based proposal; listen before choosing.${candidate.identicalTo.length ? " Same recording as current." : ""}`,
    ])
      details.append(element("p", text));
  }
  if (media?.available)
    details.append(element("p", `Matched preview gain: ${media.gainDb} dB. Original level applies no gain.`));
  if (media?.error) details.append(element("p", media.error, "warning"));
  tile.append(details);
  return tile;
}

function renderMapping(mapping) {
  const article = element("article", undefined, "mapping");
  article.dataset.mappingId = mapping.id;
  const header = element("div", undefined, "mapping-header");
  header.append(
    element("div", `${mapping.group} / ${mapping.familyTitle} · ${labels[mapping.status]}`, "mapping-meta"),
    element("h2", mapping.title),
    element("p", mapping.trigger),
  );
  header.querySelector("h2").tabIndex = -1;
  article.append(header);
  const grid = element("div", undefined, "cue-grid");
  grid.append(cueCard(mapping, null, 0, mapping.currentFiles[0]));
  for (const [index, candidate] of mapping.candidates.entries()) grid.append(cueCard(mapping, candidate, index));
  article.append(grid);
  const tools = element("div", undefined, "decision-tools");
  const silence = button(
    choices[mapping.id]?.choice === "silence" ? "✓ No sound chosen" : "0 · No sound",
    () => choose(mapping, "silence"),
    `Choose no sound for ${mapping.title}`,
  );
  silence.setAttribute("aria-pressed", String(choices[mapping.id]?.choice === "silence"));
  tools.append(silence, element("p", "One click saves, marks reviewed, and advances."));
  article.append(tools);
  const notes = element("details", undefined, "mapping-notes");
  notes.append(
    element(
      "summary",
      choices[mapping.id]?.notes ? "Notes & why these sounds · note saved" : "Notes & why these sounds",
    ),
    element("p", mapping.rationale),
    element("p", mapping.note),
  );
  if (mapping.silenceReason) notes.append(element("p", mapping.silenceReason));
  if (!mapping.candidates.length && !mapping.silenceReason)
    notes.append(element("p", "No convincing candidate established; keep current or choose silence."));
  if (mapping.abilityMappings?.length)
    notes.append(
      element(
        "p",
        `Ability turns use card cues: ${mapping.abilityMappings.map((id) => report.mappings.find((entry) => entry.id === id)?.title ?? id).join(", ")}.`,
      ),
    );
  notes.append(
    element(
      "p",
      `Screens: ${mapping.screens.join(", ")}. Evidence: ${mapping.evidence.join(", ")}. Current files: ${mapping.currentFiles.join(", ") || "none"}.`,
    ),
  );
  const noteLabel = element("label", "Listening notes");
  const input = element("textarea");
  input.setAttribute("aria-label", `Listening notes for ${mapping.title}`);
  input.value = choices[mapping.id]?.notes ?? "";
  input.placeholder = "Optional: weight, tail, take…";
  input.addEventListener("input", () => {
    choices[mapping.id] = { choice: "", reviewed: false, ...choices[mapping.id], notes: input.value };
    if (!persist()) $("decision-status").textContent = "Notes are in memory; export before closing.";
  });
  noteLabel.append(input);
  notes.append(noteLabel);
  article.append(notes);
  return article;
}

function render(keepFocus = false) {
  const entries = queue();
  if (!keepFocus && !entries.some((mapping) => mapping.id === focusId)) focusId = entries[0]?.id ?? null;
  const mapping = currentMapping();
  const chosen = report.mappings.filter((entry) => choices[entry.id]?.choice).length;
  $("progress-text").textContent =
    `${chosen} / ${report.mappings.length} chosen · ${report.mappings.length - chosen} remaining`;
  $("mappings").replaceChildren();
  if (mapping) {
    $("mappings").append(renderMapping(mapping));
    const position = entries.findIndex((entry) => entry.id === mapping.id);
    $("queue-position").textContent =
      position < 0 ? "Saved choice" : `${position + 1} of ${entries.length} in this queue`;
    $("previous").disabled = position <= 0;
    $("next").disabled = !entries.length || position === entries.length - 1;
  } else {
    const empty = element("div", undefined, "empty");
    empty.append(
      element("h2", $("audition").value === "remaining" ? "No undecided mappings here" : "No mappings match"),
      element("p", "Change the group or search, review Chosen mappings, or export your decisions."),
    );
    $("mappings").append(empty);
    $("queue-position").textContent = "Queue complete";
    $("previous").disabled = true;
    $("next").disabled = true;
  }
  $("undo").disabled = !lastChoice;
}

function sequenceMedia(mapping, mode) {
  if (mode === "current" || (mode === "chosen" && choices[mapping.id]?.choice === "current"))
    return mapping.currentState === "playing"
      ? mapping.currentFiles.map((file) => ({
          media: mediaFor(`current:${file}`),
          title: `${mapping.title} / current`,
        }))
      : [];
  if (mode === "chosen" && choices[mapping.id]?.choice === "silence") return [];
  const candidate =
    mode === "chosen"
      ? (mapping.candidates.find((entry) => entry.assetId === choices[mapping.id]?.choice) ?? mapping.candidates[0])
      : mapping.candidates[0];
  return candidate ? [{ media: mediaFor(candidate.mediaId), title: mapping.title }] : [];
}

function playSequence(sequence) {
  const steps = sequence.steps.flatMap((step) =>
    sequenceMedia(
      report.mappings.find((entry) => entry.id === step.mapping),
      $("sequence-set").value,
    )
      .filter(({ media }) => media?.available)
      .map(({ media, title }) => ({ at: step.at, url: mediaUrl(media), title, duration: media.duration })),
  );
  void player.sequence(steps, Number($("repeats").value));
}

function exportChoices() {
  const blob = new globalThis.Blob([`${JSON.stringify(buildChoicesExport(report, choices), null, 2)}\n`], {
    type: "application/json",
  });
  const url = globalThis.URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = "alchemy-audio-choices.json";
  document.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  $("decision-status").textContent = "Exported your review choices.";
}

async function init() {
  const response = await globalThis.fetch("mappings.json");
  if (!response.ok) throw new Error("The mapping report could not load.");
  report = await response.json();
  choices = restoreChoices(report.mappings, report.initialChoices);
  try {
    choices = {
      ...choices,
      ...restoreChoices(report.mappings, JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "{}")),
    };
  } catch {
    $("decision-status").textContent = "Browser choices could not load; imported choices are preserved.";
  }
  if (!persist())
    $("decision-status").textContent = "Local storage is unavailable; export your choices before closing.";
  for (const name of new Set(report.mappings.map((mapping) => mapping.group))) {
    const option = element("option", name);
    option.value = name;
    $("group").append(option);
  }
  for (const screen of report.inventory.screens) {
    const option = element("option", screen);
    option.value = screen;
    $("screen").append(option);
  }
  for (const sequence of report.sequences)
    $("sequences").append(button(`▶ ${sequence.title}`, () => playSequence(sequence)));
  $("library-notes").append(
    element(
      "p",
      `${report.catalogCount} library entries · ${report.missingCatalogPaths.length} stale paths · ${report.failures.length} preview failures. All proposals initially used names and metadata; your saved choices record the listening decisions.`,
    ),
  );
  $("stop").addEventListener("click", () => player.stop());
  $("volume").addEventListener("input", () => {
    $("volume-value").textContent = `${$("volume").value}%`;
    player.syncVolume();
  });
  for (const id of ["level", "sequence-set", "repeats"]) $(id).addEventListener("change", () => player.stop());
  for (const id of ["search", "status", "audition", "screen", "group"])
    $(id).addEventListener(id === "search" ? "input" : "change", () => {
      player.stop();
      focusId = null;
      render();
    });
  $("previous").addEventListener("click", () => navigate(-1));
  $("next").addEventListener("click", () => navigate(1));
  $("undo").addEventListener("click", undo);
  $("export").addEventListener("click", exportChoices);
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.target.closest?.("input, textarea, select, summary")
    )
      return;
    const mapping = currentMapping();
    if (!mapping) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      navigate(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    const key = Number(event.key);
    if (event.key === "0") {
      event.preventDefault();
      choose(mapping, "silence");
    } else if (event.key === "1") {
      event.preventDefault();
      choose(mapping, "current");
    } else if (key >= 2 && key <= 4 && event.key.length === 1) {
      const candidate = mapping.candidates[key - 2];
      if (candidate && mediaFor(candidate.mediaId)?.available) {
        event.preventDefault();
        choose(mapping, candidate.assetId);
      }
    }
  });
  globalThis.addEventListener("pagehide", () => player.stop());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) player.stop();
  });
  render();
}

void init().catch((error) => {
  $("decision-status").textContent = `Review failed to load: ${error.message}`;
});
