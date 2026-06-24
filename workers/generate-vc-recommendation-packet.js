import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildVcRecommendationPacket } from "../lib/vcRecommendationPacket.js";
import { normalizeVcProfiles } from "../lib/vcProfiles.js";
import { readVentureState } from "../server/ventureStore.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_MD = resolve(ROOT, "data/generated_vc_recommendation_packet.md");
const OUTPUT_JSON = resolve(ROOT, "data/generated_vc_recommendation_packet.json");

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const topN = Number(argValue("top", process.env.VENTURE_RADAR_VC_PACKET_TOP || "4"));
const vcProfiles = normalizeVcProfiles(JSON.parse(await readFile(resolve(ROOT, "config/vc_profiles.json"), "utf8")));
const state = await readVentureState();
const packet = buildVcRecommendationPacket(state.companies, vcProfiles, {
  topN: Number.isFinite(topN) ? topN : 4,
});

await mkdir(dirname(OUTPUT_MD), { recursive: true });
await Promise.all([
  writeFile(OUTPUT_MD, packet.markdown, "utf8"),
  writeFile(OUTPUT_JSON, `${JSON.stringify(packet.json, null, 2)}\n`, "utf8"),
]);

console.log(packet.markdown);
console.log(JSON.stringify({
  ok: true,
  markdown_file: OUTPUT_MD,
  json_file: OUTPUT_JSON,
  firm_count: packet.json.firm_count,
  company_count: packet.json.company_count,
}, null, 2));
