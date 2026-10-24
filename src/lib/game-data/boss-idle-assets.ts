import blightTreantIdle1 from "@/assets/boss-idles/blight-treant-idle-1.mp4";
import blightTreantIdle2 from "@/assets/boss-idles/blight-treant-idle-2.mp4";
import blightTreantIdle3 from "@/assets/boss-idles/blight-treant-idle-3.mp4";
import bloodCountessIdle1 from "@/assets/boss-idles/blood-countess-idle-1.mp4";
import bloodCountessIdle2 from "@/assets/boss-idles/blood-countess-idle-2.mp4";
import bloodCountessIdle3 from "@/assets/boss-idles/blood-countess-idle-3.mp4";
import bloodCountessIdle4 from "@/assets/boss-idles/blood-countess-idle-4.mp4";
import bloodCountessIdle5 from "@/assets/boss-idles/blood-countess-idle-5.mp4";
import seraphIdle1 from "@/assets/boss-idles/seraph-idle-1.mp4";
import seraphIdle2 from "@/assets/boss-idles/seraph-idle-2.mp4";
import seraphIdle3 from "@/assets/boss-idles/seraph-idle-3.mp4";
import stoneTitanIdle1 from "@/assets/boss-idles/stone-titan-idle-1.mp4";
import stoneTitanIdle2 from "@/assets/boss-idles/stone-titan-idle-2.mp4";
import stoneTitanIdle3 from "@/assets/boss-idles/stone-titan-idle-3.mp4";

// Battle presentation only: these URLs never join the startup image preload set.
export const bossIdleClips: Readonly<Partial<Record<string, readonly string[]>>> = {
  "blight-treant": [blightTreantIdle1, blightTreantIdle2, blightTreantIdle3],
  "blood-countess": [
    bloodCountessIdle1,
    bloodCountessIdle2,
    bloodCountessIdle3,
    bloodCountessIdle4,
    bloodCountessIdle5,
  ],
  seraph: [seraphIdle1, seraphIdle2, seraphIdle3],
  "stone-titan": [stoneTitanIdle1, stoneTitanIdle2, stoneTitanIdle3],
};
