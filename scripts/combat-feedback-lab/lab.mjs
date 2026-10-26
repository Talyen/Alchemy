const document = globalThis.document;
const $ = (selector) => document.querySelector(selector);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * clamp(t);
const smooth = (t) => {
  const p = clamp(t);
  return p * p * (3 - 2 * p);
};
const ease = (t, curve) => {
  const p = clamp(t);
  if (curve === "in") return p ** 3;
  if (curve === "out") return 1 - (1 - p) ** 3;
  if (curve === "smooth") return smooth(p);
  return p;
};

const alchemy = {
  initial: 0.5,
  peak: 2,
  hold: 1.8,
  final: 1,
  popMs: 150,
  peakHoldMs: 0,
  settleMs: 50,
  popCurve: "linear",
  settleCurve: "linear",
  riseStart: 400,
  riseMs: 700,
  distance: 240,
  riseCurve: "in",
  shrinkMs: 500,
  shrinkCurve: "linear",
  lifetime: 1100,
  fadeMs: 250,
  fadeCurve: "linear",
  baseSize: 37.8,
  statusSize: 1,
  statusPeak: 2,
  statusStatic: false,
  placement: "center",
  grouping: "action",
  stackGap: 12,
  maxGroups: 3,
  statusLimit: 0,
  pushMs: 150,
  queueGap: 80,
  queueMaxDelay: 180,
  fanDistance: 36,
  queueClearance: 6,
  mergeWindow: 250,
  mergeExtension: 0,
  mergeCap: 0,
  mergePulse: 0,
  mergePulseMs: 180,
  criticalSize: 1,
  criticalHeavy: false,
  flashMs: 140,
  glowMs: 480,
  shine: "reactions",
  font: "inter",
  stroke: 1.5,
  shadow: 2,
  reactionMs: 1600,
  reactionSize: 1.25,
  reactionRiseStart: 400,
  reactionRiseMs: 700,
  reactionDistance: 240,
  reactionCurve: "in",
  reactionFadeMs: 350,
  edgeFade: false,
};
const trinket = {
  ...alchemy,
  initial: 1.02,
  peak: 2.136,
  hold: 1.776,
  final: 1.464,
  popMs: 50,
  peakHoldMs: 40,
  settleMs: 70,
  popCurve: "out",
  settleCurve: "smooth",
  riseStart: 200,
  riseMs: 720,
  distance: 52,
  riseCurve: "out",
  shrinkMs: 720,
  shrinkCurve: "out",
  lifetime: 920,
  fadeMs: 340,
  fadeCurve: "smooth",
  baseSize: 25.2,
  statusSize: 0.8,
  statusPeak: 1.2,
  statusStatic: true,
  placement: "corners",
  grouping: "regions",
  pushMs: 180,
  statusLimit: 2,
  mergeWindow: 0,
  mergeExtension: 120,
  mergeCap: 300,
  mergePulse: 0.1,
  criticalSize: 1,
  criticalHeavy: false,
  shine: "all",
  font: "rounded",
  reactionRiseStart: 200,
  reactionRiseMs: 720,
  reactionDistance: 52,
  reactionCurve: "out",
  edgeFade: true,
};
const balanced = {
  ...alchemy,
  baseSize: 32,
  grouping: "queued",
  placement: "corners",
  statusSize: 0.8,
  statusPeak: 1.2,
  statusStatic: true,
  initial: 0.9,
  peak: 1.85,
  hold: 1.55,
  final: 1.2,
  popMs: 85,
  settleMs: 85,
  popCurve: "out",
  settleCurve: "smooth",
  riseStart: 240,
  riseMs: 810,
  distance: 76,
  riseCurve: "out",
  shrinkMs: 760,
  shrinkCurve: "smooth",
  lifetime: 1050,
  fadeMs: 280,
  fadeCurve: "smooth",
  reactionRiseStart: 240,
  reactionRiseMs: 810,
  reactionDistance: 76,
  reactionCurve: "out",
};
const presets = {
  alchemy: {
    name: "Alchemy baseline",
    description: "Long accelerating rise · grouped actions · current visual style",
    config: alchemy,
  },
  trinket: {
    name: "Trinket baseline",
    description: "Fast pop · short slowing rise · separate status corners",
    config: trinket,
  },
  balanced: {
    name: "Balanced · recommended",
    description: "Smaller text · independent paths · queued launches · status corners",
    config: balanced,
  },
  restrained: {
    name: "Quiet & readable",
    description: "Smaller pop · 52 px rise · quieter stationary status feedback",
    config: {
      ...balanced,
      peak: 1.6,
      hold: 1.35,
      final: 1.1,
      popMs: 100,
      distance: 52,
      riseStart: 260,
      lifetime: 1150,
      riseMs: 890,
      statusSize: 0.8,
      statusPeak: 1.2,
      statusStatic: true,
      reactionDistance: 52,
    },
  },
  punchy: {
    name: "Punchy & compact",
    description: "Fast impact · independent queued entries · Alchemy typography",
    config: {
      ...balanced,
      peak: 2.05,
      hold: 1.7,
      final: 1.3,
      popMs: 55,
      peakHoldMs: 35,
      settleMs: 70,
      riseStart: 200,
      distance: 90,
      lifetime: 1000,
      riseMs: 800,
      statusSize: 0.85,
      statusPeak: 1.25,
      statusStatic: true,
      reactionRiseStart: 200,
      reactionRiseMs: 800,
      reactionDistance: 90,
    },
  },
};

const numeric = (key, name, min, max, step = 1, unit = "") => ({ key, name, min, max, step, unit });
const choice = (key, name, options) => ({ key, name, options });
const toggle = (key, name) => ({ key, name, toggle: true });
const curves = { linear: "Linear", in: "Accelerate upward", out: "Slow toward the end", smooth: "Smooth in and out" };
const sections = [
  [
    "Pop & scale",
    [
      numeric("initial", "Starting scale", 0.2, 1.5, 0.01, "×"),
      numeric("peak", "Peak scale", 1, 2.6, 0.01, "×"),
      numeric("hold", "Settled scale", 0.8, 2.2, 0.01, "×"),
      numeric("final", "Final scale", 0.7, 1.8, 0.01, "×"),
      numeric("popMs", "Time to peak", 10, 300, 5, "ms"),
      numeric("peakHoldMs", "Peak hold", 0, 150, 5, "ms"),
      numeric("settleMs", "Settle duration", 10, 250, 5, "ms"),
      choice("popCurve", "Pop easing", curves),
      choice("settleCurve", "Settle easing", curves),
      numeric("shrinkMs", "Shrink duration after rise starts", 50, 1500, 10, "ms"),
      choice("shrinkCurve", "Shrink easing", curves),
    ],
  ],
  [
    "Rise & fade",
    [
      numeric("riseStart", "Begin rising at", 0, 800, 10, "ms"),
      numeric("riseMs", "Rise duration", 100, 1500, 10, "ms"),
      numeric("distance", "Rise distance", 0, 300, 1, "px"),
      choice("riseCurve", "Rise easing", curves),
      numeric("lifetime", "Lifetime", 400, 2000, 10, "ms"),
      numeric("fadeMs", "Final fade duration", 50, 700, 10, "ms"),
      choice("fadeCurve", "Fade easing", curves),
      toggle("edgeFade", "Fade near portrait’s top edge"),
    ],
  ],
  [
    "Typography & emphasis",
    [
      numeric("baseSize", "Base font size", 18, 50, 0.1, "px"),
      choice("font", "Typeface", { inter: "Alchemy · Inter", rounded: "Trinket-like · rounded system" }),
      numeric("stroke", "Dark text outline", 0, 3, 0.1, "px"),
      numeric("shadow", "Dark shadow softness", 0, 6, 0.1, "px"),
      numeric("criticalSize", "Critical size multiplier", 1, 1.4, 0.01, "×"),
      toggle("criticalHeavy", "Heavier Critical type"),
      numeric("flashMs", "Critical flash duration", 0, 400, 10, "ms"),
      numeric("glowMs", "Critical glow duration", 0, 900, 10, "ms"),
      choice("shine", "Shine sweep", { none: "None", reactions: "Reactions only", all: "All feedback" }),
    ],
  ],
  [
    "Launch queue & status corners",
    [
      numeric("statusSize", "Status size multiplier", 0.5, 1.2, 0.01, "×"),
      numeric("statusPeak", "Stationary status peak scale", 1, 2.3, 0.01, "×"),
      toggle("statusStatic", "Keep status feedback stationary"),
      choice("placement", "Status placement", {
        center: "Centered with results",
        corners: "Benefits left · setbacks right",
      }),
      choice("grouping", "Entry motion", {
        queued: "Independent paths · bounded stagger",
        action: "Legacy · whole action pushes",
        regions: "Legacy · individual region pushes",
      }),
      numeric("queueGap", "Minimum time between launches", 60, 1000, 10, "ms"),
      numeric("queueClearance", "Preferred clearance", 0, 20, 1, "px"),
      numeric("queueMaxDelay", "Maximum delay after each hit", 0, 300, 10, "ms"),
      numeric("fanDistance", "Dense-hit outward drift", 0, 60, 2, "px"),
      numeric("maxGroups", "Maximum action / reaction groups", 1, 5),
      numeric("statusLimit", "Status entries per region (0 = all)", 0, 6),
      numeric("stackGap", "Space between groups", 0, 30, 1, "px"),
      numeric("pushMs", "Older group push duration", 0, 350, 10, "ms"),
    ],
  ],
  [
    "Repeated-hit merging",
    [
      numeric("mergeWindow", "Fixed merge window (0 = until fade)", 0, 700, 10, "ms"),
      numeric("mergeExtension", "Extra lifetime per impact merge", 0, 200, 10, "ms"),
      numeric("mergeCap", "Maximum lifetime extension", 0, 600, 10, "ms"),
      numeric("mergePulse", "Impact merge pulse", 0, 0.25, 0.01, "×"),
      numeric("mergePulseMs", "Merge pulse duration", 50, 400, 10, "ms"),
    ],
  ],
  [
    "Reaction names",
    [
      numeric("reactionMs", "Name lifetime", 800, 2500, 10, "ms"),
      numeric("reactionSize", "Name size multiplier", 0.8, 1.6, 0.01, "×"),
      numeric("reactionRiseStart", "Begin rising at", 0, 800, 10, "ms"),
      numeric("reactionRiseMs", "Rise duration", 100, 1500, 10, "ms"),
      numeric("reactionDistance", "Rise distance", 0, 300, 1, "px"),
      choice("reactionCurve", "Rise easing", curves),
      numeric("reactionFadeMs", "Final fade duration", 100, 700, 10, "ms"),
    ],
  ],
];

const damage = (value = 24, type = "physical", critical = false) => ({ kind: "impact", type, value, critical });
const status = (type, value, region = "benefit") => ({ kind: "status", type, value, region });
const reaction = (name) => ({ kind: "reaction", type: "reaction", name });
const scenarios = {
  hit: { name: "Single hit", duration: 2000, events: [[0, [damage()]]] },
  critical: { name: "Critical hit", duration: 2000, events: [[0, [damage(67, "physical", true)]]] },
  rapid: {
    name: "Rapid hits · 140 ms apart",
    duration: 2400,
    events: [0, 140, 280, 420].map((t, i) => [t, [damage(12 + i * 2, "fire", i === 2)]]),
  },
  spaced: {
    name: "Repeated hits · 360 ms apart",
    duration: 3000,
    events: [0, 360, 720, 1080].map((t) => [t, [damage(18, "fire")]]),
  },
  mixed: {
    name: "Damage, healing & statuses",
    duration: 2600,
    events: [
      [0, [damage(28, "fire"), damage(12, "heal"), status("shield", 8), status("poison", 3, "setback")]],
      [650, [status("mana", 2), status("freeze", null, "setback")]],
    ],
  },
  reaction: {
    name: "Frostfire reaction",
    duration: 2600,
    events: [[0, [reaction("Frostfire"), damage(32, "fire"), damage(14, "ice")]]],
  },
  dense: {
    name: "Dense action sequence",
    duration: 3200,
    events: [
      [0, [damage(15), status("shield", 6)]],
      [180, [reaction("Frostfire"), damage(22, "fire"), damage(9, "ice")]],
      [380, [damage(14, "poison"), status("poison", 3, "setback")]],
      [620, [damage(18, "heal"), status("mana", 2), status("freeze", null, "setback")]],
      [900, [damage(31, "physical", true), status("shield", 10)]],
      [1200, [status("poison", 4, "setback"), status("freeze", null, "setback"), status("skull", null, "setback")]],
    ],
  },
};

const storageKey = "alchemy-combat-feedback-lab-v3";
const state = {
  a: { ...alchemy },
  b: { ...balanced },
  presetA: "alchemy",
  presetB: "balanced",
  resetB: "balanced",
  scenario: "hit",
  time: 0,
  speed: 1,
  loop: false,
  static: globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches,
  playing: false,
};
const fields = new Map(sections.flatMap(([, entries]) => entries.map((field) => [field.key, field])));

function validatedConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Missing configuration");
  const result = { ...balanced };
  for (const [key, field] of fields) {
    if (!(key in value)) continue;
    const candidate = value[key];
    if (field.options && Object.hasOwn(field.options, candidate)) result[key] = candidate;
    else if (field.toggle && typeof candidate === "boolean") result[key] = candidate;
    else if (!field.options && !field.toggle && typeof candidate === "number" && Number.isFinite(candidate))
      result[key] = clamp(candidate, field.min, field.max);
    else throw new Error(`Invalid setting: ${field.name}`);
  }
  return result;
}

function restore(value) {
  if (![1, 2, 3].includes(value.version)) throw new Error("Unsupported settings version");
  const a = validatedConfig(value.a);
  const b = validatedConfig(value.b);
  state.a = a;
  state.b = b;
  state.presetA = Object.hasOwn(presets, value.presetA) ? value.presetA : "custom";
  state.presetB = Object.hasOwn(presets, value.presetB) ? value.presetB : "custom";
  state.resetB = Object.hasOwn(presets, value.resetB)
    ? value.resetB
    : state.presetB === "custom"
      ? "balanced"
      : state.presetB;
  state.scenario = Object.hasOwn(scenarios, value.scenario) ? value.scenario : "hit";
  state.speed = [0.25, 0.5, 1, 1.5].includes(value.speed) ? value.speed : 1;
  state.static = typeof value.static === "boolean" ? value.static : state.static;
}

try {
  const saved = globalThis.localStorage.getItem(storageKey);
  if (saved) restore(JSON.parse(saved));
} catch {
  $("#status").textContent = "Saved settings unavailable; using defaults.";
}

function snapshot() {
  return {
    version: 3,
    a: state.a,
    b: state.b,
    presetA: state.presetA,
    presetB: state.presetB,
    resetB: state.resetB,
    scenario: state.scenario,
    speed: state.speed,
    static: state.static,
  };
}

function save() {
  try {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(snapshot()));
    $("#status").textContent = "Saved in this browser.";
  } catch {
    $("#status").textContent = "Browser storage unavailable. Export to keep settings.";
  }
}

function configureSelect(element, options, value) {
  for (const [key, label] of Object.entries(options)) element.add(new globalThis.Option(label, key));
  element.value = value;
}

for (const lane of ["a", "b"]) {
  const select = $(`#preset-${lane}`);
  configureSelect(
    select,
    {
      ...Object.fromEntries(Object.entries(presets).map(([key, preset]) => [key, preset.name])),
      custom: "Custom settings",
    },
    state[lane === "a" ? "presetA" : "presetB"],
  );
  select.querySelector('option[value="custom"]').disabled = true;
  select.addEventListener("change", () => {
    if (select.value === "custom") return;
    state[lane] = { ...presets[select.value].config };
    if (lane === "b") state.resetB = select.value;
    state[lane === "a" ? "presetA" : "presetB"] = select.value;
    refreshControls();
    save();
    replay();
  });
}
configureSelect(
  $("#scenario"),
  Object.fromEntries(Object.entries(scenarios).map(([key, scenario]) => [key, scenario.name])),
  state.scenario,
);

for (const [title, entries] of sections) {
  const section = document.createElement("details");
  section.className = "control-section";
  section.open = ["Pop & scale", "Rise & fade", "Typography & emphasis"].includes(title);
  const summary = document.createElement("summary");
  summary.textContent = title;
  section.append(summary);
  const container = document.createElement("div");
  container.className = "fields";
  section.append(container);
  for (const field of entries) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const heading = document.createElement("div");
    heading.className = "field-heading";
    const label = document.createElement("label");
    label.htmlFor = `field-${field.key}`;
    label.textContent = `${field.name}${field.unit ? ` (${field.unit})` : ""}`;
    heading.append(label);
    wrapper.append(heading);
    const input = document.createElement(field.options ? "select" : "input");
    input.id = `field-${field.key}`;
    input.dataset.key = field.key;
    if (field.options) configureSelect(input, field.options, state.b[field.key]);
    else if (field.toggle) input.type = "checkbox";
    else {
      input.type = "range";
      input.min = field.min;
      input.max = field.max;
      input.step = field.step;
      const number = document.createElement("input");
      number.type = "number";
      number.min = field.min;
      number.max = field.max;
      number.step = field.step;
      number.dataset.key = field.key;
      number.setAttribute("aria-label", label.textContent);
      heading.append(number);
      number.addEventListener("change", () => changeField(field, number));
    }
    if (field.toggle) heading.append(input);
    else wrapper.append(input);
    input.addEventListener(field.options || field.toggle ? "change" : "input", () => changeField(field, input));
    container.append(wrapper);
  }
  $("#controls").append(section);
}

function changeField(field, input) {
  let value = field.options ? input.value : field.toggle ? input.checked : Number(input.value);
  if (typeof value === "number") {
    if (input.value === "" || !Number.isFinite(value)) {
      refreshControls();
      return;
    }
    value = Number(clamp(value, field.min, field.max).toFixed(3));
  }
  state.b[field.key] = value;
  state.presetB = "custom";
  refreshControls();
  save();
  render();
}

function sequenceDuration() {
  return Math.max(
    scenarios[state.scenario].duration,
    ...[state.a, state.b].flatMap((config) => plannedItems(config, Infinity).map((item) => item.expiry + 200)),
  );
}

function refreshControls() {
  for (const input of document.querySelectorAll("[data-key]")) {
    const value = state.b[input.dataset.key];
    if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  }
  for (const lane of ["a", "b"]) {
    const name = state[lane === "a" ? "presetA" : "presetB"];
    $(`#preset-${lane}`).value = name;
    $(`#description-${lane}`).textContent =
      presets[name]?.description ?? "Custom combination · replay or scrub to compare";
    const c = state[lane];
    $(`#summary-${lane}`).textContent =
      `${c.popMs} ms pop · ${c.distance} px rise · ${c.lifetime} ms life · ${c.mergeWindow ? `${c.mergeWindow} ms merge` : "merge until fade"}`;
  }
  $("#scenario").value = state.scenario;
  $("#speed").value = state.speed;
  $("#static").checked = state.static;
  $("#time").max = sequenceDuration();
  $("#duration").textContent = `${sequenceDuration() / 1000} s`;
  $("#pause").textContent = state.playing ? "Pause" : "Play";
}

// Resolve only events already reached by the shared clock. Scrubbing backward
// rebuilds the same history, including evictions, rather than revealing future sums.
function buildItems(config, time) {
  const items = [];
  let id = 0;
  for (const [action, [at, entries]] of scenarios[state.scenario].events.entries()) {
    if (at > time) break;
    for (const entry of config.grouping === "queued"
      ? [...entries].sort((a, b) => Number(b.kind === "reaction") - Number(a.kind === "reaction"))
      : entries) {
      const region = entry.kind === "reaction" ? "announcement" : entry.kind === "impact" ? "impact" : entry.region;
      const match =
        entry.kind === "reaction"
          ? undefined
          : items.findLast((item) => {
              if (item.evicted || item.type !== entry.type || item.kind !== entry.kind || item.region !== region)
                return false;
              if (at >= item.expiry || Math.sign(item.value ?? 0) !== Math.sign(entry.value ?? 0)) return false;
              const windowOpen =
                config.mergeWindow > 0 ? at - item.at < config.mergeWindow : at < item.expiry - config.fadeMs;
              const next = (item.value ?? 0) + (entry.value ?? 0);
              return windowOpen && String(next).length <= item.digits;
            });
      if (match) {
        if (entry.value !== null) match.value += entry.value;
        match.updated = at;
        if (entry.critical && (!match.critical || config.mergeExtension > 0))
          match.criticalAt = Math.max(at, match.launchAt ?? at);
        match.critical ||= entry.critical;
        if (region === "impact")
          match.expiry = Math.min(
            match.expiry + config.mergeExtension,
            (match.launchAt ?? match.at) + config.lifetime + config.mergeCap,
          );
      } else {
        const item = {
          ...entry,
          region,
          id: id++,
          action,
          at,
          updated: null,
          criticalAt: at,
          expiry: at + (entry.kind === "reaction" ? config.reactionMs : config.lifetime),
          digits: String(entry.value ?? "").length + 1,
          evicted: false,
        };
        if (config.grouping === "queued") scheduleLaunch(item, items, config);
        items.push(item);
      }
    }
    const live = items.filter((item) => !item.evicted && item.expiry > at);
    const actionIDs = [...new Set(live.map((item) => item.action))].sort((a, b) => b - a);
    if (config.grouping === "action") {
      for (const item of live) if (actionIDs.indexOf(item.action) >= config.maxGroups) item.evicted = true;
    } else if (config.grouping !== "queued") {
      const announcements = [
        ...new Set(live.filter((item) => item.kind === "reaction").map((item) => item.action)),
      ].sort((a, b) => b - a);
      for (const item of live)
        if (item.kind === "reaction" && announcements.indexOf(item.action) >= config.maxGroups) item.evicted = true;
    }
    if (config.statusLimit > 0 && config.grouping !== "queued") {
      for (const region of ["benefit", "setback"]) {
        const corner = live
          .filter((item) => item.region === region)
          .sort((a, b) => (b.type === "skull") - (a.type === "skull") || b.at - a.at || b.id - a.id);
        for (const item of corner.slice(config.statusLimit)) item.evicted = true;
      }
    }
  }
  return items;
}

// A plan is cached for each reached event prefix, so scrubbing cannot expose
// future totals and collision sampling does not run on every animation frame.
const planCache = new Map();
function plannedItems(config, time) {
  const reached = scenarios[state.scenario].events.filter(([at]) => at <= time).length;
  const key = JSON.stringify([config, state.scenario, state.static, reached]);
  if (!planCache.has(key)) {
    if (planCache.size >= 80) planCache.delete(planCache.keys().next().value);
    planCache.set(key, buildItems(config, time));
  }
  return planCache.get(key);
}
function itemsAt(config, time) {
  return plannedItems(config, time).filter(
    (item) => !item.evicted && item.expiry > time && (item.launchAt ?? item.at) <= time,
  );
}
function queueLane(item, config) {
  if (item.kind === "reaction") return "announcement";
  return item.kind === "status" && config.placement === "corners" ? item.region : "impact";
}
function footprint(item, config, time) {
  const sample = motionAt(item, config, time);
  const multiplier =
    item.kind === "reaction" ? config.reactionSize : item.kind === "status" ? config.statusSize : config.criticalSize;
  return { ...sample, height: config.baseSize * 1.15 * sample.scale * multiplier + 4 };
}
function scheduleLaunch(item, previous, config) {
  const lane = queueLane(item, config);
  const ahead = previous.filter((other) => !other.evicted && queueLane(other, config) === lane);
  const last = ahead.at(-1);
  const deadline = item.at + config.queueMaxDelay;
  const launch = Math.min(deadline, Math.max(item.at, last ? last.launchAt + config.queueGap : item.at));
  const duration = item.kind === "reaction" ? config.reactionMs : config.lifetime;
  const recent = ahead.filter((other) => other.launchAt + 360 >= launch);
  const previousSide = recent.findLast((other) => other.spread)?.spread;
  item.spread = !recent.length
    ? 0
    : lane === "announcement"
      ? [-1, 1, -2, 2][(recent.length - 1) % 4]
      : lane === "impact" &&
          item.type === "heal" &&
          recent.some((other) => other.kind === "impact" && other.type !== "heal")
        ? 1
        : lane === "impact" && item.type !== "heal" && recent.some((other) => other.type === "heal")
          ? -1
          : lane === "impact" && recent.length < 2
            ? 0
            : previousSide === -1
              ? 1
              : -1;
  item.launchAt = launch;
  item.expiry = launch + duration;
  {
    const obstacles = previous.filter((other) => !other.evicted);
    const normal =
      item.type === "heal"
        ? [1, 2, 3, 4, 5, 0, -1, -2, -3, -4, -5, 6, 7, 8, 9]
        : [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6, 7, 8, 9];
    const routes =
      lane === "impact"
        ? [...normal, ...Array.from({ length: (Math.ceil(obstacles.length / 3) + 1) * 3 }, (_, i) => 10 + i)]
        : lane === "announcement"
          ? [0, -1, 1, -2, 2]
          : [0, -1, 1, -2, 2, -3, 3];
    let bestScore = Infinity;
    for (const route of routes) {
      let score = Math.abs(route) * 0.001;
      const candidate = { ...item, spread: route };
      for (let elapsed = 0; elapsed < duration; elapsed += 15) {
        const at = launch + elapsed;
        const next = queuedFootprint(candidate, config, at);
        for (const old of obstacles) {
          if (at < old.launchAt || at >= old.expiry) continue;
          const prior = queuedFootprint(old, config, at);
          if (next.opacity < 0.15 || prior.opacity < 0.15) continue;
          const width = Math.max(
            0,
            Math.min(next.x + next.width / 2, prior.x + prior.width / 2) -
              Math.max(next.x - next.width / 2, prior.x - prior.width / 2),
          );
          const height = Math.max(
            0,
            Math.min(next.y + next.height / 2, prior.y + prior.height / 2) -
              Math.max(next.y - next.height / 2, prior.y - prior.height / 2),
          );
          const covered = (width * height) / Math.min(next.width * next.height, prior.width * prior.height);
          score += covered + (covered > 0.8 ? 1000 : 0);
        }
      }
      if (score < bestScore) {
        item.spread = route;
        bestScore = score;
      }
    }
  }
  if (item.critical) item.criticalAt = launch;
}

function queuedRoute(lane, spread = 0) {
  const distance = Math.abs(spread);
  if (lane === "impact" && spread >= 10)
    return { side: [-1, 0, 1][(spread - 10) % 3], reach: 2, row: 120 + Math.floor((spread - 10) / 3) * 16 };
  if (lane === "impact")
    return {
      side: spread >= 6 ? 0 : Math.sign(spread),
      reach: distance % 2 === 0 ? 2 : 1,
      row: (distance >= 6 ? distance - 5 : Math.max(0, distance - 1)) * 24,
    };
  const ordinal = spread < 0 ? -spread * 2 - 1 : spread * 2;
  return { side: 0, reach: 0, row: ordinal * (lane === "announcement" ? 32 : -24) };
}

function queuedFootprint(item, config, time) {
  const frame = footprint(item, config, time);
  const lane = queueLane(item, config);
  const route = queuedRoute(lane, item.spread);
  const width =
    item.kind === "reaction" ? 280 : config.baseSize * (0.56 * (item.digits ?? String(item.value).length) + 1.13);
  const reach = config.fanDistance * (4 / 9 + (5 / 9) * ease((time - item.launchAt) / 400, "out")) * route.reach;
  const fan = route.side * Math.min(reach, Math.max(0, (280 - width * config.peak) / 2 - 8));
  const x = fan + (lane === "benefit" ? -85 : lane === "setback" ? 85 : 0);
  const row = route.row + (lane === "announcement" ? -76 : lane === "impact" ? 0 : 95);
  return { ...frame, x, y: row - frame.rise, width: width * frame.scale + 6 };
}

function motionAt(item, c, time) {
  const elapsed = time - (item.launchAt ?? item.at);
  const name = item.kind === "reaction";
  const quiet = item.kind === "status" && c.statusStatic;
  const fade = name ? c.reactionFadeMs : c.fadeMs;
  const opacity = 1 - ease((time - (item.expiry - fade)) / fade, name ? "smooth" : c.fadeCurve);
  if (state.static) return { scale: 1, rise: 0, opacity: 1, flash: 0, glow: item.critical ? 0.6 : 0, shine: 1 };
  let scale;
  if (name)
    scale = elapsed < 140 ? lerp(0.9, 1.08, smooth(elapsed / 140)) : lerp(1.08, 1, smooth((elapsed - 140) / 100));
  else if (quiet) {
    const t =
      elapsed < 50
        ? lerp(0.85, c.statusPeak, ease(elapsed / 50, "out"))
        : elapsed < 90
          ? c.statusPeak
          : lerp(c.statusPeak, 1, smooth((elapsed - 90) / 70));
    scale = 1.2 * t;
  } else {
    const peakEnd = c.popMs + c.peakHoldMs;
    if (elapsed < c.popMs) scale = lerp(c.initial, c.peak, ease(elapsed / c.popMs, c.popCurve));
    else if (elapsed < peakEnd) scale = c.peak;
    else if (elapsed < peakEnd + c.settleMs)
      scale = lerp(c.peak, c.hold, ease((elapsed - peakEnd) / c.settleMs, c.settleCurve));
    else scale = lerp(c.hold, c.final, ease((elapsed - c.riseStart) / c.shrinkMs, c.shrinkCurve));
  }
  if (!name && item.region === "impact" && item.updated !== null)
    scale *= 1 + c.mergePulse * (1 - smooth((time - item.updated) / c.mergePulseMs));
  const riseStart = name ? c.reactionRiseStart : c.riseStart;
  const riseMs = name ? c.reactionRiseMs : c.riseMs;
  const distance = name ? c.reactionDistance : c.distance;
  const curve = name ? c.reactionCurve : c.riseCurve;
  const criticalElapsed = time - item.criticalAt;
  return {
    scale,
    rise: quiet ? 0 : distance * ease((elapsed - riseStart) / riseMs, curve),
    opacity,
    flash: item.critical && c.flashMs > 0 ? 0.8 * (1 - smooth(criticalElapsed / c.flashMs)) : 0,
    glow: item.critical && c.glowMs > 0 ? 1 - smooth(criticalElapsed / c.glowMs) : 0,
    shine: clamp(
      ((item.updated !== null && item.region === "impact" && c.shine === "all" ? time - item.updated : elapsed) -
        (name ? 100 : 0)) /
        (name ? 1000 : 450),
    ),
  };
}

const colors = {
  physical: "#e7dfcf",
  fire: "#fb9b68",
  ice: "#93daf9",
  heal: "#64e09b",
  shield: "#c1d5e7",
  poison: "#a3df68",
  mana: "#8bbcff",
  freeze: "#a2def7",
  skull: "#fecaca",
};
const paths = {
  physical: '<path d="m14.5 3 6.5 6.5-12 12L2.5 15zM3 3l7 7M2 5l3-3M7 14l3 3"/>',
  fire: '<path d="M12 3c1 5 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 4 3 4 3 4s3-3 0-9Z"/>',
  ice: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3"/>',
  heal: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  shield: '<path d="m12 3 8 4v6c0 5-8 9-8 9s-8-4-8-9V7z"/>',
  poison: '<path d="M9 3h6M10 3v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/>',
  mana: '<path d="m12 2 8 7-8 13L4 9zM4 9h16M12 2l-3 7 3 13 3-13z"/>',
  freeze: '<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3"/>',
  skull:
    '<path d="M9 21v-4H6a2 2 0 0 1-2-2V9a8 8 0 0 1 16 0v6a2 2 0 0 1-2 2h-3v4ZM12 17v4"/><circle cx="8.5" cy="10" r="1"/><circle cx="15.5" cy="10" r="1"/>',
};
function icon(type) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths[type] ?? paths.physical}</svg>`;
}

function layoutAt(items, c, time, width) {
  const baseY = 240;
  const size = c.baseSize;
  const layouts = new Map();
  if (c.grouping === "queued") {
    for (const item of items) {
      const lane = queueLane(item, c);
      const x = lane === "benefit" ? width / 2 - 85 : lane === "setback" ? width / 2 + 85 : width / 2;
      const y = lane === "announcement" ? 164 : lane === "impact" ? baseY : 335;
      const route = queuedRoute(lane, item.spread);
      const fan = state.static || lane !== "impact" ? 0 : queuedFootprint(item, c, time).x;
      const row = state.static ? 0 : route.row;
      layouts.set(item.id, { x: x + fan, y: y + row });
    }
  } else if (c.grouping === "action") {
    const actions = [...new Set(items.map((item) => item.action))].sort((a, b) => b - a);
    const pushes = [];
    for (const action of actions) {
      const entries = items.filter((item) => item.action === action);
      const numbers = entries.filter((item) => item.kind !== "reaction");
      const names = entries.filter((item) => item.kind === "reaction");
      const columns = numbers.length > 3 ? 2 : 1;
      const rows = Math.ceil(numbers.length / columns);
      const rowHeight = size * 1.5 * Math.max(c.peak, 1.2) + 4;
      const height = Math.max(rowHeight, rows * rowHeight) + (names.length ? size * c.reactionSize * 1.2 + 12 : 0);
      const push = pushes.reduce(
        (sum, entry) =>
          sum + entry.distance * (state.static || c.pushMs === 0 ? 1 : ease((time - entry.at) / c.pushMs, "out")),
        0,
      );
      numbers.forEach((item, index) => {
        const corner = c.placement === "corners" && item.kind === "status";
        const x = corner
          ? width / 2 + (item.region === "benefit" ? -92 : 92)
          : width / 2 + (columns === 2 ? (index % 2 ? 74 : -74) : 0);
        const y = corner
          ? 335 - Math.floor(index / 2) * 42
          : baseY - push + (Math.floor(index / columns) - (rows - 1) / 2) * rowHeight;
        layouts.set(item.id, { x, y });
      });
      names.forEach((item, index) =>
        layouts.set(item.id, {
          x: width / 2,
          y: baseY - push - (Math.max(1, rows) * rowHeight) / 2 - size * 0.6 - index * size * c.reactionSize * 1.2,
        }),
      );
      pushes.push({ distance: height + c.stackGap, at: Math.min(...entries.map((item) => item.at)) });
    }
  } else {
    for (const region of ["impact", "benefit", "setback", "announcement"]) {
      const entries = items.filter((item) => item.region === region).sort((a, b) => b.at - a.at || b.id - a.id);
      entries.forEach((item, index) => {
        const corner = c.placement === "corners" && item.kind === "status";
        const x = corner ? width / 2 + (region === "benefit" ? -85 : 85) : width / 2;
        const startY = region === "announcement" ? 210 : corner ? 334 : 260;
        let push = 0;
        for (const newer of entries.slice(0, index)) {
          const target =
            size * 1.5 * (item.kind === "status" ? c.statusSize * c.statusPeak : c.peak) * 0.5 + c.stackGap / 2;
          push += target * (state.static || c.pushMs === 0 ? 1 : ease((time - newer.at) / c.pushMs, "out"));
        }
        layouts.set(item.id, { x, y: startY - push });
      });
    }
  }
  return layouts;
}

const nodes = { a: new Map(), b: new Map() };
function renderLane(lane) {
  const c = state[lane];
  const stage = $(`#lane-${lane} .stage`);
  const host = $(`#lane-${lane} .feedback`);
  const items = itemsAt(c, state.time);
  const layouts = layoutAt(items, c, state.time, stage.clientWidth);
  const waiting = plannedItems(c, state.time).filter(
    (item) => !item.evicted && (item.launchAt ?? item.at) > state.time,
  );
  $(`#queue-${lane}`).textContent = waiting.length
    ? `${waiting.length} queued · next in ${Math.ceil(Math.min(...waiting.map((item) => item.launchAt)) - state.time)} ms`
    : "Queue clear";
  const live = new Set(items.map((item) => item.id));
  for (const [id, node] of nodes[lane])
    if (!live.has(id)) {
      node.remove();
      nodes[lane].delete(id);
    }
  for (const item of items) {
    let node = nodes[lane].get(item.id);
    if (!node) {
      node = document.createElement("div");
      node.className = "entry";
      host.append(node);
      nodes[lane].set(item.id, node);
    }
    const name = item.kind === "reaction";
    const text = name
      ? item.name
      : item.value === null
        ? ""
        : `${item.kind === "impact" && item.type !== "heal" ? "−" : "+"}${item.value}`;
    const signature = `${text}-${item.type}-${item.digits}`;
    if (node.dataset.signature !== signature) {
      node.replaceChildren();
      const content = document.createElement("span");
      content.className = "content";
      if (!name) content.innerHTML = icon(item.type);
      const number = document.createElement("span");
      number.className = "number";
      number.textContent = text;
      if (!name && item.value !== null) number.style.width = `${item.digits + 1}ch`;
      content.append(number);
      if (text) {
        const glint = document.createElement("span");
        glint.className = "glint";
        glint.textContent = text;
        content.append(glint);
      }
      node.append(content);
      node.dataset.signature = signature;
    }
    node.classList.toggle("reaction", name);
    const m = motionAt(item, c, state.time);
    const p = layouts.get(item.id);
    const factor = name ? c.reactionSize : item.kind === "status" ? c.statusSize : item.critical ? c.criticalSize : 1;
    const y = p.y - m.rise;
    const edgeOpacity = c.edgeFade ? smooth((y - 163) / 40) : 1;
    node.style.left = `${p.x}px`;
    node.style.top = `${y}px`;
    node.style.transform = `translate(-50%, -50%) scale(${m.scale * factor})`;
    node.style.fontSize = `${c.baseSize}px`;
    node.style.lineHeight = c.grouping === "queued" ? "1.15" : "1.5";
    node.style.fontFamily =
      c.font === "inter" ? "Inter, sans-serif" : 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
    node.style.fontWeight = item.critical && c.criticalHeavy ? "900" : "700";
    node.style.color =
      m.flash > 0
        ? `color-mix(in srgb, ${colors[item.type] ?? colors.physical}, #fff3cf ${m.flash * 100}%)`
        : (colors[item.type] ?? colors.physical);
    node.style.opacity = m.opacity * edgeOpacity;
    node.style.filter = `drop-shadow(0 0 1px #000) drop-shadow(0 1px ${c.shadow}px #000f)${m.glow > 0 ? ` drop-shadow(0 0 8px rgb(239 204 115 / ${m.glow}))` : ""}`;
    node.querySelector(".number").style.webkitTextStroke = `${c.stroke}px #000f`;
    const glint = node.querySelector(".glint");
    if (glint) {
      glint.style.display =
        !state.static && (c.shine === "all" || (name && c.shine === "reactions")) && m.shine < 1 ? "block" : "none";
      glint.style.backgroundPosition = `${150 - m.shine * 250}% 0`;
    }
    node.dataset.kind = item.kind;
    node.dataset.value = item.value ?? item.name ?? "notice";
  }
}

function render() {
  renderLane("a");
  renderLane("b");
  $("#time").value = state.time;
  $("#time-value").textContent = `${Math.round(state.time)} ms`;
  $("#pause").textContent = state.playing ? "Pause" : "Play";
}

let frame = null;
let previous = null;
function tick(now) {
  frame = null;
  if (!state.playing) return;
  const elapsed = previous === null ? 0 : Math.min(100, now - previous);
  previous = now;
  state.time += elapsed * state.speed;
  const duration = sequenceDuration();
  if (state.time >= duration) {
    if (state.loop) state.time %= duration;
    else {
      state.time = duration;
      state.playing = false;
    }
  }
  render();
  if (state.playing) frame = globalThis.requestAnimationFrame(tick);
}
function play() {
  state.playing = true;
  previous = null;
  if (frame === null) frame = globalThis.requestAnimationFrame(tick);
  render();
}
function pause() {
  state.playing = false;
  if (frame !== null) globalThis.cancelAnimationFrame(frame);
  frame = null;
  previous = null;
  render();
}
function replay() {
  state.time = 0;
  play();
}

$("#replay").addEventListener("click", replay);
$("#pause").addEventListener("click", () => {
  if (state.playing) pause();
  else {
    if (state.time >= sequenceDuration()) state.time = 0;
    play();
  }
});
$("#time").addEventListener("input", (event) => {
  const time = Number(event.target.value);
  pause();
  state.time = time;
  render();
});
$("#scenario").addEventListener("change", (event) => {
  state.scenario = event.target.value;
  refreshControls();
  save();
  replay();
});
$("#speed").addEventListener("change", (event) => {
  state.speed = Number(event.target.value);
  save();
});
$("#loop").addEventListener("change", (event) => {
  state.loop = event.target.checked;
});
$("#static").addEventListener("change", (event) => {
  state.static = event.target.checked;
  refreshControls();
  save();
  render();
});
$("#pin").addEventListener("click", () => {
  state.a = { ...state.b };
  state.presetA = state.presetB;
  refreshControls();
  save();
  render();
});
$("#reset").addEventListener("click", () => {
  const key = state.resetB;
  state.b = { ...presets[key].config };
  state.presetB = key;
  refreshControls();
  save();
  replay();
});
$("#export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new globalThis.Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "combat-feedback-settings.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("#status").textContent = "Exported both configurations.";
});
$("#import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 64000) throw new Error("Settings file is too large");
    restore(JSON.parse(await file.text()));
    refreshControls();
    save();
    state.time = 0;
    pause();
    $("#status").textContent = "Imported both configurations.";
  } catch (error) {
    $("#status").textContent = `Import failed: ${error.message}`;
  }
  event.target.value = "";
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
new globalThis.ResizeObserver(render).observe($(".comparison"));
refreshControls();
render();

// Pure sampling helpers also support a bounded browser inspection of the lab.
globalThis.combatFeedbackLab = { snapshot, itemsAt, motionAt, layoutAt, plannedItems, presets, scenarios };
