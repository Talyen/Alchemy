interface HomesteadPurchases {
  constructedBuildings: Readonly<Record<string, number>>;
  plantedFarms: Readonly<Record<string, number>>;
  completedResearch: Readonly<Record<string, number>>;
  bondedCompanions: Readonly<Record<string, number>>;
}

export function hasHomesteadPurchases(progress: HomesteadPurchases): boolean {
  return [
    progress.constructedBuildings,
    progress.plantedFarms,
    progress.completedResearch,
    progress.bondedCompanions,
  ].some((levels) => Object.values(levels).some((level) => level > 0));
}
