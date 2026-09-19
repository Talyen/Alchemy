export const E2E_ROUTES: Record<string, { label: string; args: readonly string[] }>;

export function resolveE2eRoute(route: string): { label: string; args: readonly string[] } | undefined;
