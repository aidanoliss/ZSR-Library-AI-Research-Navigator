import {
  fetchGithubTrendingRepositories,
  fetchHackerNewsLaunchPosts,
  fetchProductHuntLaunches,
  ingestManualUrls,
} from "../lib/sources.js";
import { readJson } from "./_data.js";

const manualUrls = process.env.VENTURE_RADAR_MANUAL_URLS
  ? process.env.VENTURE_RADAR_MANUAL_URLS.split(",").map((url) => url.trim()).filter(Boolean)
  : [];

const sources = await readJson("data/sample_sources.json");
const enabled = sources.filter((source) => source.enabled);
const results = [];

if (enabled.some((source) => source.id === "src-product-hunt")) {
  results.push(await fetchProductHuntLaunches());
}
if (enabled.some((source) => source.id === "src-hn-launch")) {
  results.push(await fetchHackerNewsLaunchPosts());
}
if (enabled.some((source) => source.id === "src-github-trending")) {
  results.push(await fetchGithubTrendingRepositories());
}
if (manualUrls.length) {
  results.push({ ok: true, candidates: await ingestManualUrls(manualUrls) });
}

console.log(JSON.stringify({ ok: true, enabled_sources: enabled.map((source) => source.name), results }, null, 2));
