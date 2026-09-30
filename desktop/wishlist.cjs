async function openWishlist({ appId, client, openExternal, pause }) {
  const raw = String(appId ?? "");
  const target = Number(raw);
  if (!/^\d+$/u.test(raw) || !Number.isSafeInteger(target) || target <= 0 || target === 480) return false;
  pause();
  try {
    if (client?.overlay && client.overlay.isEnabled?.() !== false) {
      client.overlay.activateToStore(target, 0);
      return true;
    }
  } catch {
    /* A failed overlay request may use the fixed store destination. */
  }
  try {
    await openExternal(`https://store.steampowered.com/app/${target}/`);
    return true;
  } catch {
    return false;
  }
}
module.exports = { openWishlist };
