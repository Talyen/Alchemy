import { validateRegistryEntries } from "./registry-validation.mjs";

export const bossIdleAssets = [
  { source: "Animations/Bosses/The Blight Treant - Idle 1.mp4", target: "blight-treant-idle-1.mp4" },
  { source: "Animations/Bosses/The Blight Treant - Idle 2.mp4", target: "blight-treant-idle-2.mp4" },
  { source: "Animations/Bosses/The Blight Treant - Idle 3.mp4", target: "blight-treant-idle-3.mp4" },
  { source: "Animations/Bosses/The Blood Countess - Idle 1.mp4", target: "blood-countess-idle-1.mp4" },
  { source: "Animations/Bosses/The Blood Countess - Idle 2.mp4", target: "blood-countess-idle-2.mp4" },
  { source: "Animations/Bosses/The Blood Countess - Idle 3.mp4", target: "blood-countess-idle-3.mp4" },
  { source: "Animations/Bosses/The Blood Countess - Idle 4.mp4", target: "blood-countess-idle-4.mp4" },
  { source: "Animations/Bosses/The Blood Countess - Idle 5.mp4", target: "blood-countess-idle-5.mp4" },
  { source: "Animations/Bosses/The Seraph - Idle 1.mp4", target: "seraph-idle-1.mp4" },
  { source: "Animations/Bosses/The Seraph - Idle 2.mp4", target: "seraph-idle-2.mp4" },
  { source: "Animations/Bosses/The Seraph - Idle 3.mp4", target: "seraph-idle-3.mp4" },
  { source: "Animations/Bosses/The Stone Titan - Idle 1.mp4", target: "stone-titan-idle-1.mp4" },
  { source: "Animations/Bosses/The Stone Titan - Idle 2.mp4", target: "stone-titan-idle-2.mp4" },
  { source: "Animations/Bosses/The Stone Titan - Idle 3.mp4", target: "stone-titan-idle-3.mp4" },
];

export function validateBossIdleRegistry() {
  return validateRegistryEntries(bossIdleAssets, {
    targetKey: "target",
    sourcePattern: /\.mp4$/iu,
    targetPattern: /^[a-z0-9-]+\.mp4$/u,
    label: "Boss idle asset registry",
    caseInsensitiveDuplicates: true,
  });
}
