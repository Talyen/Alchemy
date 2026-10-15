/** Cloud transport belongs to the process, which survives renderer replacement. */
function createSteamCloudStorage({ resolveSlot, getSteam, isSavePayload, stampOwner, maxPayloadBytes }) {
  let lane = Promise.resolve();
  function enqueue(operation) {
    const result = lane.then(operation);
    // A failed request settles only its caller, preserving later operations.
    lane = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async function read(slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!client) return null;
    try {
      if (!client.cloud.fileExists(name)) return null;
      const buffer = await client.cloud.readFile(name);
      if (buffer && buffer.length > maxPayloadBytes) {
        console.error(`[save] Steam Cloud save exceeds ${maxPayloadBytes} bytes; ignoring.`);
        return null;
      }
      return buffer ? buffer.toString("utf8") : null;
    } catch (error) {
      console.error("[save] Error reading Steam Cloud save:", error);
      return null;
    }
  }

  async function write(data, slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!client || !isSavePayload(data)) return false;
    try {
      return await client.cloud.writeFile(name, stampOwner(data, client));
    } catch (error) {
      console.error("[save] Error writing Steam Cloud save:", error);
      return false;
    }
  }

  async function remove(slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!client) return false;
    try {
      return client.cloud.fileExists(name) ? await client.cloud.deleteFile(name) : true;
    } catch (error) {
      console.error("[save] Error deleting Steam Cloud save:", error);
      return false;
    }
  }

  return {
    read: (slot) => enqueue(() => read(slot)),
    write: (data, slot) => enqueue(() => write(data, slot)),
    remove: (slot) => enqueue(() => remove(slot)),
  };
}

module.exports = { createSteamCloudStorage };
