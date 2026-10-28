import { z } from "zod";

export const BOSS_IDS = [
  "forge-golem",
  "frostwarden",
  "blight-treant",
  "blood-countess",
  "seraph",
  "stone-titan",
  "iron-bear",
];
const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const camera = z
  .object({
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.5),
    zoom: z.number().min(1).max(4).default(1),
  })
  .strict();
const move = z.object({ from: camera, to: camera }).strict();
const target = z
  .object({
    role: z.enum(["button", "tab", "heading"]).optional(),
    name: z.string().min(1).optional(),
    testId: z.string().min(1).optional(),
    selector: z.string().min(1).optional(),
    index: z.number().int().nonnegative().default(0),
    cardPriority: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      Boolean(v.role) === Boolean(v.name) &&
      Number(Boolean(v.role && v.name)) +
        Number(Boolean(v.testId)) +
        Number(Boolean(v.selector)) +
        Number(Boolean(v.cardPriority)) ===
        1,
    "Specify one role/name, testId, selector, or cardPriority target",
  );
const action = z
  .object({
    at: z.number().nonnegative(),
    kind: z.enum(["click", "hover", "move-away", "play-card"]),
    target: target.optional(),
    moveDuration: z.number().min(0).max(2).default(0.3),
  })
  .strict()
  .refine((v) => ["move-away", "play-card"].includes(v.kind) || v.target, "Click and hover need a target");
const recipeSchema = z
  .object({
    version: z.literal(1),
    id: identifier,
    capture: z
      .object({
        viewport: z
          .object({ width: z.number().int().min(640).max(3840), height: z.number().int().min(360).max(2160) })
          .strict()
          .default({ width: 1920, height: 1080 }),
        scale: z.union([z.literal(1), z.literal(2)]).default(2),
        fps: z.union([z.literal(30), z.literal(60)]).default(60),
      })
      .strict()
      .default({ viewport: { width: 1920, height: 1080 }, scale: 2, fps: 60 }),
    music: z
      .object({
        boss: z.enum(BOSS_IDS),
        offset: z.number().nonnegative(),
        volume: z.number().min(0).max(1).default(0.8),
        lyrics: z.boolean().default(true),
        fadeIn: z.number().nonnegative().default(0.3),
        fadeOut: z.number().nonnegative().default(1.5),
      })
      .strict(),
    clips: z
      .array(
        z
          .object({
            id: identifier,
            scene: z.enum([
              "boss",
              "combat",
              "menu",
              "heroes",
              "modes",
              "collection",
              "homestead",
              "armory",
              "talents",
              "options",
              "destination",
              "shop",
              "alchemist",
              "campfire",
              "corruption",
              "labyrinth",
              "draft",
              "checkpoint",
            ]),
            boss: z.enum(BOSS_IDS).optional(),
            lyrics: z.boolean().optional(),
            hero: z.enum(["knight", "rogue", "ranger", "wizard", "alchemist", "warlock", "druid"]).default("knight"),
            checkpoint: z.string().optional(),
            seed: z.number().int().min(0).max(4294967295).default(42),
            duration: z.number().positive().max(120),
            actions: z.array(action).default([]),
            prepare: z.array(target).optional(),
          })
          .strict(),
      )
      .min(1),
    shots: z
      .array(
        z
          .object({
            clip: identifier,
            in: z.number().nonnegative().default(0),
            duration: z.number().positive().max(120),
            speed: z.number().min(0.25).max(2).default(1),
            framing: z
              .object({ steam: move.optional(), vertical: move.optional(), square: move.optional() })
              .strict()
              .default({}),
            transition: z
              .object({
                kind: z.enum(["cut", "dissolve", "wipe"]).default("cut"),
                duration: z.number().nonnegative().max(2).default(0),
              })
              .strict()
              .default({ kind: "cut", duration: 0 }),
          })
          .strict(),
      )
      .min(1),
    endCard: z
      .object({
        duration: z.number().min(0).max(10).default(3),
        text: z.string().min(1).max(100).default("Wishlist on Steam"),
      })
      .strict()
      .default({ duration: 3, text: "Wishlist on Steam" }),
  })
  .strict();

export const OUTPUTS = {
  steam: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};
export function parseRecipe(value) {
  const recipe = recipeSchema.parse(value);
  const ids = new Set();
  for (const clip of recipe.clips) {
    if (ids.has(clip.id)) throw new Error(`Duplicate clip: ${clip.id}`);
    ids.add(clip.id);
    if (clip.scene === "boss" && !clip.boss) throw new Error(`${clip.id}: boss scene needs boss`);
    if (clip.scene === "checkpoint" && !clip.checkpoint)
      throw new Error(`${clip.id}: checkpoint scene needs checkpoint`);
    if (clip.actions.some((a) => a.at >= clip.duration)) throw new Error(`${clip.id}: action outside clip`);
  }
  for (const [index, shot] of recipe.shots.entries()) {
    const clip = recipe.clips.find((c) => c.id === shot.clip);
    if (!clip) throw new Error(`Unknown clip: ${shot.clip}`);
    if (shot.in + shot.duration * shot.speed > clip.duration + 0.000001)
      throw new Error(`${shot.clip}: shot exceeds captured footage`);
    if (shot.transition.kind === "cut" && shot.transition.duration !== 0) throw new Error("Cuts cannot overlap");
    if (index === 0 && shot.transition.duration > 0) throw new Error("First shot cannot overlap");
    if (
      shot.transition.duration >= shot.duration ||
      (index > 0 && shot.transition.duration >= recipe.shots[index - 1].duration)
    )
      throw new Error("Transition must be shorter than both shots");
  }
  nativeMusicOffsets(recipe);
  return recipe;
}

export function compileTimeline(recipe, format = "steam", draft = false) {
  if (!OUTPUTS[format]) throw new Error(`Unknown output: ${format}`);
  const fps = recipe.capture.fps;
  const frame = (seconds) => Math.round(seconds * fps);
  let cursor = 0;
  const shots = recipe.shots.map((shot) => {
    const durationInFrames = frame(shot.duration);
    const transitionFrames = frame(shot.transition.duration);
    if (durationInFrames < 1) throw new Error("Shot shorter than one frame");
    cursor -= transitionFrames;
    const result = {
      ...shot,
      from: cursor,
      durationInFrames,
      transitionFrames,
      sourceStartFrame: frame(shot.in),
      camera: shot.framing[format] ??
        shot.framing.steam ?? { from: { x: 0.5, y: 0.5, zoom: 1 }, to: { x: 0.5, y: 0.5, zoom: 1 } },
    };
    cursor += durationInFrames;
    return result;
  });
  const size = OUTPUTS[format];
  return {
    fps,
    width: draft ? Math.round(size.width / 2) : size.width,
    height: draft ? Math.round(size.height / 2) : size.height,
    shots,
    endCardFrom: cursor,
    durationInFrames: cursor + frame(recipe.endCard.duration),
  };
}

/** Native battle lyrics are burned into source frames and must match the final soundtrack. */
export function nativeMusicOffsets(recipe) {
  const offsets = {};
  if (!recipe.music.lyrics) return offsets;
  for (const shot of compileTimeline(recipe).shots) {
    const clip = recipe.clips.find((entry) => entry.id === shot.clip);
    const resumesBoss = clip.scene === "menu" && clip.checkpoint && clip.boss;
    if (clip.scene !== "boss" && clip.scene !== "checkpoint" && !resumesBoss) continue;
    if (clip.lyrics === false) continue;
    if (clip.boss !== recipe.music.boss)
      throw new Error(`${clip.id}: native lyrics need the battle boss to match the soundtrack`);
    if (shot.speed !== 1) throw new Error(`${clip.id}: native lyrics require normal playback speed`);
    const offset = recipe.music.offset + shot.from / recipe.capture.fps - shot.in;
    if (offset < 0) throw new Error(`${clip.id}: native lyric clock starts before the soundtrack`);
    if (offsets[clip.id] !== undefined && Math.abs(offsets[clip.id] - offset) > 0.000001)
      throw new Error(`${clip.id}: separate clip IDs are needed for different native lyric timings`);
    offsets[clip.id] = offset;
  }
  return offsets;
}

export function mapSoundEvents(timeline, clips) {
  return timeline.shots.flatMap((shot) => {
    const clip = clips[shot.clip];
    if (!clip) throw new Error(`Missing captured clip ${shot.clip}`);
    return clip.sounds.flatMap((sound) => {
      const local = (sound.at - shot.in) / shot.speed;
      if (local < 0 || local >= shot.duration) return [];
      return [
        {
          ...sound,
          at: shot.from / timeline.fps + local,
          duration: Math.min((sound.end - sound.at) / shot.speed, shot.duration - local),
          speed: shot.speed,
        },
      ];
    });
  });
}

/** Inclusive frame ranges keep every frame when a long edit is rendered in bounded jobs. */
export function compileRenderChunks(timeline) {
  const frames = timeline.fps * 12;
  return Array.from({ length: Math.ceil(timeline.durationInFrames / frames) }, (_, index) => ({
    index: index + 1,
    from: index * frames,
    to: Math.min(timeline.durationInFrames - 1, (index + 1) * frames - 1),
  }));
}
