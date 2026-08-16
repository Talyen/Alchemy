const CYCLE_SHINE_VAR = "--cycle-shine";

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

export { CYCLE_SHINE_VAR };
