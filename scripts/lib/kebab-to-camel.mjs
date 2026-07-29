/**
 * Convert a kebab-case basename to camelCase (e.g. "gear-slot-body" → "gearSlotBody").
 * @param {string} name
 * @returns {string}
 */
export function kebabToCamel(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}
