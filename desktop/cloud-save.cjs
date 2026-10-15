async function readCloudSave(client, name, maxBytes) {
  if (!client || !client.cloud.fileExists(name)) return null;
  const buffer = await client.cloud.readFile(name);
  if (!buffer) throw new Error("Steam Cloud save could not be read");
  if (buffer.length > maxBytes) throw new Error(`Steam Cloud save exceeds ${maxBytes} bytes`);
  return buffer.toString("utf8");
}
module.exports = { readCloudSave };
