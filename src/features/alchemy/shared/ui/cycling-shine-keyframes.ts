const CYCLE_SHINE_VAR = "--cycle-shine";

const injectedKeyframes = new Set<string>();

function hashColors(colors: readonly string[]): string {
  return colors
    .map((c) => c.replace(/[^a-zA-Z0-9]/g, ""))
    .join("-")
    .slice(0, 80);
}

export function getShineCycleAnimationName(colors: readonly string[]): string {
  const hash = hashColors(colors);
  return hash.length > 0 ? `alchemy-shine-cycle-${hash}` : "alchemy-shine-cycle-empty";
}

export function buildShineColorCycleKeyframes(animationName: string, colors: readonly string[]): string {
  const first = colors[0];
  if (!first) return "";

  const frames = colors.map((color, index) => {
    const percent = (index / colors.length) * 100;
    return `${percent}% { ${CYCLE_SHINE_VAR}: ${color}; }`;
  });
  frames.push(`100% { ${CYCLE_SHINE_VAR}: ${first}; }`);
  return `@keyframes ${animationName} {\n  ${frames.join("\n  ")}\n}`;
}

export function ensureShineCycleKeyframes(animationName: string, colors: readonly string[]): void {
  if (injectedKeyframes.has(animationName)) return;
  if (typeof document === "undefined") return;
  const existing = document.getElementById(animationName);
  if (existing) {
    injectedKeyframes.add(animationName);
    return;
  }
  const css = buildShineColorCycleKeyframes(animationName, colors);
  if (!css) return;
  const style = document.createElement("style");
  style.id = animationName;
  style.textContent = css;
  document.head.appendChild(style);
  injectedKeyframes.add(animationName);
}

export { CYCLE_SHINE_VAR };
