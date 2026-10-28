const { isSteamCloudEnabled } = require("./steam-context.cjs");
const { createSerialOperations } = require("./serial-operations.cjs");

/** Cloud transport belongs to the process, which survives renderer replacement. */
function createSteamCloudStorage({ resolveSlot, getSteam, isSavePayload, stampOwner, maxPayloadBytes }) {
  const lane = createSerialOperations();
  async function read(slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!isSteamCloudEnabled(client)) return null;
    if (!client.cloud.fileExists(name)) return null;
    const buffer = await client.cloud.readFile(name);
    if (!buffer || buffer.length === 0) throw new Error("Steam Cloud save could not be read");
    if (buffer.length > maxPayloadBytes) throw new Error(`Steam Cloud save exceeds ${maxPayloadBytes} bytes`);
    return buffer.toString("utf8");
  }

  async function write(data, slot) {
    const { name } = resolveSlot(slot);
    const client = getSteam();
    if (!isSavePayload(data)) return false;
    if (!isSteamCloudEnabled(client)) return true;
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
    if (!isSteamCloudEnabled(client)) return true;
    try {
      return client.cloud.fileExists(name) ? await client.cloud.deleteFile(name) : true;
    } catch (error) {
      console.error("[save] Error deleting Steam Cloud save:", error);
      return false;
    }
  }

  return {
    read: (slot) => lane.enqueue(() => read(slot)),
    write: (data, slot) => lane.enqueue(() => write(data, slot)),
    remove: (slot) => lane.enqueue(() => remove(slot)),
  };
}

module.exports = { createSteamCloudStorage };
