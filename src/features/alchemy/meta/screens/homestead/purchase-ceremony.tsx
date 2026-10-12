import { type CSSProperties, useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { useReducedMotionPreference } from "@/components/ui/use-reduced-motion-preference";
import { HOMESTEAD_PURCHASE_MOTION } from "@/lib/game-constants";
import { cn } from "@/lib/utils";
import { type PurchaseCeremony } from "./use-purchase-ceremony";
import "./purchase-ceremony.css";

export function HomesteadPurchaseCeremony({
  ceremony,
  art,
  artClassName,
  onFinished,
}: {
  ceremony: PurchaseCeremony;
  art: string | undefined;
  artClassName: string;
  onFinished: (token: number) => void;
}) {
  const reducedMotion = useReducedMotionPreference();
  const soundPlayed = useRef(false);
  const firstPurchase = ceremony.level === 1;
  const completed = ceremony.level >= ceremony.max;
  const duration = firstPurchase ? HOMESTEAD_PURCHASE_MOTION.buildMs : HOMESTEAD_PURCHASE_MOTION.upgradeMs;
  const sealDelay = reducedMotion
    ? 0
    : firstPurchase
      ? HOMESTEAD_PURCHASE_MOTION.buildSealMs
      : HOMESTEAD_PURCHASE_MOTION.upgradeSealMs;

  useEffect(() => {
    const sound = window.setTimeout(() => {
      if (soundPlayed.current) return;
      soundPlayed.current = true;
      ceremony.onSeal();
    }, sealDelay);
    const end = window.setTimeout(() => onFinished(ceremony.token), duration);
    return () => {
      window.clearTimeout(sound);
      window.clearTimeout(end);
    };
  }, [ceremony, duration, sealDelay, onFinished]);

  return (
    <div
      aria-hidden="true"
      data-homestead-purchase={firstPurchase ? "build" : "upgrade"}
      data-motion={reducedMotion ? "static" : "animated"}
      data-completed={completed || undefined}
      className="homestead-purchase"
      style={
        {
          "--purchase-duration": `${duration}ms`,
          "--purchase-seal-delay": `${sealDelay}ms`,
          "--purchase-seal-duration": `${duration - sealDelay}ms`,
        } as CSSProperties
      }
    >
      {!reducedMotion && (
        <div className="homestead-purchase-art">
          {art && <img src={art} alt="" className={cn("block w-full", artClassName)} />}
          {firstPurchase && art && (
            <img src={art} alt="" className={cn("homestead-purchase-gray block w-full", artClassName)} />
          )}
          {!firstPurchase && <div className="homestead-purchase-wash" />}
        </div>
      )}
      <div className="homestead-purchase-seal">
        <span className="homestead-purchase-stars">
          {Array.from({ length: ceremony.max }, (_, index) => (
            <Star
              key={index}
              className={cn("h-4 w-4", index < ceremony.level ? "text-gold-light" : "text-muted-foreground")}
              fill={index < ceremony.level ? "currentColor" : "none"}
              data-new-tier={index === ceremony.level - 1 || undefined}
            />
          ))}
        </span>
      </div>
      {!reducedMotion && (
        <div className="homestead-purchase-flecks">
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index} style={{ "--fleck-angle": `${index * 60 + 15}deg` } as CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}
