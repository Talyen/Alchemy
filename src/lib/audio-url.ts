export function audioUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}${path}`;
}
