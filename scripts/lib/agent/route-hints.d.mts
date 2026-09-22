export function routeHintForPath(filePath: string, rootDir?: string): { routes: string[]; focusedE2E: string[] };

export function formatRouteHintLine(hint: { routes: string[]; focusedE2E: string[] }): string;
