const warned = new Set();

export function deprecated(name, replacement) {
  const key = `${name}->${replacement}`;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`DEPRECATED ${name}: use ${replacement} instead.`);
}
