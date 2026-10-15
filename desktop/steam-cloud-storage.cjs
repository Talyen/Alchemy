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
    if (!client.cloud.fileExists(name)) return null;
    const buffer = await client.cloud.readFile(name);
    if (!buffer) throw new Error("Steam Cloud save could not be read");
    if (buffer.length > maxPayloadBytes) throw new Error(`Steam Cloud save exceeds ${maxPayloadBytes} bytes`);
    return buffer.toString("utf8");
  }

  async function write(data, slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!client || !isSavePayload(data)) return false;
    const stamped = stampOwner(data, client);
    if (!isSavePayload(stamped)) return false;
    try {
      return await client.cloud.writeFile(name, stamped);
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
