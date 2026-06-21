import type { KeywordId } from "@/lib/game-data";

interface TalentLayoutConfig {
  radiusX: number;
  radiusY: number;
  rotate?: number;
  startOffset?: number;
}

const talentLayouts: Partial<Record<KeywordId, TalentLayoutConfig>> = {
  physical: { radiusX: 36, radiusY: 36 },
  stun: { radiusX: 40, radiusY: 20, rotate: -23 },
  forge: { radiusX: 42, radiusY: 28, rotate: -15 },
  armor: { radiusX: 34, radiusY: 34 },
  burn: { radiusX: 29, radiusY: 29 },
  bleed: { radiusX: 27, radiusY: 33, rotate: 60, startOffset: 8 },
  freeze: { radiusX: 30, radiusY: 30 },
  mana: { radiusX: 46, radiusY: 22, rotate: -24 },
  nature: { radiusX: 34, radiusY: 34 },
  companion: { radiusX: 34, radiusY: 34 },
  archery: { radiusX: 36, radiusY: 28, rotate: -20 },
  consume: { radiusX: 32, radiusY: 32 },
};

const defaultLayout: TalentLayoutConfig = { radiusX: 30, radiusY: 30 };

const TALENT_NODE_SIZE_PERCENT = 8.64;
const TALENT_NODE_CENTER_OFFSET_PERCENT = TALENT_NODE_SIZE_PERCENT / 2;

function talentNodePositionStyle(left: number, top: number) {
  return {
    left: `calc(${left}% - ${TALENT_NODE_CENTER_OFFSET_PERCENT}%)`,
    top: `calc(${top}% - ${TALENT_NODE_CENTER_OFFSET_PERCENT}%)`,
  };
}

function computeTalentNodePositions(keywordId: KeywordId, count: number): { left: number; top: number }[] {
  if (count === 0) return [];
  if (count === 1) return [{ left: 50, top: 50 }];

  const { radiusX, radiusY, rotate, startOffset } = talentLayouts[keywordId] ?? defaultLayout;
  const rotateRad = ((rotate ?? 0) * Math.PI) / 180;
  const cosR = Math.cos(rotateRad);
  const sinR = Math.sin(rotateRad);
  const offset = startOffset ?? 0;

  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * ((i + offset) % count)) / count;
    const dx = radiusX * Math.cos(angle);
    const dy = radiusY * Math.sin(angle);
    return {
      left: 50 + dx * cosR - dy * sinR,
      top: 50 + dx * sinR + dy * cosR,
    };
  });
}

export { computeTalentNodePositions, talentNodePositionStyle, TALENT_NODE_SIZE_PERCENT };
export type { TalentLayoutConfig };
