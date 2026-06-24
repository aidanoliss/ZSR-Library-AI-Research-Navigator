import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEFAULT_MODE_ID, getSearchMode } from "../config/libraryLinks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = join(__dirname, "resources.json");

let cache = null;

/**
 * Load the curated resources file (cached after first read).
 * This is the ONLY source of links the app will ever surface.
 */
export async function loadResources() {
  if (cache) return cache;
  const raw = await readFile(RESOURCES_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  cache = parsed.resources ?? [];
  return cache;
}

/** Curated resources that can run a query search ({q} template). Always available. */
export async function getSearchTools() {
  const all = await loadResources();
  return all
    .filter((r) => r.search_url_template)
    .map((r) => ({ id: r.id, name: r.name, search_url_template: r.search_url_template }));
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "about",
  "is", "are", "how", "what", "my", "i", "need", "want", "find", "research",
  "paper", "essay", "assignment", "topic", "sources", "source", "help", "looking",
  "this", "that", "from", "do", "does", "can", "should", "best"
]);

/**
 * Synonym / subject groups. If a query token matches any member of a group,
 * every member is added to the search, so "heart" also matches resources
 * tagged "cardiovascular" or "medicine". Edit freely as the resource file grows.
 */
const SYNONYM_GROUPS = [
  ["health", "medical", "medicine", "clinical", "disease", "heart", "cardiovascular", "cardiac", "nursing", "patient", "epidemiology", "wellbeing", "wellness"],
  ["biology", "biological", "genetics", "genome", "cell", "ecology", "organism", "species"],
  ["history", "historical", "archive", "archival", "primary", "manuscript", "colonial", "war", "century"],
  ["literature", "literary", "novel", "poetry", "fiction", "author", "rhetoric"],
  ["business", "economics", "economic", "finance", "financial", "market", "marketing", "company", "industry", "trade", "inflation", "entrepreneur"],
  ["law", "legal", "court", "statute", "case", "regulation", "policy", "legislation", "constitutional"],
  ["politics", "political", "government", "election", "democracy", "policy", "civic", "gerrymandering", "voting"],
  ["psychology", "psychological", "mental", "cognitive", "behavior", "behavioral", "emotion"],
  ["sociology", "social", "society", "inequality", "race", "gender", "class", "community"],
  ["technology", "computing", "software", "computer", "data", "algorithm", "internet", "digital"],
  ["environment", "environmental", "climate", "energy", "sustainability", "renewable", "pollution", "ecology"],
  ["education", "teaching", "pedagogy", "learning", "classroom", "curriculum", "student"],
  ["citation", "cite", "reference", "bibliography", "plagiarism", "zotero", "apa", "mla", "chicago"],
];

/** Break a free-text query into meaningful lowercase tokens. */
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Expand tokens with their synonym/subject groups for broader, smarter matching. */
function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.includes(token)) {
        for (const member of group) expanded.add(member);
      }
    }
  }
  return [...expanded];
}

/**
 * Score a single resource against the query tokens.
 * Matches in keywords/tags/best_for weigh more than matches in the
 * free-text description, since those fields are curated for retrieval.
 */
function scoreResource(resource, tokens) {
  let score = 0;
  const fields = [
    { values: resource.keywords ?? [], weight: 3 },
    { values: resource.tags ?? [], weight: 3 },
    { values: resource.best_for ?? [], weight: 4 },
    { values: [resource.name ?? ""], weight: 2 },
    { values: [resource.description ?? ""], weight: 1 },
  ];

  for (const token of tokens) {
    for (const { values, weight } of fields) {
      const haystack = values.join(" ").toLowerCase();
      if (haystack.includes(token)) {
        score += weight;
      }
    }
  }
  return score;
}

/**
 * Retrieve the most relevant curated resources for a query.
 * Always returns something: if nothing scores, fall back to the
 * general "starting point" resources so the user is never stranded.
 */
export async function retrieveResources(query, limit = 6, modeId = DEFAULT_MODE_ID) {
  const all = await loadResources();
  // Pure search tools (e.g. Google Scholar) are never recommended as starting points.
  const resources = all.filter((r) => !r.search_tool_only);
  const mode = getSearchMode(modeId);
  const modeText = [
    mode.label,
    mode.description,
    mode.termStrategies.join(" "),
    mode.recommended.map(([name]) => name).join(" "),
    mode.termSuffixes.join(" "),
  ].join(" ");
  const tokens = expandTokens(tokenize(`${query} ${modeText}`));

  const scored = resources
    .map((r) => ({ resource: r, score: scoreResource(r, tokens) }))
    .sort((a, b) => b.score - a.score);

  let matches = scored.filter((s) => s.score > 0).slice(0, limit);

  // Fallback: no keyword hits → recommend orientation resources.
  if (matches.length === 0) {
    const fallbackIds = new Set(["databases-az", "research-guides", "ask-a-librarian"]);
    for (const [name] of mode.recommended) {
      const found = resources.find((r) => r.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]));
      if (found) fallbackIds.add(found.id);
    }
    matches = scored
      .filter((s) => fallbackIds.has(s.resource.id))
      .map((s) => ({ ...s, score: 0 }));
  } else {
    // Always make sure students know they can talk to a human.
    const hasLibrarian = matches.some((m) => m.resource.id === "ask-a-librarian");
    if (!hasLibrarian) {
      const librarian = scored.find((s) => s.resource.id === "ask-a-librarian");
      if (librarian) matches.push({ ...librarian, score: 0 });
    }
  }

  return matches.map((m) => m.resource);
}
