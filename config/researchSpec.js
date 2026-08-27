import { DEFAULT_MODE_ID } from "./libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID, SUBJECT_FOCUSES, resolveSubjectFocus } from "./subjectFocus.js";
import { RESOURCE_CONFIG_VERSION, SOURCE_MODE_CONTRACTS, getSourceModeContract } from "./resourceCapabilities.js";

const REQUEST_WORDS = new Set([
  "about", "affect", "affects", "association", "between", "can", "compare",
  "could", "did", "do", "does", "effect", "effects", "evidence", "explore",
  "find", "focused", "give", "help", "how", "impact", "impacts", "into",
  "lead", "leads", "main", "more", "provide", "prove", "question", "reason",
  "relationship", "research", "show", "source", "sources", "study", "studies",
  "suggest", "that", "the", "these", "this", "those", "topic", "what", "when",
  "where", "which", "why", "with", "without", "would", "from", "every", "all",
]);

const CANONICAL_CONCEPTS = [
  { id: "social-media", preferredTerm: "social media", synonyms: ["social platform*", "online social networking", "platform use", "Instagram", "TikTok", "Snapchat"], pattern: /\b(social media|social platforms?|online social network(?:ing)?|platform use|instagram|tiktok|snapchat)\b/i },
  { id: "adolescents", preferredTerm: "adolescent*", synonyms: ["teen*", "youth", "young people"], pattern: /\b(adolescents?|teenagers?|teens?|youth|young people)\b/i, facet: "population" },
  { id: "children", preferredTerm: "child*", synonyms: ["children", "pediatric"], pattern: /\b(children|child|pediatric)\b/i, facet: "population" },
  { id: "college-students", preferredTerm: "college students", synonyms: ["university students", "undergraduates", "first-year students"], pattern: /\b(college students?|university students?|undergraduates?|first[- ]year (?:college )?students?)\b/i, facet: "population" },
  { id: "older-adults", preferredTerm: "older adults", synonyms: ["elderly", "aging population"], pattern: /\b(older adults?|elderly|aging population)\b/i, facet: "population" },
  { id: "mental-health", preferredTerm: "mental health", synonyms: ["psychological well-being", "well-being", "wellbeing"], pattern: /\b(mental health|psychological well[- ]?being|well[- ]?being)\b/i },
  { id: "depression", preferredTerm: "depression", synonyms: ["depressive symptoms"], pattern: /\b(depression|depressive symptoms?)\b/i },
  { id: "anxiety", preferredTerm: "anxiety", synonyms: ["anxiety symptoms"], pattern: /\b(anxiety|anxious|anxiety symptoms?)\b/i },
  { id: "autism", preferredTerm: "autism spectrum disorder", synonyms: ["autism", "ASD"], pattern: /\b(autism(?: spectrum disorder)?|ASD)\b/i },
  { id: "vaccination", preferredTerm: "vaccin*", synonyms: ["immunization"], pattern: /\b(vaccines?|vaccination|immunization)\b/i },
  { id: "antidepressants", preferredTerm: "antidepressant*", synonyms: ["SSRI", "selective serotonin reuptake inhibitor"], pattern: /\b(antidepressants?|SSRIs?|selective serotonin reuptake inhibitors?)\b/i },
  { id: "cognitive-offloading", preferredTerm: "cognitive offloading", synonyms: ["external memory", "distributed cognition", "memory reliance"], pattern: /\b(cognitive offload(?:ing)?|external memory|distributed cognition|memory reliance)\b/i },
  { id: "sleep-deprivation", preferredTerm: "sleep deprivation", synonyms: ["sleep loss", "insufficient sleep"], pattern: /\b(sleep deprivation|sleep loss|insufficient sleep)\b/i },
  { id: "executive-function", preferredTerm: "executive function", synonyms: ["executive functioning", "cognitive control"], pattern: /\b(executive function(?:ing)?|cognitive control)\b/i },
  { id: "artificial-intelligence", preferredTerm: "artificial intelligence", synonyms: ["AI", "algorithm*", "automated decision making"], pattern: /\b(artificial intelligence|AI|algorithm(?:ic)?|automated decision(?: making)?|machine learning)\b/i },
  { id: "algorithmic-bias", preferredTerm: "algorithmic bias", synonyms: ["automated discrimination", "algorithmic discrimination", "AI bias"], pattern: /\b(algorithmic bias|algorithmic discrimination|automated discrimination|AI bias|biased automated)\b/i },
  { id: "employment", preferredTerm: "employment", synonyms: ["hiring", "job applicant*", "workplace"], pattern: /\b(employment|hiring|job applicants?|workplace)\b/i },
  { id: "policy", preferredTerm: "policy", synonyms: ["public policy", "policy analysis"], pattern: /\b(policy|public policy)\b/i },
  { id: "law-regulation", preferredTerm: "law", synonyms: ["legal", "regulation", "statute", "legislation"], pattern: /\b(law|legal|regulation|statute|legislation)\b/i },
  { id: "biodiversity", preferredTerm: "biodiversity", synonyms: ["biological diversity", "species diversity"], pattern: /\b(biodiversity|biological diversity|species diversity)\b/i },
  { id: "pollinators", preferredTerm: "pollinator*", synonyms: ["native bees", "pollination"], pattern: /\b(pollinators?|pollination|native bees?)\b/i },
  { id: "extreme-heat", preferredTerm: "extreme heat", synonyms: ["heat wave*", "heat stress", "urban heat"], pattern: /\b(extreme heat|heat waves?|heat stress|urban heat)\b/i },
  { id: "climate-change", preferredTerm: "climate change", synonyms: ["global warming", "climate variability"], pattern: /\b(climate change|global warming|climate variability)\b/i },
  { id: "climate-migration", preferredTerm: "climate migration", synonyms: ["climate displacement", "environmental migration"], pattern: /\b(climate migration|climate displacement|environmental migration)\b/i },
  { id: "carbon-sequestration", preferredTerm: "carbon sequestration", synonyms: ["carbon storage", "carbon capture"], pattern: /\b(carbon[- ]sequestration|carbon storage|carbon capture)\b/i },
  { id: "trauma", preferredTerm: "trauma", synonyms: ["PTSD", "traumatic stress"], pattern: /\b(trauma|PTSD|traumatic stress)\b/i },
  { id: "literature-fiction", preferredTerm: "literature OR fiction", synonyms: ["novel*", "literary", "narrative"], pattern: /\b(literature|fiction|novels?|literary|narratives?)\b/i },
  { id: "postwar", preferredTerm: "postwar", synonyms: ["post-war", "after World War II"], pattern: /\b(post[- ]?war|after (?:world war (?:ii|2)|wwii))\b/i },
  { id: "jazz-venues", preferredTerm: "jazz clubs", synonyms: ["jazz venues", "jazz-club culture"], pattern: /\b(jazz clubs?|jazz venues?|jazz[- ]club culture|jazz)\b/i },
  { id: "urban-context", preferredTerm: "urban", synonyms: ["city", "metropolitan"], pattern: /\b(urban|city|metropolitan)\b/i },
  { id: "cultural-identity", preferredTerm: "cultural identity", synonyms: ["identity", "culture"], pattern: /\b(cultural identity|urban (?:cultural )?identity|city identity|identity)\b/i },
  { id: "supply-chain", preferredTerm: "supply chain", synonyms: ["supply chains", "sourcing", "value chain"], pattern: /\b(supply[- ]chains?|sourcing|value[- ]chains?)\b/i },
  { id: "sustainability", preferredTerm: "sustainability", synonyms: ["environmental performance", "ESG"], pattern: /\b(sustainability|sustainable|environmental performance|ESG)\b/i },
  { id: "reporting-disclosure", preferredTerm: "reporting", synonyms: ["disclosure", "disclose"], pattern: /\b(reporting|disclosure|disclose[ds]?)\b/i },
  { id: "multinational-firms", preferredTerm: "multinational firms", synonyms: ["global companies", "multinational corporations"], pattern: /\b(multinational (?:firms?|corporations?|companies)|global companies|global corporations)\b/i },
  { id: "medieval", preferredTerm: "medieval", synonyms: ["Middle Ages"], pattern: /\b(medieval|middle ages)\b/i },
  { id: "icelandic-saga", preferredTerm: "Icelandic saga*", synonyms: ["Old Norse saga*"], pattern: /\b(icelandic sagas?|old norse sagas?)\b/i },
  { id: "manuscript-transmission", preferredTerm: "manuscript transmission", synonyms: ["textual transmission", "manuscript tradition"], pattern: /\b(manuscript transmission|textual transmission|manuscript tradition)\b/i },
  { id: "typography", preferredTerm: "typograph*", synonyms: ["printing", "print culture"], pattern: /\b(typographic|typography|printing|print culture)\b/i },
  { id: "watermarks", preferredTerm: "watermark*", synonyms: ["paper watermark*"], pattern: /\b(watermarks?|paper watermarks?)\b/i },
  { id: "almanacs", preferredTerm: "almanac*", synonyms: ["annual reference works"], pattern: /\b(almanacs?)\b/i },
  { id: "moral-responsibility", preferredTerm: "moral responsibility", synonyms: ["ethical responsibility", "accountability"], pattern: /\b(moral responsibility|ethical responsibility|accountability)\b/i },
  { id: "keynesian", preferredTerm: "Keynesian economics", synonyms: ["New Keynesian"], pattern: /\b(keynesian|new keynesian)\b/i },
  { id: "neoclassical", preferredTerm: "neoclassical economics", synonyms: ["neoclassical theory"], pattern: /\b(neoclassical)\b/i },
  { id: "recession", preferredTerm: "recession*", synonyms: ["economic crisis", "economic downturn"], pattern: /\b(recessions?|economic crisis|economic downturn)\b/i },
  { id: "inflation-targeting", preferredTerm: "inflation targeting", synonyms: ["price stability policy"], pattern: /\b(inflation targeting|price stability policy)\b/i },
  { id: "unemployment", preferredTerm: "unemployment", synonyms: ["labor market outcomes", "employment"], pattern: /\b(unemployment|labor market outcomes?)\b/i },
  { id: "monetary-policy", preferredTerm: "monetary policy", synonyms: ["monetary tightening", "monetary policy shocks"], pattern: /\b(monetary policy|monetary tightening|monetary policy shocks?)\b/i },
  { id: "energy-drinks", preferredTerm: "energy drinks", synonyms: ["functional beverages"], pattern: /\b(energy drinks?|functional beverages?)\b/i },
  { id: "consumer-preferences", preferredTerm: "consumer preferences", synonyms: ["consumer behavior", "consumer demand"], pattern: /\b(consumer preferences?|consumer behavior|consumer demand)\b/i },
  { id: "market-growth", preferredTerm: "market growth", synonyms: ["market trends", "market size"], pattern: /\b(market growth|market trends?|market size|market data)\b/i },
  { id: "statistics", preferredTerm: "statistics", synonyms: ["prevalence", "rates"], pattern: /\b(statistics?|prevalence|rates?)\b/i },
  { id: "dataset", preferredTerm: "dataset", synonyms: ["data set", "survey data"], pattern: /\b(datasets?|data sets?|survey data)\b/i },
  { id: "brand-positioning", preferredTerm: "brand positioning", synonyms: ["brand strategy", "brand prestige"], pattern: /\b(brand positioning|brand strategy|brand prestige)\b/i },
  { id: "younger-consumers", preferredTerm: "younger consumers", synonyms: ["Generation Z", "young adults"], pattern: /\b(younger consumers?|generation z|gen z|young adults?)\b/i, facet: "population" },
  { id: "company-revenue", preferredTerm: "revenue", synonyms: ["sales", "financial performance"], pattern: /\b(revenue|financial performance)\b/i },
  { id: "company-debt", preferredTerm: "debt", synonyms: ["leverage", "liabilities"], pattern: /\b(debt|leverage|liabilities)\b/i },
  { id: "merger", preferredTerm: "merger", synonyms: ["acquisition", "M&A"], pattern: /\b(merger|acquisition|M&A)\b/i },
  { id: "antimicrobial-resistance", preferredTerm: "antimicrobial resistance", synonyms: ["antibiotic resistance", "drug-resistant bacteria"], pattern: /\b(antimicrobial resistance|antibiotic resistance|drug[- ]resistant bacteria)\b/i },
  { id: "hospital-settings", preferredTerm: "hospital*", synonyms: ["inpatient", "healthcare-associated"], pattern: /\b(hospitals?|hospital settings?|inpatient|healthcare-associated)\b/i },
  { id: "blue-light", preferredTerm: "blue light", synonyms: ["screen exposure", "light-emitting devices"], pattern: /\b(blue[- ]?light|screen exposure|light-emitting devices?)\b/i },
  { id: "circadian-rhythm", preferredTerm: "circadian rhythm*", synonyms: ["circadian phase", "melatonin"], pattern: /\b(circadian rhythms?|circadian phase|melatonin)\b/i },
  { id: "climate-science", preferredTerm: "climate science", synonyms: ["climate scientists"], pattern: /\b(climate science|climate scientists?)\b/i },
  { id: "intelligence", preferredTerm: "intelligence", synonyms: ["cognitive ability"], pattern: /\b(intelligence|intelligent|cognitive ability)\b/i },
  { id: "authoritarian-leadership", preferredTerm: "authoritarian leaders", synonyms: ["authoritarian leadership", "autocratic leaders"], pattern: /\b(authoritarian leaders?|authoritarian leadership|autocratic leaders?|cruel leaders?|leaders? who dominate countries)\b/i },
  { id: "political-leadership", preferredTerm: "political leadership", synonyms: ["heads of government", "political power"], pattern: /\b(political leadership|heads? of government|political power|dominate countries)\b/i },
  { id: "public-trust", preferredTerm: "public trust", synonyms: ["institutional trust", "public confidence", "legitimacy"], pattern: /\b(public trust|institutional trust|public confidence|legitimacy)\b/i },
  { id: "public-opinion", preferredTerm: "public opinion", synonyms: ["voter attitudes", "public attitudes"], pattern: /\b(public opinion|voter attitudes?|public attitudes?)\b/i },
  { id: "suburban-voters", preferredTerm: "suburban voters", synonyms: ["suburban electorate", "voters"], pattern: /\b(suburban voters?|suburban electorate)\b/i },
  { id: "surveillance", preferredTerm: "surveillance", synonyms: ["government monitoring", "mass surveillance"], pattern: /\b(surveillance|government monitoring|mass monitoring)\b/i },
  { id: "immigration", preferredTerm: "immigration", synonyms: ["immigrant*", "migrant*"], pattern: /\b(immigration|immigrants?|migrants?)\b/i },
  { id: "crime", preferredTerm: "crime", synonyms: ["criminality", "offending"], pattern: /\b(crime|criminality|offending)\b/i },
  { id: "elections", preferredTerm: "elections", synonyms: ["voting", "electoral"], pattern: /\b(elections?|electoral|voting)\b/i },
  { id: "voter-fraud", preferredTerm: "voter fraud", synonyms: ["election fraud", "electoral fraud"], pattern: /\b(voter fraud|election fraud|electoral fraud)\b/i },
];

const MODE_PATTERNS = [
  ["primary", /\b(primary sources?|archives?|archival|manuscripts?|original documents?)\b/i],
  ["books", /\b(books?|ebooks?|monographs?|background sources?|handbooks?)\b/i],
  ["news", /\b(news|newspapers?|current events?|press coverage)\b/i],
  ["data", /\b(data|datasets?|statistics?|survey data|numerical evidence)\b/i],
  ["legal-policy", /\b(legal sources?|case law|statutes?|legislation|policy sources?)\b/i],
  ["scholarly", /\b(peer[- ]reviewed|scholarly articles?|journal articles?|empirical studies)\b/i],
];

const DISCIPLINE_PATTERNS = [
  ["biology-health", /\b(health|medicine|medical|biology|biomedical|nursing|public health)\b/i],
  ["science-engineering", /\b(science|engineering|technology|computer science)\b/i],
  ["psychology", /\b(psychology|psychological|behavior|cognition)\b/i],
  ["communication-media", /\b(communication|media|journalism)\b/i],
  ["economics", /\b(economics?|macroeconomics?|microeconomics?)\b/i],
  ["business", /\b(business|market research|management|finance)\b/i],
  ["history-humanities", /\b(history|historical|humanities|literature|philosophy)\b/i],
  ["education", /\b(education|teaching|learning|classroom|school)\b/i],
  ["policy-law", /\b(policy|law|legal|government|political science)\b/i],
  ["data-statistics", /\b(data|statistics|dataset|quantitative)\b/i],
];

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function bounded(value, limit = 160) {
  return clean(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit).trim();
}

function uniqBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function deterministicHash(value) {
  const input = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rp-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function contextMode(context, fallback) {
  for (const [mode, pattern] of MODE_PATTERNS) {
    if (pattern.test(context)) return mode;
  }
  return fallback;
}

export function inferExplicitModeRequest(text, fallback = DEFAULT_MODE_ID) {
  const value = clean(text);
  // Preserve an explicitly selected non-default mode. The default scholarly
  // setting may be refined only by unmistakable source-type language.
  if (fallback && fallback !== DEFAULT_MODE_ID) return fallback;
  if (/\b(primary sources?|archival (?:sources?|materials?)|original documents?)\b/i.test(value)) return "primary";
  if (/\b(?:datasets?|statistics?|market data|survey data|numerical data)\b/i.test(value)) return "data";
  if (/\b(?:company financials?|financial statements?|annual reports?|10-k|revenue and debt)\b/i.test(value)) return "data";
  if (/\b(?:market research|market growth|brand positioning|consumer preferences?|rolex|luxury watches?|energy drinks?)\b/i.test(value) &&
      !/\b(?:peer[- ]reviewed|scholarly|journal articles?)\b/i.test(value)) return "data";
  if (/\b(?:policy memo|legal sources?|case law|statutes?|court decisions?)\b/i.test(value)) return "legal-policy";
  if (/\b(?:books?|ebooks?|monographs?|background sources?)\b/i.test(value) &&
      /\b(?:need|find|show|give|provide|want|looking for|use|using|sources?)\b/i.test(value)) return "books";
  if (/\b(?:news|newspapers?|current events?|press coverage)\b/i.test(value) &&
      /\b(?:need|find|show|give|provide|want|looking for|use|using|sources?|coverage)\b/i.test(value)) return "news";
  return fallback || DEFAULT_MODE_ID;
}

function contextDisciplines(text, focusId) {
  const matches = DISCIPLINE_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([id]) => id);
  if (focusId && ![DEFAULT_SUBJECT_FOCUS_ID, "auto", "interdisciplinary"].includes(focusId)) {
    matches.unshift(focusId);
  }
  return [...new Set(matches)].slice(0, 3);
}

function populationFacet(text) {
  return CANONICAL_CONCEPTS.find((concept) => concept.facet === "population" && concept.pattern.test(text))?.preferredTerm || "";
}

function timeFacet(text) {
  if (/\bmid[- ]twentieth[- ]century\b/i.test(text)) return "1950s";
  return clean(
    text.match(/\b(?:18|19|20)\d0s\b/i)?.[0] ||
    text.match(/\b(?:last|past|previous)\s+\d{1,3}\s+years?\b/i)?.[0] ||
    text.match(/\b(?:since|after|before|from)\s+(?:19|20)\d{2}\b/i)?.[0] ||
    text.match(/\b(?:19|20)\d{2}\s*(?:-|to|through)\s*(?:19|20)\d{2}\b/i)?.[0] ||
    text.match(/\b(?:historical context|any time period|recent scholarship|foundational studies)\b/i)?.[0] || ""
  );
}

function geographyFacet(text) {
  return clean(
    text.match(/\b(?:by country|countries)\b/i)?.[0]?.replace(/^by\s+/i, "") ||
    text.match(/\b(?:United States|U\.S\.|North Carolina|Europe|European Union|Global South|Latin America|Africa|Asia|Canada|United Kingdom|UK|rural communities|urban communities)\b/i)?.[0] || ""
  );
}

function methodFacet(text) {
  return clean(
    text.match(/\b(?:systematic review|meta-analysis|randomized controlled trial|longitudinal study|qualitative study|case study|survey|content analysis|discourse analysis)\b/i)?.[0] || ""
  );
}

function stripOuterQuotes(value) {
  return clean(value).replace(/^["“”']+|["“”']+$/g, "").trim();
}

function plausiblePersonalAuthor(value) {
  const author = stripOuterQuotes(value).replace(/[?.!,;:]+$/, "").trim();
  if (!author || author.length > 120) return "";
  const words = author.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return "";
  if (/\b(?:about|articles?|books?|copies|edition|sources?|subject|topic)\b/i.test(author)) return "";
  return author;
}

/**
 * Parse an explicit known-title request without treating ordinary topical book
 * searches as known items. A trailing author is the strongest signal; quoted
 * or explicitly named titles are also accepted after a singular item type.
 */
export function extractKnownItemRequest(query) {
  const input = clean(query).replace(/[?.!]+$/, "").trim();
  if (!input) return null;

  const sourceMatch = input.match(
    /^(?:(?:can|could|would)\s+you\s+|please\s+|help\s+me\s+|i(?:'m| am)\s+looking\s+for\s+|i\s+(?:need|want)\s+|do\s+you\s+have\s+|find\s+|locate\s+|search\s+for\s+|get\s+|show\s+me\s+)?(?:an?\s+|the\s+)?(book|e-?book|copy|article|paper|title|work)\s+(?:(called|titled|named)\s+)?(.+)$/i
  );
  if (!sourceMatch) return null;

  const kind = /^(?:book|e-?book|copy)$/i.test(sourceMatch[1]) ? "book" : "article";
  const explicitlyNamed = Boolean(sourceMatch[2]);
  const remainder = clean(sourceMatch[3]);
  let title = "";
  let author = "";

  const quoted = remainder.match(/^["“]([^"”]{2,300})["”](?:\s+by\s+(.+))?$/i);
  if (quoted) {
    title = stripOuterQuotes(quoted[1]);
    author = quoted[2] ? plausiblePersonalAuthor(quoted[2]) : "";
  } else {
    const byIndex = remainder.toLowerCase().lastIndexOf(" by ");
    if (byIndex > 1) {
      const candidateAuthor = plausiblePersonalAuthor(remainder.slice(byIndex + 4));
      if (candidateAuthor) {
        title = stripOuterQuotes(remainder.slice(0, byIndex));
        author = candidateAuthor;
      }
    }
    if (!title && explicitlyNamed) title = stripOuterQuotes(remainder);
  }

  if (!title || title.length > 300) return null;
  return {
    kind,
    title,
    author,
  };
}

function researchTopicBody(query) {
  return clean(query)
    .replace(/^(?:can|could|would|please|help|find|show|give|provide|tell|i need|i want)\b[\s,:-]*/i, "")
    .replace(/^(?:me\s+)?(?:explore|compare|contrast|understand|research|analy[sz]e|investigate|examine)\b[\s,:-]*/i, "")
    .replace(/^(?:me\s+)?(?:more\s+)?(?:(?:sources?|articles?|research|results?|leads?)\b[\s,:-]*)+/i, "")
    .replace(/^(?:focused on|about|regarding|the relationship between|association between)\s+/i, "")
    .replace(/^(?:how|why|whether)\s+(?:does|do|did|can|could|might|may|is|are|were)\s+/i, "")
    .replace(/^(?:prove|show evidence)\s+(?:that\s+)?/i, "")
    .replace(/\b(?:affect(?:s|ed|ing)?|influenc(?:e|es|ed|ing)|shape(?:s|d|ing)|relates? to)\b/gi, " and ")
    .replace(/\b(?:always|never|every|all|naturally|main reason|hide(?:s|d)? the truth)\b/gi, " ")
    .replace(/\s+for\s+(?:this|the)\s+(?:research\s+)?topic\b/gi, " ")
    .replace(/\s+(?:and\s+)?(?:suggest|provide|give|show|include)\b[^?.!]*$/i, " ")
    .replace(/[?.!]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function genericConcepts(query) {
  const value = researchTopicBody(query)
    .replace(/[?!.:,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const quoted = [...value.matchAll(/["“]([^"”]{2,80})["”]/g)].map((match) => clean(match[1]));
  const chunks = value
    .split(/\s+(?:and|versus|vs\.?|among|within|during|after|before|across|on|in)\s+/i)
    .map((chunk) => chunk
      .split(/\s+/)
      .filter((word) => word.length > 2 && !REQUEST_WORDS.has(word.toLowerCase()))
      .slice(0, 5)
      .join(" "))
    .filter((chunk) => chunk.split(/\s+/).length >= 1);
  return uniqBy([...quoted, ...chunks], (item) => item.toLowerCase())
    .slice(0, 4)
    .map((preferredTerm, index) => ({
      id: `concept-${index + 1}-${preferredTerm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36)}`,
      preferredTerm,
      synonyms: [],
      required: true,
      source: "parsed",
    }));
}

function extractConcepts(query) {
  const canonical = CANONICAL_CONCEPTS
    .filter((concept) => concept.pattern.test(query))
    .map(({ pattern: _pattern, facet: _facet, ...concept }) => ({ ...concept, required: true, source: "controlled-vocabulary" }));
  const topical = canonical.filter((concept) => !["adolescents", "children", "college-students", "older-adults", "younger-consumers"].includes(concept.id));
  if (topical.length >= 2) return uniqBy(topical, (item) => item.id).slice(0, 5);
  const parsed = genericConcepts(query).filter((candidate) => {
    const candidateText = candidate.preferredTerm.toLowerCase();
    return !topical.some((concept) => {
      const conceptText = concept.preferredTerm.toLowerCase().replace(/\*/g, "");
      return candidateText.includes(conceptText) || conceptText.includes(candidateText);
    });
  });
  return uniqBy([...topical, ...parsed], (item) => item.preferredTerm.toLowerCase()).slice(0, 5);
}

function safetyFor(query) {
  const flags = [];
  if (/\b(always|never|every|all|naturally|prove that|main reason)\b/i.test(query)) flags.push("absolute-or-loaded-claim");
  if (/\b(cause|causes|caused|reason)\b/i.test(query)) flags.push("causal-claim");
  if (/\b(hide the truth|cover[- ]?up|conspiracy)\b/i.test(query)) flags.push("conspiratorial-premise");
  if (/\b(immigrants?|racial|ethnic|gender|disabled|autistic)\b.*\b(crime|inferior|less intelligent|dangerous|naturally)\b/i.test(query)) flags.push("stigmatizing-premise");
  if (/\b(?:middle ages|medieval|historical people|people in the past)\b.*\b(?:less intelligent|inferior|more primitive)\b/i.test(query)) flags.push("presentist-comparison");
  return {
    requiresPremiseCheck: flags.length > 0,
    flags,
    authorityPolicy: "research-orientation-not-conclusion",
  };
}

export function buildResearchSpec(
  query,
  {
    modeId = DEFAULT_MODE_ID,
    subjectFocusId = DEFAULT_SUBJECT_FOCUS_ID,
    assignmentContext = "",
    plannerContext = "",
  } = {}
) {
  const topic = clean(query);
  const context = clean(`${plannerContext} ${assignmentContext}`);
  // The explicit source-mode control is authoritative. Only an answer from the
  // guided planner may refine it; assignment-template defaults such as
  // "background sources" must not silently change a student's selected mode.
  const inferredMode = contextMode(
    clean(plannerContext),
    inferExplicitModeRequest(topic, modeId || DEFAULT_MODE_ID)
  );
  const focus = resolveSubjectFocus(subjectFocusId, topic);
  const focusId = focus.selectedId || focus.id;
  const disciplines = contextDisciplines(`${topic} ${context}`, focusId);
  const knownItem = extractKnownItemRequest(topic);
  const concepts = knownItem
    ? [
        {
          id: "known-item-title",
          preferredTerm: knownItem.title,
          synonyms: [],
          required: true,
          source: "known-item-title",
        },
        ...(knownItem.author ? [{
          id: "known-item-author",
          preferredTerm: knownItem.author,
          synonyms: [],
          required: true,
          source: "known-item-author",
        }] : []),
      ]
    : extractConcepts(topic);
  const sourceContract = getSourceModeContract(inferredMode);
  const spec = {
    topic,
    mode: inferredMode,
    disciplines: disciplines.length ? disciplines : [focusId || "interdisciplinary"],
    concepts,
    knownItem,
    facets: {
      population: populationFacet(`${topic} ${context}`),
      geography: geographyFacet(`${topic} ${context}`),
      timePeriod: timeFacet(`${topic} ${context}`),
      method: methodFacet(`${topic} ${context}`),
      documentType: sourceContract.label,
    },
    sourceContract: {
      id: sourceContract.id,
      label: sourceContract.label,
      requiredKinds: [...sourceContract.requiredKinds],
      allowedKinds: [...sourceContract.allowedKinds],
      excludedKinds: [...sourceContract.excludedKinds],
    },
    safety: safetyFor(topic),
    configVersion: RESOURCE_CONFIG_VERSION,
  };
  return { ...spec, planHash: deterministicHash(spec) };
}

function suppliedDisciplineId(value) {
  const candidate = bounded(value, 80).toLowerCase();
  if (!candidate) return "";
  const exact = SUBJECT_FOCUSES.find((focus) => focus.id === candidate);
  if (exact && exact.id !== DEFAULT_SUBJECT_FOCUS_ID) return exact.id;
  const labelMatch = SUBJECT_FOCUSES.find((focus) => {
    if (focus.id === DEFAULT_SUBJECT_FOCUS_ID) return false;
    const labels = [focus.label, focus.shortLabel]
      .map((label) => String(label || "").toLowerCase());
    return labels.some((label) => label === candidate || label.split(/\s*\/\s*|\s*\+\s*/).includes(candidate));
  });
  return labelMatch?.id || "";
}

/**
 * Merge a student-edited ResearchSpec into a freshly parsed base. Only bounded,
 * controlled fields are accepted; source contracts, safety flags, versions,
 * and hashes are always regenerated by the application.
 */
export function mergeSuppliedResearchSpec(baseSpec, supplied) {
  if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)) return baseSpec;
  const topic = bounded(supplied.topic, 500) || baseSpec.topic;
  const knownItem = extractKnownItemRequest(topic);
  const candidateMode = bounded(supplied.modeId || supplied.mode || supplied.sourceMode, 40);
  const mode = Object.hasOwn(SOURCE_MODE_CONTRACTS, candidateMode) ? candidateMode : baseSpec.mode;
  const contract = getSourceModeContract(mode);

  const rawConcepts = Array.isArray(supplied.concepts) ? supplied.concepts.slice(0, 5) : [];
  const concepts = rawConcepts
    .map((concept, index) => {
      const raw = typeof concept === "string" ? { preferredTerm: concept } : concept;
      if (!raw || typeof raw !== "object") return null;
      const preferredTerm = bounded(raw.preferredTerm || raw.term || raw.label, 120);
      if (!preferredTerm) return null;
      const synonyms = (Array.isArray(raw.synonyms) ? raw.synonyms : [])
        .map((synonym) => bounded(synonym, 80))
        .filter(Boolean)
        .slice(0, 5);
      const slug = preferredTerm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
      return {
        id: bounded(raw.id, 64) || `student-concept-${index + 1}-${slug}`,
        preferredTerm,
        synonyms: [...new Set(synonyms)],
        required: raw.required !== false,
        source: "student-corrected",
      };
    })
    .filter(Boolean);

  const rawDisciplines = Array.isArray(supplied.disciplines)
    ? supplied.disciplines
    : String(supplied.disciplines || supplied.discipline || "").split(/[,;|]/);
  const disciplines = [...new Set(rawDisciplines.map(suppliedDisciplineId).filter(Boolean))].slice(0, 3);
  const rawFacets = supplied.facets && typeof supplied.facets === "object" && !Array.isArray(supplied.facets)
    ? supplied.facets
    : {};
  const facet = (name, fallback, limit = 120) => Object.hasOwn(rawFacets, name)
    ? bounded(rawFacets[name], limit)
    : fallback;
  const spec = {
    topic,
    mode,
    disciplines: disciplines.length ? disciplines : baseSpec.disciplines,
    concepts: concepts.length ? concepts : baseSpec.concepts,
    knownItem,
    facets: {
      population: facet("population", baseSpec.facets.population),
      geography: facet("geography", baseSpec.facets.geography),
      timePeriod: facet("timePeriod", baseSpec.facets.timePeriod),
      method: facet("method", baseSpec.facets.method),
      documentType: facet("documentType", contract.label) || contract.label,
    },
    sourceContract: {
      id: contract.id,
      label: contract.label,
      requiredKinds: [...contract.requiredKinds],
      allowedKinds: [...contract.allowedKinds],
      excludedKinds: [...contract.excludedKinds],
    },
    safety: safetyFor(topic),
    configVersion: RESOURCE_CONFIG_VERSION,
    correctedByStudent: true,
  };
  return { ...spec, planHash: deterministicHash(spec) };
}

export function researchSpecQuery(spec, { includeFacets = true } = {}) {
  const knownTitle = clean(spec?.knownItem?.title);
  const knownAuthor = clean(spec?.knownItem?.author);
  if (knownTitle) {
    return [knownTitle, knownAuthor]
      .filter(Boolean)
      .map((value) => `"${value.replace(/["“”]/g, "")}"`)
      .join(" AND ");
  }
  const concepts = (spec?.concepts || [])
    .filter((concept) => concept.required !== false && concept.preferredTerm)
    .slice(0, 4)
    .map((concept) => {
      const value = clean(concept.preferredTerm);
      return /\s/.test(value) && !/["()]/.test(value) ? `"${value}"` : value;
    });
  if (includeFacets) {
    const population = clean(spec?.facets?.population);
    const geography = clean(spec?.facets?.geography);
    if (population && !concepts.some((term) => term.toLowerCase().includes(population.toLowerCase()))) concepts.push(`"${population}"`);
    if (geography) concepts.push(`"${geography}"`);
  }
  return [...new Set(concepts)].slice(0, 5).join(" AND ");
}

export function researchSpecFromRequest(query, request = {}) {
  return buildResearchSpec(query, {
    modeId: request.modeId || request.mode,
    subjectFocusId: request.subjectFocusId,
    assignmentContext: request.assignmentContext,
    plannerContext: request.plannerContext,
  });
}
