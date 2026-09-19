export interface Section {
  path: string;
  start: number;
  end: number;
  text: string;
  heading?: string;
}

export function repositorySearch(
  root: string,
  options?: { pattern?: string; paths?: string[]; excerpts?: boolean; includeExcluded?: boolean; regex?: boolean },
): Array<string | Section>;

export function incrementalContext(
  root: string,
  session: string,
  sections: Section[],
  options?: { refresh?: boolean },
): { sections: Section[]; omitted: number; remember(included: Section[]): void };

export function relatedLocations(
  root: string,
  paths: string[],
  limit?: number,
): { consumers: string[]; tests: string[]; fixtures: string[] };
