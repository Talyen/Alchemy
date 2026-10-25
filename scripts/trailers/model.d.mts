export interface Camera {
  x: number;
  y: number;
  zoom: number;
}
export interface Target {
  role?: "button" | "tab" | "heading";
  name?: string;
  testId?: string;
  selector?: string;
  index: number;
  cardPriority?: string[];
}
export interface Clip {
  id: string;
  scene: string;
  boss?: string;
  lyrics?: boolean;
  hero: string;
  seed: number;
  checkpoint?: string;
  duration: number;
  actions: Array<{ at: number; kind: string; target?: Target; moveDuration: number }>;
  prepare?: Target[];
}
export interface Shot {
  clip: string;
  in: number;
  duration: number;
  speed: number;
  framing: Partial<Record<"steam" | "vertical" | "square", { from: Camera; to: Camera }>>;
  transition: { kind: "cut" | "dissolve" | "wipe"; duration: number };
}
export interface Recipe {
  version: 1;
  id: string;
  capture: { viewport: { width: number; height: number }; scale: number; fps: 30 | 60 };
  music: { boss: string; offset: number; volume: number; lyrics: boolean; fadeIn: number; fadeOut: number };
  clips: Clip[];
  shots: Shot[];
  endCard: { duration: number; text: string };
}
export interface Timeline {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  endCardFrom: number;
  shots: Array<
    Shot & {
      from: number;
      durationInFrames: number;
      transitionFrames: number;
      sourceStartFrame: number;
      camera: { from: Camera; to: Camera };
    }
  >;
}
export interface Sound {
  at: number;
  end: number;
  file: string;
  volume: number;
  offset?: number;
}
export const BOSS_IDS: readonly string[];
export const OUTPUTS: Record<"steam" | "vertical" | "square", { width: number; height: number }>;
export function parseRecipe(value: unknown): Recipe;
export function compileTimeline(recipe: Recipe, format?: string, draft?: boolean): Timeline;
export function nativeMusicOffsets(recipe: Recipe): Record<string, number>;
export function mapSoundEvents(
  timeline: Timeline,
  clips: Record<string, { sounds: Sound[] }>,
): Array<Sound & { duration: number; speed: number }>;
