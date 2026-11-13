interface HomesteadPurchases {
  constructedBuildings: Readonly<Record<string, number>>;
  plantedFarms: Readonly<Record<string, number>>;
  completedResearch: Readonly<Record<string, number>>;
  bondedCompanions: Readonly<Record<string, number>>;
}

export function hasHomesteadPurchases(progress: HomesteadPurchases): boolean {
  for (const levels of [
    progress.constructedBuildings,
    progress.plantedFarms,
    progress.completedResearch,
    progress.bondedCompanions,
  ]) {
    for (const id in levels) {
      if (Object.hasOwn(levels, id) && levels[id]! > 0) return true;
    }
  }
  return false;
}
