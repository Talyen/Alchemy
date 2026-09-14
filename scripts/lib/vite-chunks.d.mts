export interface RolldownCodeSplittingGroup {
  name: string;
  test: RegExp;
  priority: number;
}

export declare function rolldownCodeSplittingGroups(): RolldownCodeSplittingGroup[];
