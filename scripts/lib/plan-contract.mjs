import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_PLAN_KEYS = Object.freeze(["status", "updated"]);
export const PLAN_STATUSES = Object.freeze(["active", "blocked", "complete", "cancelled"]);
export const PLAN_STALE_DAYS = 14;
export const PLANS_DIR = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  "docs",
  "Plans",
);

export function isoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}
