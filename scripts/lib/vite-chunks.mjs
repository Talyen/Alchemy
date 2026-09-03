/** Single source for Vite chunk splitting (Rolldown groups + Rollup manualChunks fallback). */
const CHUNK_GROUPS = Object.freeze([
  {
    name: "react-vendor",
    test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
    priority: 40,
  },
  {
    name: "motion-vendor",
    test: /[\\/]node_modules[\\/](motion|framer-motion)[\\/]/,
    priority: 30,
  },
  {
    name: "vendor",
    test: /[\\/]node_modules[\\/]/,
    priority: 10,
  },
  {
    name: "game-data",
    test: /[\\/]src[\\/]lib[\\/]game-data[\\/]/,
    priority: 9,
  },
  {
    name: "battle-engine",
    test: /[\\/]src[\\/]lib[\\/]battle[\\/]/,
    priority: 8,
  },
  {
    name: "validation",
    test: /[\\/]src[\\/]lib[\\/]validation[\\/]/,
    priority: 7,
  },
]);

const BY_PRIORITY = [...CHUNK_GROUPS].sort((a, b) => b.priority - a.priority);

export const CHUNK_GROUP_NAMES = Object.freeze(CHUNK_GROUPS.map(({ name }) => name));

export function resolveManualChunk(id) {
  for (const group of BY_PRIORITY) {
    if (group.test.test(id)) return group.name;
  }
  return undefined;
}

export function rolldownCodeSplittingGroups() {
  return BY_PRIORITY.map(({ name, test, priority }) => ({ name, test, priority }));
}
