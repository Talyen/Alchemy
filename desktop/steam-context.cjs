function steamAccountId(client) {
  try {
    const value = client?.localplayer.getSteamId().steamId64.toString();
    return /^[1-9]\d*$/u.test(value ?? "") ? value : null;
  } catch {
    return null;
  }
}

function isSteamCloudEnabled(client) {
  try {
    return client?.cloud.isEnabledForAccount() === true && client.cloud.isEnabledForApp() === true;
  } catch {
    return false;
  }
}

module.exports = { steamAccountId, isSteamCloudEnabled };
