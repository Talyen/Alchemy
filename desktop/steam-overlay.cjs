function registerOverlayPause({ client, steamCallbacks, pause }) {
  const event = steamCallbacks?.GameOverlayActivated;
  if (event === undefined || typeof client?.callback?.register !== "function") return null;
  return client.callback.register(event, ({ active }) => {
    if (active === true) pause();
  });
}

module.exports = { registerOverlayPause };
