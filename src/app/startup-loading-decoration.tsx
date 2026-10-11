import type { CSSProperties } from "react";
import "./startup-loading-decoration.css";

const artwork = `${import.meta.env.BASE_URL}artwork/loading/`;
const leafSeeds = [0.08, 0.3, 0.57, 0.81, 0.94];

// Artwork, proportions and hop poses come from Trinket's LaunchLoadingDecoration.
export function StartupLoadingDecoration() {
  return (
    <span className="loading-decoration" aria-hidden="true">
      {leafSeeds.map((seed, index) => (
        <img
          key={seed}
          className="loading-decoration-leaf"
          src={`${artwork}leaf-${index % 2 === 0 ? "gold" : "green"}.png`}
          alt=""
          width={12}
          height={16}
          style={
            {
              "--leaf-delay": `${-seed * 2.5}s`,
              "--leaf-y": `${-90 + index * 14}px`,
              "--leaf-turn": `${index * 63}deg`,
              "--leaf-scale": index % 2 === 0 ? 1 : 0.72,
            } as CSSProperties
          }
        />
      ))}
      <span className="loading-decoration-shadow" />
      <span className="loading-decoration-slime">
        <img src={`${artwork}slime-body.png`} alt="" width={50} height={39} />
        <span className="loading-decoration-face">
          <img className="loading-decoration-eye-left" src={`${artwork}slime-eye-left.png`} alt="" />
          <img className="loading-decoration-eye-right" src={`${artwork}slime-eye-right.png`} alt="" />
          <img className="loading-decoration-mouth" src={`${artwork}slime-mouth.png`} alt="" />
        </span>
      </span>
    </span>
  );
}
