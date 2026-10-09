import { mkdir, chmod, open, unlink } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export function createPilotStorage({ directory, fallbackDirectory } = {}) {
  const configured = Boolean(String(directory || "").trim());
  if (configured && !isAbsolute(directory)) throw new Error("PILOT_DATA_DIR must be an absolute path to a dedicated data directory.");
  const dataDirectory = resolve(configured ? directory : fallbackDirectory);
  let lastError = null;
  let lastSuccessfulWriteAt = null;
  const status = () => ({
    backend: "file", configuredDirectory: configured,
    durability: configured ? "external_mount_verification_required" : "local_ephemeral",
    writable: lastError ? false : lastSuccessfulWriteAt ? true : null,
    lastErrorCode: lastError,
    lastSuccessfulWriteAt,
    singleProcessOnly: true,
  });
  const recordError = (error) => { lastError = String(error?.code || "STORAGE_ERROR").slice(0, 40); };
  const recordSuccess = () => { lastError = null; lastSuccessfulWriteAt = new Date().toISOString(); };
  async function ensureDirectory() {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    await chmod(dataDirectory, 0o700);
  }
  async function probe() {
    const path = resolve(dataDirectory, `.storage-probe-${randomUUID()}`);
    try {
      await ensureDirectory();
      const handle = await open(path, "wx", 0o600);
      await handle.close();
      await unlink(path);
      recordSuccess();
    } catch (error) { recordError(error); }
    return status();
  }
  return { dataDirectory, ensureDirectory, recordError, recordSuccess, status, probe };
}
