import blightTreantIdle1 from "@/assets/boss-idles/blight-treant-idle-1.mp4";
import blightTreantIdle1At640 from "@/assets/boss-idles/blight-treant-idle-1-640.mp4";
import blightTreantIdle1At1280 from "@/assets/boss-idles/blight-treant-idle-1-1280.mp4";
import blightTreantIdle2 from "@/assets/boss-idles/blight-treant-idle-2.mp4";
import blightTreantIdle2At640 from "@/assets/boss-idles/blight-treant-idle-2-640.mp4";
import blightTreantIdle2At1280 from "@/assets/boss-idles/blight-treant-idle-2-1280.mp4";
import blightTreantIdle3 from "@/assets/boss-idles/blight-treant-idle-3.mp4";
import blightTreantIdle3At640 from "@/assets/boss-idles/blight-treant-idle-3-640.mp4";
import blightTreantIdle3At1280 from "@/assets/boss-idles/blight-treant-idle-3-1280.mp4";
import bloodCountessIdle1 from "@/assets/boss-idles/blood-countess-idle-1.mp4";
import bloodCountessIdle1At640 from "@/assets/boss-idles/blood-countess-idle-1-640.mp4";
import bloodCountessIdle1At1280 from "@/assets/boss-idles/blood-countess-idle-1-1280.mp4";
import bloodCountessIdle2 from "@/assets/boss-idles/blood-countess-idle-2.mp4";
import bloodCountessIdle2At640 from "@/assets/boss-idles/blood-countess-idle-2-640.mp4";
import bloodCountessIdle2At1280 from "@/assets/boss-idles/blood-countess-idle-2-1280.mp4";
import bloodCountessIdle3 from "@/assets/boss-idles/blood-countess-idle-3.mp4";
import bloodCountessIdle3At640 from "@/assets/boss-idles/blood-countess-idle-3-640.mp4";
import bloodCountessIdle3At1280 from "@/assets/boss-idles/blood-countess-idle-3-1280.mp4";
import bloodCountessIdle4 from "@/assets/boss-idles/blood-countess-idle-4.mp4";
import bloodCountessIdle4At640 from "@/assets/boss-idles/blood-countess-idle-4-640.mp4";
import bloodCountessIdle4At1280 from "@/assets/boss-idles/blood-countess-idle-4-1280.mp4";
import bloodCountessIdle5 from "@/assets/boss-idles/blood-countess-idle-5.mp4";
import bloodCountessIdle5At640 from "@/assets/boss-idles/blood-countess-idle-5-640.mp4";
import bloodCountessIdle5At1280 from "@/assets/boss-idles/blood-countess-idle-5-1280.mp4";
import seraphIdle1 from "@/assets/boss-idles/seraph-idle-1.mp4";
import seraphIdle1At640 from "@/assets/boss-idles/seraph-idle-1-640.mp4";
import seraphIdle1At1280 from "@/assets/boss-idles/seraph-idle-1-1280.mp4";
import seraphIdle2 from "@/assets/boss-idles/seraph-idle-2.mp4";
import seraphIdle2At640 from "@/assets/boss-idles/seraph-idle-2-640.mp4";
import seraphIdle2At1280 from "@/assets/boss-idles/seraph-idle-2-1280.mp4";
import seraphIdle3 from "@/assets/boss-idles/seraph-idle-3.mp4";
import seraphIdle3At640 from "@/assets/boss-idles/seraph-idle-3-640.mp4";
import seraphIdle3At1280 from "@/assets/boss-idles/seraph-idle-3-1280.mp4";
import stoneTitanIdle1 from "@/assets/boss-idles/stone-titan-idle-1.mp4";
import stoneTitanIdle1At640 from "@/assets/boss-idles/stone-titan-idle-1-640.mp4";
import stoneTitanIdle1At1280 from "@/assets/boss-idles/stone-titan-idle-1-1280.mp4";
import stoneTitanIdle2 from "@/assets/boss-idles/stone-titan-idle-2.mp4";
import stoneTitanIdle2At640 from "@/assets/boss-idles/stone-titan-idle-2-640.mp4";
import stoneTitanIdle2At1280 from "@/assets/boss-idles/stone-titan-idle-2-1280.mp4";
import stoneTitanIdle3 from "@/assets/boss-idles/stone-titan-idle-3.mp4";
import stoneTitanIdle3At640 from "@/assets/boss-idles/stone-titan-idle-3-640.mp4";
import stoneTitanIdle3At1280 from "@/assets/boss-idles/stone-titan-idle-3-1280.mp4";

export interface BossIdleClip {
  readonly variants: readonly [
    { readonly width: 640; readonly src: string },
    { readonly width: 1280; readonly src: string },
    { readonly width: 1920; readonly src: string },
  ];
}

function clip(small: string, medium: string, full: string): BossIdleClip {
  return {
    variants: [
      { width: 640, src: small },
      { width: 1280, src: medium },
      { width: 1920, src: full },
    ],
  };
}

// Battle presentation only: these URLs never join the startup image preload set.
export const bossIdleClips: Readonly<Partial<Record<string, readonly BossIdleClip[]>>> = {
  "blight-treant": [
    clip(blightTreantIdle1At640, blightTreantIdle1At1280, blightTreantIdle1),
    clip(blightTreantIdle2At640, blightTreantIdle2At1280, blightTreantIdle2),
    clip(blightTreantIdle3At640, blightTreantIdle3At1280, blightTreantIdle3),
  ],
  "blood-countess": [
    clip(bloodCountessIdle1At640, bloodCountessIdle1At1280, bloodCountessIdle1),
    clip(bloodCountessIdle2At640, bloodCountessIdle2At1280, bloodCountessIdle2),
    clip(bloodCountessIdle3At640, bloodCountessIdle3At1280, bloodCountessIdle3),
    clip(bloodCountessIdle4At640, bloodCountessIdle4At1280, bloodCountessIdle4),
    clip(bloodCountessIdle5At640, bloodCountessIdle5At1280, bloodCountessIdle5),
  ],
  seraph: [
    clip(seraphIdle1At640, seraphIdle1At1280, seraphIdle1),
    clip(seraphIdle2At640, seraphIdle2At1280, seraphIdle2),
    clip(seraphIdle3At640, seraphIdle3At1280, seraphIdle3),
  ],
  "stone-titan": [
    clip(stoneTitanIdle1At640, stoneTitanIdle1At1280, stoneTitanIdle1),
    clip(stoneTitanIdle2At640, stoneTitanIdle2At1280, stoneTitanIdle2),
    clip(stoneTitanIdle3At640, stoneTitanIdle3At1280, stoneTitanIdle3),
  ],
};
