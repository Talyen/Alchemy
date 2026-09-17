// Shared rendering helpers for balance reports. All three HTML reports
// (full matrix, findings summary, loot progression) share escaping, percent
// formatting, page shell, and JSON stringification so style drift stays in one
// place. Content rows stay with their report owners.
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const BALANCE_REPORT_STYLE: string = [
  "body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f12; color: #d4d4d8; padding: 2rem; }",
  "h1 { color: #e4e4e7; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }",
  "h2 { color: #a1a1aa; margin-top: 2rem; }",
  "table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; font-size: 0.875rem; }",
  "th { background: #18181b; color: #a1a1aa; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; font-weight: 600; }",
  "td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1f1f23; vertical-align: top; }",
  "tr:hover td { background: #1a1a1e; }",
  ".pos { color: #4ade80; }",
  ".neg { color: #f87171; }",
  ".warn { color: #fbbf24; }",
  ".noisy { color: #71717a; }",
  ".meta { color: #71717a; font-size: 0.8rem; margin-bottom: 0.75rem; }",
  ".hint { color: #71717a; font-size: 0.8rem; margin-top: 0.25rem; }",
  ".chip { display: inline-block; background: #18181b; border: 1px solid #27272a; border-radius: 999px; padding: 0.15rem 0.6rem; margin: 0 0.35rem 0.35rem 0; font-size: 0.75rem; color: #a1a1aa; }",
  ".scroll { overflow-x: auto; }",
  "a { color: #93c5fd; }",
].join("\n");

export function renderReportPage(options: {
  title: string;
  body: string;
  extraStyle?: string;
  bodyStyle?: string;
}): string {
  const { title, body, extraStyle, bodyStyle } = options;
  const style = extraStyle ? `${BALANCE_REPORT_STYLE}\n${extraStyle}` : BALANCE_REPORT_STYLE;
  const bodyAttr = bodyStyle ? ` style="${bodyStyle}"` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
${style}
</style>
</head>
<body${bodyAttr}>
${body}
</body>
</html>`;
}

export function stringifyReportJson(payload: unknown): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
