import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(pathFromRoot) {
  const text = await readFile(resolve(ROOT, pathFromRoot), "utf8");
  return JSON.parse(text);
}

export async function writeJson(pathFromRoot, data) {
  await writeFile(resolve(ROOT, pathFromRoot), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function shouldWrite() {
  return process.argv.includes("--write");
}
