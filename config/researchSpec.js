import { DEFAULT_MODE_ID } from "./libraryLinks.js";
import { DEFAULT_SUBJECT_FOCUS_ID, SUBJECT_FOCUSES, resolveSubjectFocus } from "./subjectFocus.js";
import { RESOURCE_CONFIG_VERSION, SOURCE_MODE_CONTRACTS, getSourceModeContract } from "./resourceCapabilities.js";
import { extractSourceRequirements, normalizeSourceRequirements, sourceRequirementUpdates, stripSourceRequirementText, subjectDateScope } from "./sourceRequirements.js";

const REQUEST_WORDS = new Set([
  "about", "affect", "affects", "association", "between", "can", "compare",
  "could", "did", "do", "does", "effect", "effects", "evidence", "explore",
  "find", "focused", "give", "help", "how", "impact", "impacts", "into",
  "lead", "leads", "main", "more", "provide", "prove", "question", "reason",
  "relationship", "show",
  "suggest", "that", "the", "these", "this", "those", "topic", "what", "when",
  "where", "which", "why", "with", "without", "would", "from", "every", "all",
  "use", "using", "need", "want", "please", "me", "for", "of", "are", "was", "were",
  "exploring", "looking", "understand", "differences", "similarities",
  "representations", "regarding", "published", "publication",
  "only", "limit", "restrict", "publications",
  "and", "among", "within", "during", "after", "before", "across", "versus",
  "you", "some", "whether", "any", "there", "their", "theirs", "them",
  "its", "it", "his", "her", "hers", "our", "ours", "your", "yours", "as", "vs",
  "possible", "potential", "possibly", "potentially", "may", "might",
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
  { id: "urban-context", preferredTerm: "urban", synonyms: ["city", "metropolitan"], pattern: /\b(large cities|major cities|metropolitan areas|urban|city|metropolitan)\b/i },
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
  { id: "intelligence", preferredTerm: "intelligence", synonyms: ["cognitive ability"], pattern: /(?<!artificial )\b(intelligence|intelligent|cognitive ability)\b/i },
  { id: "economic-sanctions", preferredTerm: "sanctions", synonyms: ["economic sanctions", "financial sanctions", "trade sanctions"], pattern: /\b(?:(?:economic|financial|trade)\s+)?sanctions?\b/i },
  { id: "authoritarian-regimes", preferredTerm: "authoritarian regimes", synonyms: ["authoritarian", "autocratic", "autocracies", "dictatorships", "authoritarian states"], pattern: /\b(authoritarian regimes?|autocratic regimes?|autocracies|authoritarian states?|dictatorships?)\b/i },
  { id: "democracies", preferredTerm: "democracies", synonyms: ["democracy", "democratic", "democratic regimes", "democratic states"], pattern: /\b(democrac(?:y|ies)|democratic regimes?|democratic states?)\b/i },
  { id: "authoritarian-leadership", preferredTerm: "authoritarian leaders", synonyms: ["authoritarian leadership", "autocratic leaders"], pattern: /\b(authoritarian leaders?|authoritarian leadership|autocratic leaders?|cruel leaders?|leaders? who dominate countries)\b/i },
  { id: "political-leadership", preferredTerm: "political leadership", synonyms: ["heads of government", "political power"], pattern: /\b(political leadership|heads? of government|political power|dominate countries)\b/i },
  { id: "public-trust", preferredTerm: "public trust", synonyms: ["institutional trust", "public confidence", "legitimacy"], pattern: /\b(public trust|institutional trust|public confidence|legitimacy)\b/i },
  { id: "public-opinion", preferredTerm: "public opinion", synonyms: ["voter attitudes", "public attitudes"], pattern: /\b(public opinion|voter attitudes?|public attitudes?)\b/i },
  { id: "suburban-voters", preferredTerm: "suburban voters", synonyms: ["suburban electorate", "voters"], pattern: /\b(suburban voters?|suburban electorate)\b/i },
  { id: "surveillance", preferredTerm: "surveillance", synonyms: ["government monitoring", "mass surveillance"], pattern: /\b(surveillance|government monitoring|mass monitoring)\b/i },
  { id: "immigration", preferredTerm: "immigration", synonyms: ["immigrant*", "migrant*"], pattern: /\b(immigration|immigrants?|migrants?)\b/i },
  { id: "crime", preferredTerm: "crime", synonyms: ["criminality", "offending"], pattern: /\b(crimes?|criminality|offending)\b/i },
  { id: "elections", preferredTerm: "elections", synonyms: ["voting", "electoral"], pattern: /\b(elections?|electoral|voting)\b/i },
  { id: "voter-fraud", preferredTerm: "voter fraud", synonyms: ["election fraud", "electoral fraud"], pattern: /\b(voter fraud|election fraud|electoral fraud)\b/i },
  { id: "proportional-representation", preferredTerm: "proportional representation", synonyms: ["proportional electoral systems"], pattern: /\bproportional representation(?: systems?)?\b/i },
  { id: "plurality-voting", preferredTerm: "first-past-the-post", synonyms: ["plurality voting", "single-member plurality"], pattern: /\b(?:first[- ]past[- ]the[- ]post(?: systems?)?|plurality voting|single[- ]member plurality)\b/i },
  { id: "voter-turnout", preferredTerm: "voter turnout", synonyms: ["electoral participation"], pattern: /\bvoter turnout\b/i },
  { id: "adverse-effects", preferredTerm: "adverse effects", synonyms: ["harmful effects", "adverse events", "side effects"], pattern: /\b(?:adverse effects?|harmful effects?|adverse events?|side effects?)\b/i },
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
  const value = requestBody(text).replace(/^(?:an?|the|some|recent|introductory)\s+/i, "");
  // Preserve an explicitly selected non-default mode. The default scholarly
  // setting may be refined only by unmistakable source-type language.
  if (fallback && fallback !== DEFAULT_MODE_ID) return fallback;
  const knownItem = extractKnownItemRequest(text);
  if (knownItem) return knownItem.kind === "book" ? "books" : "scholarly";
  // Interpret the requested object before considering any topical nouns. In
  // "studies of newspaper coverage", newspaper is the subject, not the format.
  if (/^(?:(?:peer[- ]reviewed|scholarly|academic|scientific|journal|empirical|experimental|primary|original|recent)\s+)*(?:research|studies|study|articles?|papers?)\b/i.test(value) || /^(?:systematic|scoping|literature) reviews?\b/i.test(value)) return "scholarly";
  if (/^(?:primary sources?|archival (?:sources?|materials?)|original documents?)\b/i.test(value)) return "primary";
  if (/^(?:books?|e-?books?|monographs?|background sources?|handbooks?)(?:\s+(?:about|on|of|for|introducing|regarding|concerning)\b|$)/i.test(value)) return "books";
  if (/^(?:news(?:paper)?(?: articles?| reports?| coverage)?|current events?|press coverage)\b/i.test(value)) return "news";
  if (/^(?:compare|contrast)\b/i.test(value) && /\b(?:newspaper coverage|press coverage|news reports?)\b/i.test(value) && !/\b(?:studies|research|scholarly|peer[- ]reviewed|journal articles?)\b/i.test(value)) return "news";
  if (/^(?:datasets?|statistics?|market data|survey data|numerical data)\b/i.test(value)) return "data";
  if (/^(?:company financials?|financial statements?|annual reports?|10-k|revenue and debt)\b/i.test(value)) return "data";
  if (/\b(?:market research|market growth|brand positioning|consumer preferences?|rolex|luxury watches?|energy drinks?)\b/i.test(value) &&
      !/\b(?:peer[- ]reviewed|scholarly|journal articles?)\b/i.test(value)) return "data";
  if (/^(?:(?:sources?|research)\s+for\s+(?:an?|the)\s+)?(?:policy memo|legal sources?|case law|statutes?|court decisions?)\b/i.test(value)) return "legal-policy";
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
    subjectDateScope(text)?.label ||
    text.match(/\b(?:historical context|any time period|recent scholarship|foundational studies)\b/i)?.[0] || ""
  );
}

function geographyFacet(text) {
  if (/\bUS\b/.test(text)) return "United States";
  return clean(
    text.match(/\b(?:by country|countries)\b/i)?.[0]?.replace(/^by\s+/i, "") ||
    text.match(/\b(?:United States|U\.S\.|North Carolina|Europe|European Union|Global South|Latin America|Africa|Asia|Canada|United Kingdom|UK|rural communities|urban communities)\b/i)?.[0] || ""
  );
}

const METHOD_PATTERNS = [
  ["systematic review", /\bsystematic reviews?\b/gi, ['"systematic review"', '"systematic reviews"']],
  ["meta-analysis", /\bmeta[- ]analys(?:is|es)\b/gi, ["meta-analysis", "meta-analyses"]],
  ["scoping review", /\bscoping reviews?\b/gi, ['"scoping review"', '"scoping reviews"']],
  ["literature review", /\bliterature reviews?\b/gi, ['"literature review"', '"literature reviews"']],
  ["review", /\breview articles?\b/gi, ["review"]],
  ["qualitative interview", /\bqualitative interviews?\b/gi, ["qualitative AND interview*"]],
  ["qualitative study", /\bqualitative (?:stud(?:y|ies)|research)\b/gi, ['"qualitative study"', '"qualitative studies"', '"qualitative research"']],
  ["randomized controlled trial", /\brandomi[sz]ed controlled trials?\b/gi, ['"randomized controlled trial"', '"randomised controlled trial"']],
  ["longitudinal study", /\blongitudinal stud(?:y|ies)\b/gi, ["longitudinal"]],
  ["case study", /\bcase stud(?:y|ies)\b/gi, ['"case study"', '"case studies"']],
  ["empirical study", /\b(?:empirical|experimental|original|primary) (?:research(?: stud(?:y|ies))?|stud(?:y|ies))\b/gi, ["empirical", '"original research"', '"primary research"']],
  ["content analysis", /\bcontent analys(?:is|es)\b/gi, ['"content analysis"']],
  ["discourse analysis", /\bdiscourse analys(?:is|es)\b/gi, ['"discourse analysis"']],
  ["survey", /\bsurveys?\b(?!\s+data)/gi, ["survey*"]],
];

function extractMethodRequirements(text) {
  const value = String(text || "");
  const matches = METHOD_PATTERNS.flatMap(([label, pattern]) => [...value.matchAll(new RegExp(pattern.source, "gi"))].map((match) => ({ label, match })))
    // A method can itself be the research subject, rather than a source filter.
    .filter(({ match }) => !/\b(?:(?:quality|reliability|reporting|teaching|evaluation|criticism|limitations|accuracy|bias|reproducibility|use|role) of|(?:studies|research|articles?) (?:about|on|of))\s*$/i.test(value.slice(0, match.index)))
    .sort((a, b) => a.match.index - b.match.index);
  const include = [], exclude = [];
  let previous = null;
  const spans = matches.map(({ label, match }) => {
    const prefix = value.slice(0, match.index);
    // Consume the instruction as well as the method so "but I do not want"
    // cannot leak into the topical query. Only direct, local requests count;
    // a negation elsewhere in the research question is not an exclusion.
    const exclusion = prefix.match(/\b(?:(?:but|and)\s+)?(?:(?:i|we)\s+(?:(?:do|would)\s+not|don['’]t)\s+(?:want|need)|(?:please\s+)?(?:do not|don['’]t)\s+(?:include|use)|(?:please\s+)?(?:excluding|exclude|avoid|except|without|rather than|not|no))\s+(?:(?:any|the|more|other)\s+)*$/i);
    const continuation = previous?.excluded && /^\s*(?:,\s*)?(?:or|and)?\s*$/.test(value.slice(previous.end, match.index));
    const excluded = Boolean(exclusion || continuation);
    (excluded ? exclude : include).push(label);
    const span = { start: exclusion ? match.index - exclusion[0].length : continuation ? previous.end : match.index, end: match.index + match[0].length };
    previous = { end: span.end, excluded };
    return span;
  });
  let topicText = value;
  for (const span of spans.sort((a, b) => b.start - a.start)) topicText = `${topicText.slice(0, span.start)} ${topicText.slice(span.end)}`;
  return { include: [...new Set(include)], exclude: [...new Set(exclude)], topicText: clean(topicText) };
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

function requestBody(query) {
  return clean(query)
    .replace(/^(?:new|different|unrelated)\s+(?:research\s+)?topic\s*[:,-]?\s*/i, "")
    .replace(/^where\s+(?:do|can|could)\s+i\s+(?:find|get|locate)\s+/i, "")
    .replace(/^(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:help\s+me\s+)?(?:(?:find|show|give|provide|locate|get)(?:\s+me)?\s+|(?:i\s+)?(?:need|want)\s+|i(?:'m| am)\s+(?:interested in|looking for|researching)\s+)/i, "");
}

function researchTopicBody(query) {
  return requestBody(query)
    // Strip only a source request at the head. Book banning and newspaper
    // coverage elsewhere in the sentence remain legitimate research subjects.
    .replace(/^(?:(?:an?|the|some|recent|introductory|open[- ]access)\s+)*(?:(?:peer[- ]reviewed|scholarly|academic|scientific|journal)\s+)*(?:primary sources?|archival materials?|original documents?|background sources?|news(?:paper)? articles?|(?:books?|e-?books?|monographs?|handbooks?)(?=\s+(?:introducing|about|on|of|for|regarding|concerning)\b|$)|sources?|articles?|studies|papers?|research|evidence)\b\s*(?:(?:introducing|providing background on|about|on|of|regarding|concerning)\s+)?/i, "")
    .replace(/^(?:how|why)\s+(?:does|do|did|can|could)\s+(.+?)\s+(?:change|alter|increase|reduce|predict)\s+(.+)$/i, "$1 and $2")
    .replace(/^(?:can|could|would|please|help|find|show|give|provide|tell|i need|i want)\b[\s,:-]*/i, "")
    .replace(/^(?:me\s+)?(?:explore|compare|contrast|understand|research|analy[sz]e|investigate|examine)\b[\s,:-]*/i, "")
    .replace(/^(?:me\s+)?(?:more\s+)?(?:(?:sources?|articles?|research|results?|leads?)\b[\s,:-]*)+/i, "")
    .replace(/^(?:focused on|about|regarding|the relationship between|association between)\s+/i, "")
    .replace(/^(?:how|why|whether)\s+(?:does|do|did|can|could|might|may|is|are|were)\s+/i, "")
    .replace(/^(?:evidence\s+)?(?:prov(?:e|ing)|confirm(?:ing)?|demonstrat(?:e|ing)|show evidence)\s+(?:that\s+)?/i, "")
    .replace(/\b(?:benefits and (?:drawbacks|risks|harms)|advantages and disadvantages|pros and cons)\s+(?:of\s+)?/gi, "")
    // Translate proposed verdicts into outcomes to investigate, not mandatory
    // conclusion words. These transforms apply to any subject, not named topics.
    .replace(/\b(?:never|(?:do|does|did) not)\s+work\b/gi, "effectiveness")
    .replace(/\b(?:is|are|was|were)\s+(?:always\s+)?harmful\b/gi, " and adverse effects")
    .replace(/\b(?:is|are|was|were)\s+(?:always\s+)?unreliable\b/gi, " and reliability")
    .replace(/\b(?:more|less)\s+likely\s+to\s+/gi, " and ")
    .replace(/\bcommit(?:s|ted)?\s+(crimes?)\b/gi, "$1")
    .replace(/\bdiscriminat(?:e|es|ed|ing)\s+against\b/gi, " and discrimination and ")
    .replace(/\b(?:more|less)\s+(intelligent|reliable|effective|successful)\s+than\b/gi, "$1 and ")
    .replace(/\b(?:is|are|was|were)\s+(?:bad|good|harmful|beneficial)\s+for\b/gi, " and ")
    .replace(/\b(?:affect(?:s|ed|ing)?|influenc(?:e|es|ed|ing)|shape(?:s|d|ing)|relates? to|alters?|reduces?|increases?|predicts?|caus(?:e|es|ed|ing)|damag(?:e|es|ed|ing)|harm(?:s|ed|ing)?|improv(?:e|es|ed|ing)|destroy(?:s|ed|ing)?)\b(?!\s+(?:of|from)\b)/gi, (word, offset, text) => /^(?:harm|harms|damage|cause|causes)$/i.test(word) && (!text.slice(0, offset).trim() || /\b(?:the|possible|potential|about|on)\s*$/i.test(text.slice(0, offset))) ? word : " and ")
    .replace(/\b(?:always|never|every|all|naturally|main reason|hide(?:s|d)? the truth)\b/gi, " ")
    .replace(/\s+for\s+(?:this|the)\s+(?:research\s+)?topic\b/gi, " ")
    .replace(/\s+(?:and\s+)?(?:suggest|provide|give|show|include)\b[^?.!]*$/i, " ")
    .replace(/[?.!]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function genericConcepts(query) {
  // The full request has already been parsed. Reapplying request stripping to
  // residual spans would erase topical words, e.g. "book" in book banning.
  const value = clean(query)
    .replace(/[?!.:,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const quoted = [...value.matchAll(/["“]([^"”]{2,160})["”]/g)].map((match) => ({ preferredTerm: clean(match[1]), exactPhrase: true }));
  const chunks = value
    .replace(/["“]([^"”]{2,160})["”]/g, " ")
    .split(/\s+(?:and|versus|vs\.?|among|within|during|after|before|across|on|in|for|between|about|regarding|concerning|by)\s+/i)
    .map((chunk) => chunk
      .split(/\s+/)
      .filter((word) => word.length > 2 && !REQUEST_WORDS.has(word.toLowerCase()))
      .join(" "))
    .filter(Boolean).map((preferredTerm) => ({ preferredTerm }));
  return uniqBy([...quoted, ...chunks], (item) => item.preferredTerm.toLowerCase())
    .map(({ preferredTerm, exactPhrase }, index) => ({
      id: `concept-${index + 1}-${preferredTerm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36)}`,
      preferredTerm,
      synonyms: [],
      required: true,
      source: "parsed",
      ...(exactPhrase ? { exactPhrase: true } : {}),
    }));
}

function extractConcepts(query) {
  const method = extractMethodRequirements(stripSourceRequirementText(query));
  const date = subjectDateScope(method.topicText);
  const body = researchTopicBody(date ? method.topicText.replace(date.text, " ") : method.topicText);
  // US is normalized to the United States facet. Remove that already-retained
  // abbreviation before phrase matching so "large US cities" retains its scale.
  const value = clean(geographyFacet(query) === "United States" ? body.replace(/\bUS\b/g, " ") : body);
  // Match exact spans. A vocabulary match may replace its own words but must
  // never consume neighboring words or hide another overlapping concept.
  const quotedSpans = [...value.matchAll(/["“]([^"”]{2,300})["”]/g)].map((match, index) => ({
    concept: { id: `quoted-${index + 1}`, preferredTerm: clean(match[1]), synonyms: [], exactPhrase: true },
    matchedText: clean(match[1]), start: match.index, end: match.index + match[0].length,
  }));
  const matches = [...quotedSpans, ...CANONICAL_CONCEPTS.flatMap((concept) =>
    [...value.matchAll(new RegExp(concept.pattern.source, "gi"))].map((match) => ({
      concept, matchedText: match[0], start: match.index, end: match.index + match[0].length,
    }))
  ).filter((span) => !quotedSpans.some((quoted) => span.start < quoted.end && span.end > quoted.start))]
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const spans = matches;
  const multiplePopulations = new Set(spans.filter((span) => span.concept.facet === "population").map((span) => span.concept.id)).size > 1;
  const concepts = [];
  let position = 0;
  for (const span of spans) {
    if (span.start > position) concepts.push(...genericConcepts(value.slice(position, span.start)));
    const { pattern: _pattern, facet, ...concept } = span.concept;
    // Preserve an explicitly requested city scale: "large cities" can vary to
    // "major cities" or "metropolitan areas", not silently to any settlement.
    const cityScale = concept.id === "urban-context" && /^(?:large cities|major cities|metropolitan areas)$/i.test(span.matchedText);
    const equivalentTerms = cityScale ? ["large cities", "major cities", "metropolitan areas"] : [concept.preferredTerm, ...concept.synonyms];
    const matchedKnownTerm = equivalentTerms.some((term) => {
      const normalized = term.toLowerCase();
      const observed = span.matchedText.toLowerCase();
      return normalized.endsWith("*") ? observed.startsWith(normalized.slice(0, -1)) : observed === normalized;
    });
    const preferredTerm = matchedKnownTerm ? span.matchedText : concept.preferredTerm;
    // Population is retained as a facet and is added by every query compiler.
    if (facet !== "population" || multiplePopulations) concepts.push({
      ...concept,
      preferredTerm,
      synonyms: [...new Set(equivalentTerms.filter((term) => term.toLowerCase() !== preferredTerm.toLowerCase()))],
      required: true,
      source: concept.exactPhrase ? "quoted-phrase" : "controlled-vocabulary",
    });
    position = Math.max(position, span.end);
  }
  concepts.push(...genericConcepts(value.slice(position)));
  return uniqBy(concepts, (item) => item.preferredTerm.toLowerCase()).map((concept, index) => ({
    ...concept,
    id: concept.source === "parsed" ? `parsed-${index + 1}-${concept.id.slice(10)}` : concept.id,
  }));
}

function safetyFor(query) {
  const flags = [];
  if (/\b(always|never|every|all|naturally|prov(?:e|ing)(?: that)?|confirm(?:ing)? that|evidence that|main reason)\b/i.test(query)) flags.push("absolute-or-loaded-claim");
  if (/\b(cause|causes|caused|reason)\b/i.test(query)) flags.push("causal-claim");
  if (/\b(hide the truth|cover[- ]?up|conspiracy)\b/i.test(query)) flags.push("conspiratorial-premise");
  if (/\b(immigrants?|racial|ethnic|gender|disabled|autistic)\b.*\b(crime|inferior|less intelligent|dangerous|naturally)\b/i.test(query)) flags.push("stigmatizing-premise");
  if (/\b(?:middle ages|medieval|historical people|people in the past)\b.*\b(?:less intelligent|inferior|more primitive)\b/i.test(query)) flags.push("presentist-comparison");
  if (/\b(?:damages?|destroys?|(?:is|are|was|were) (?:bad|good|harmful|beneficial|unreliable|inferior|superior))\b/i.test(query)) flags.push("directional-premise");
  return {
    requiresPremiseCheck: flags.length > 0,
    flags,
    authorityPolicy: "research-orientation-not-conclusion",
  };
}

function searchIntentFor(topic, concepts, facets, knownItem = null) {
  const safety = safetyFor(topic);
  const requestedFocus = /\b(?:benefits and (?:drawbacks|risks|harms)|advantages and disadvantages|pros and cons)\b/i.test(topic) ? "benefits-and-harms"
    : /\b(?:adverse|harmful|side effects?|damag(?:e|es)|harms?|bad for)\b/i.test(topic) ? "adverse-effects" : "";
  const terms = concepts.map((concept) => concept.preferredTerm.replace(/\*/g, "")).filter(Boolean);
  const population = facets.population.replace(/adolescent\*/g, "adolescents").replace(/child\*/g, "children").replace(/\*/g, "");
  const scope = [population && `among ${population}`, facets.geography && !terms.some((term) => term.toLowerCase().includes(facets.geography.toLowerCase())) && `in ${facets.geography}`, facets.timePeriod].filter(Boolean).join(" ");
  const reformulated = safety.requiresPremiseCheck;
  return {
    originalQuestion: topic,
    neutralQuestion: knownItem ? `Locate ${knownItem.title}${knownItem.author ? ` by ${knownItem.author}` : ""}.`
      : `What does research show about ${terms.join(" and ") || "this topic"}${scope ? ` ${scope}` : ""}${reformulated && requestedFocus === "adverse-effects" ? ", including possible adverse effects" : ""}?`,
    reformulated,
    explanation: reformulated ? `The search tests the relationship without treating the proposed conclusion as established.${requestedFocus === "adverse-effects" ? " Your interest in possible harms is retained." : ""} Findings need to be assessed on their evidence.` : "",
    requestedFocus,
    scopeNotes: [subjectDateScope(topic)?.note].filter(Boolean),
  };
}

/** Comparison intent is a search structure, never a claim about the answer. */
export function researchComparison(topic, concepts = []) {
  if (!/\b(?:vs\.?|versus|compar(?:e|es|ed|ing|ison)|contrast|differences? between)\b/i.test(topic)) return null;
  const required = concepts.filter((concept) => concept.required !== false);
  if (required.length < 2) return null;
  const positioned = required.map((concept) => {
    const positions = [concept.preferredTerm, ...(concept.synonyms || [])].map((term) => {
      const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "[a-z]*");
      return String(topic).search(new RegExp(`\\b${escaped}\\b`, "i"));
    }).filter((position) => position >= 0);
    const vocabulary = CANONICAL_CONCEPTS.find((entry) => entry.id === concept.id);
    const vocabularyPosition = vocabulary ? String(topic).search(vocabulary.pattern) : -1;
    if (vocabularyPosition >= 0) positions.push(vocabularyPosition);
    return { concept, position: positions.length ? Math.min(...positions) : -1 };
  }).filter((item) => item.position >= 0).sort((a, b) => a.position - b.position);
  const divider = String(topic).match(/\b(?:vs\.?|versus|compared (?:with|to)|in contrast (?:to|with))\b/i);
  // In "compare loneliness in adolescents and older adults", loneliness is
  // the common outcome. The two population concepts are the compared sides.
  const populations = positioned.filter(({ concept }) => CANONICAL_CONCEPTS.some((entry) => entry.id === concept.id && entry.facet === "population"));
  const sides = divider
    ? [positioned.filter((item) => item.position < divider.index).at(-1)?.concept, positioned.find((item) => item.position > divider.index)?.concept]
    : (populations.length === 2 ? populations : positioned).slice(0, 2).map((item) => item.concept);
  const [left, right] = sides;
  if (!left || !right || left.id === right.id) return null;
  return { conceptIds: [left.id, right.id], terms: [left.preferredTerm, right.preferredTerm] };
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
  const topicalText = extractMethodRequirements(stripSourceRequirementText(topic)).topicText;
  const focus = resolveSubjectFocus(subjectFocusId, topicalText);
  const focusId = focus.selectedId && focus.selectedId !== "auto" ? focus.selectedId : focus.id;
  const disciplines = contextDisciplines(`${topicalText} ${extractMethodRequirements(context).topicText}`, focusId);
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
  const { include, exclude } = extractMethodRequirements(`${topic} ${context}`);
  const facets = {
    // When multiple populations were parsed as concepts, the comparison
    // compiler owns their grouping; a first-population facet would undo OR.
    population: concepts.filter((concept) => CANONICAL_CONCEPTS.some((entry) => entry.id === concept.id && entry.facet === "population")).length > 1
      ? "" : populationFacet(`${topic} ${context}`),
    geography: geographyFacet(`${topic} ${context}`),
    timePeriod: timeFacet(stripSourceRequirementText(`${topic} ${context}`)),
    method: include.join("; "),
    documentType: sourceContract.label,
  };
  const spec = {
    topic,
    mode: inferredMode,
    disciplines: disciplines.length ? disciplines : [focusId || "interdisciplinary"],
    concepts,
    comparison: researchComparison(topic, concepts),
    knownItem,
    searchIntent: searchIntentFor(topic, concepts, facets, knownItem),
    methodRequirements: { include, exclude },
    sourceRequirements: extractSourceRequirements(`${topic} ${context}`),
    facets,
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

  const rawConcepts = Array.isArray(supplied.concepts) ? supplied.concepts.slice(0, 12) : [];
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
        ...(raw.exactPhrase === true ? { exactPhrase: true } : {}),
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
  const suppliedPeriod = facet("timePeriod", "");
  const facetRequirements = extractSourceRequirements(/\b(?:published|publication)\b/i.test(suppliedPeriod) ? suppliedPeriod : "");
  const hasPublicationFacet = facetRequirements.publicationYearFrom !== null || facetRequirements.publicationYearTo !== null;
  const facets = {
    population: facet("population", baseSpec.facets.population),
    geography: facet("geography", baseSpec.facets.geography),
    timePeriod: hasPublicationFacet ? "" : facet("timePeriod", baseSpec.facets.timePeriod),
    method: facet("method", baseSpec.facets.method),
    documentType: facet("documentType", contract.label) || contract.label,
  };
  const normalizeMethods = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => bounded(value, 80)).filter((value) => METHOD_PATTERNS.some(([label]) => label === value)))];
  const parsedMethods = extractMethodRequirements(facets.method);
  const suppliedMethods = supplied.methodRequirements && typeof supplied.methodRequirements === "object"
    ? { include: normalizeMethods(supplied.methodRequirements.include), exclude: normalizeMethods(supplied.methodRequirements.exclude) }
    : baseSpec.methodRequirements || { include: [], exclude: [] };
  const methodRequirements = Object.hasOwn(rawFacets, "method") && (!supplied.methodRequirements || facets.method !== baseSpec.facets.method)
    ? { include: parsedMethods.include, exclude: parsedMethods.exclude.length ? parsedMethods.exclude : suppliedMethods.exclude }
    : suppliedMethods;
  const spec = {
    topic,
    mode,
    disciplines: disciplines.length ? disciplines : baseSpec.disciplines,
    concepts: concepts.length ? concepts : baseSpec.concepts,
    comparison: researchComparison(topic, concepts.length ? concepts : baseSpec.concepts),
    knownItem,
    searchIntent: searchIntentFor(topic, concepts.length ? concepts : baseSpec.concepts, facets, knownItem),
    methodRequirements,
    sourceRequirements: normalizeSourceRequirements({
      ...baseSpec.sourceRequirements,
      ...(hasPublicationFacet ? { publicationYearFrom: facetRequirements.publicationYearFrom, publicationYearTo: facetRequirements.publicationYearTo } : {}),
      ...(supplied.sourceRequirements && typeof supplied.sourceRequirements === "object" ? supplied.sourceRequirements : {}),
    }),
    facets,
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
    ...(supplied.searchExpansion === "full-synonyms" ? { searchExpansion: "full-synonyms" } : {}),
  };
  return { ...spec, planHash: deterministicHash(spec) };
}

/** Quotation is an explicit phrase choice, not the default for a whole clause. */
export function formatResearchTerm(value, { exact = false } = {}) {
  const term = clean(value);
  if (!term) return "";
  if (/^["(].*[)"]$/.test(term)) return term;
  if (/\b(?:AND|OR|NOT)\b/.test(term)) return `(${term})`;
  const words = term.split(/\s+/);
  if (exact || words.length > 1 && words.length <= 3) return `"${term.replace(/["“”]/g, "")}"`;
  return words.length > 3 ? `(${words.join(" AND ")})` : term;
}

export function researchFacetExpressions(spec) {
  const expressions = ["population", "geography"].map((name) => formatResearchTerm(spec?.facets?.[name])).filter(Boolean);
  const timePeriod = clean(spec?.facets?.timePeriod);
  // Historical calendar bounds constrain what a source discusses, not when it
  // was published or which literal years must appear in its title/abstract.
  if (timePeriod && !subjectDateScope(timePeriod, { publicationContext: false })) expressions.push(formatResearchTerm(timePeriod));
  const methods = spec?.methodRequirements;
  const methodExpression = (label) => {
    const terms = METHOD_PATTERNS.find(([name]) => name === label)?.[2];
    return terms ? `(${terms.join(" OR ")})` : formatResearchTerm(label);
  };
  if (methods?.include?.length || methods?.exclude?.length) {
    expressions.push(...(methods.include || []).map(methodExpression));
    expressions.push(...(methods.exclude || []).map((label) => `NOT ${methodExpression(label)}`));
  } else if (spec?.facets?.method) expressions.push(formatResearchTerm(spec.facets.method));
  return [...new Set(expressions)];
}

/** Preserve the common topic while searching either side of a comparison. */
export function researchConceptExpressions(spec, expressionFor = (concept) => formatResearchTerm(concept.preferredTerm, { exact: concept.exactPhrase === true })) {
  const required = (spec?.concepts || []).filter((concept) => concept.required !== false && concept.preferredTerm);
  const comparisonIds = new Set(spec?.comparison?.conceptIds || []);
  const sides = required.filter((concept) => comparisonIds.has(concept.id));
  if (sides.length !== 2) return required.map(expressionFor);
  const sideExpression = `(${sides.map((concept) => expressionFor(concept, required.indexOf(concept))).join(" OR ")})`;
  let grouped = false;
  return required.flatMap((concept, index) => {
    if (!comparisonIds.has(concept.id)) return [expressionFor(concept, index)];
    if (grouped) return [];
    grouped = true;
    return [sideExpression];
  });
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
  const concepts = researchConceptExpressions(spec);
  if (includeFacets) {
    for (const expression of researchFacetExpressions(spec)) if (!concepts.some((term) => term.toLowerCase().includes(expression.toLowerCase()))) concepts.push(expression);
  }
  return [...new Set(concepts)].join(" AND ");
}

export function researchSpecFromRequest(query, request = {}) {
  return buildResearchSpec(query, {
    modeId: request.modeId || request.mode,
    subjectFocusId: request.subjectFocusId,
    assignmentContext: request.assignmentContext,
    plannerContext: request.plannerContext,
  });
}

/** A dependent turn retains the reviewed interpretation until it changes a field. */
export function continueResearchSpec(baseSpec, previousSpec, latestText = "", contextText = "") {
  if (!previousSpec || typeof previousSpec !== "object" || Array.isArray(previousSpec)) return baseSpec;
  const priorBase = buildResearchSpec(previousSpec.topic || baseSpec.topic, { modeId: baseSpec.mode });
  const previous = mergeSuppliedResearchSpec(priorBase, previousSpec);
  const refinement = String(latestText).match(/\b(?:focus(?:ing)? on|narrow(?: it| this| the topic)? to|add(?:ing)?|also include|specifically)\s+(.+)/i)?.[1];
  const refinedConcepts = refinement ? extractConcepts(refinement) : [];
  const spec = {
    ...previous,
    mode: baseSpec.mode,
    sourceContract: baseSpec.sourceContract,
    concepts: uniqBy([...previous.concepts, ...refinedConcepts], (concept) => concept.preferredTerm.toLowerCase()),
    sourceRequirements: normalizeSourceRequirements({
      ...previous.sourceRequirements,
      ...sourceRequirementUpdates(contextText),
      ...sourceRequirementUpdates(latestText),
    }),
    correctedByStudent: Boolean(previousSpec.correctedByStudent),
  };
  delete spec.planHash;
  return { ...spec, planHash: deterministicHash(spec) };
}
