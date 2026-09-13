export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
