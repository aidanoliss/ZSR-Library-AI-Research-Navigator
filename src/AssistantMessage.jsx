import { useState } from "react";
import ResearchRoadmap from "./ResearchRoadmap.jsx";
import ResearchInterpretationPanel from "./ResearchInterpretationPanel.jsx";
import {
  buildAccessLinks,
  CITATION_LINKS,
  DEFAULT_MODE_ID,
  DEFAULT_RESPONSE_STYLE_ID,
  extractDoi,
  extractPmid,
  fillTemplate,
  getSearchMode,
  libkeyUrl,
  LIBKEY_NOMAD_URL,
  LIBRARY_LINKS,
} from "../config/libraryLinks.js";
import {
  buildResearchPlan,
  buildSearchTermSuggestions,
  isSubstantiveResearchRequest,
  normalizeSearchOptionKey,
} from "../config/researchAgent.js";
import { researchItemKey } from "./researchWorkspace.js";
import { downloadRis } from "./ris.js";

/* Monochrome inline icon per resource type — restrained, academic. */
const TypeIcon = {
  database: <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>,
  catalog: <svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 1 2 2z" /></svg>,
  guide: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m15 9-3 6-3-6 6 0z" /></svg>,
  service: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></svg>,
  collection: <svg viewBox="0 0 24 24"><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M9 21v-6h6v6" /></svg>,
  library_portal: <svg viewBox="0 0 24 24"><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>,
};
function typeIcon(type) {
  return TypeIcon[type] || TypeIcon.guide;
}

/* Small, monochrome inline icons — kept restrained for an academic feel. */
const Icon = {
  start: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15 9-3 6-3-6 6 0z" /></svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
  evaluate: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
  ),
  cite: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h4v6H7zM7 13c0 2 1 3 3 3" /><path d="M14 7h4v6h-4zM14 13c0 2 1 3 3 3" /></svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  helpful: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  notHelpful: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  ),
  save: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z" /></svg>
  ),
};

const SOCIAL_MEDIA_MENTAL_HEALTH_RESOURCES = [
  {
    resource_name: "PsycINFO",
    type: "database",
    badge: "DATABASE",
    url: "https://guides.zsr.wfu.edu/az.php?q=PsycINFO",
    bestFor: "Psychology studies on teen development, anxiety, depression, and well-being.",
  },
  {
    resource_name: "Communication & Mass Media Complete",
    type: "database",
    badge: "DATABASE",
    url: "https://guides.zsr.wfu.edu/az.php?q=Communication%20%26%20Mass%20Media%20Complete",
    bestFor: "Media effects, platform use, and online behavior research.",
  },
  {
    resource_name: "PubMed / MEDLINE",
    type: "database",
    badge: "DATABASE",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    bestFor: "Health and clinical studies on screen time and mental-health outcomes.",
  },
  {
    resource_name: "Subject & Course Research Guides",
    type: "guide",
    badge: "GUIDE",
    url: "https://zsr.wfu.edu/research/guides/",
    bestFor: "Librarian-recommended psychology, communication, and health resources.",
  },
  {
    resource_name: "A-Z Databases",
    type: "database",
    badge: "DATABASE",
    url: "https://guides.zsr.wfu.edu/az.php",
    bestFor: "Fallback list when you need another subject database.",
  },
];

const SOCIAL_MEDIA_DATABASE_STRATEGY = [
  {
    database: "PsycINFO",
    az_area: "Psychology",
    why: "Best first stop for peer-reviewed psychology research on adolescent development, depression, anxiety, and well-being.",
    preview_image: "/preview-psycinfo.png",
    search_inside: [
      'Subject terms: "Social Media" + "Adolescent Development"',
      "Limit by age group: Adolescence",
      "Filter to peer-reviewed empirical studies",
      "Try methodology limits such as longitudinal study or systematic review",
    ],
    journals_or_sources: [
      "Journal of Adolescent Health",
      "Developmental Psychology",
      "Journal of Youth and Adolescence",
      "Clinical Psychological Science",
    ],
  },
  {
    database: "Communication & Mass Media Complete",
    az_area: "Communication / Media Studies",
    why: "Best for media-effects research, platform behavior, online identity, and social comparison literature.",
    preview_image: "/preview-communication-media.png",
    search_inside: [
      "Search platform names: TikTok, Instagram, Snapchat",
      'Pair with media-effects terms: "social comparison", "online identity", "body image"',
      "Use scholarly / peer-reviewed filters",
      "Scan publication titles for communication and media-studies journals",
    ],
    journals_or_sources: [
      "New Media & Society",
      "Journal of Computer-Mediated Communication",
      "Social Media + Society",
      "Communication Research",
    ],
  },
  {
    database: "PubMed / MEDLINE",
    az_area: "Health Sciences / Medicine",
    why: "Useful for clinical, public-health, pediatric, and adolescent-health studies tied to mental-health outcomes.",
    preview_image: "/preview-pubmed.png",
    search_inside: [
      'Use health terms: "mental health", depression, anxiety, well-being',
      "Apply adolescent / child age filters where available",
      "Try review, systematic review, or meta-analysis filters",
      "Use MeSH-style terms such as Adolescent Health or Internet Use",
    ],
    journals_or_sources: [
      "JAMA Pediatrics",
      "Pediatrics",
      "Journal of Adolescent Health",
      "JAMA Psychiatry",
    ],
  },
  {
    database: "SocINDEX",
    az_area: "Sociology / Social Sciences",
    why: "Good secondary route for social context, peer relationships, inequality, cyberbullying, and family or school factors.",
    preview_image: "/preview-socindex.png",
    search_inside: [
      "Search cyberbullying, peer networks, social comparison, and youth culture",
      "Use subject terms for adolescence, family, schools, and inequality",
      "Filter to scholarly journals",
      "Combine with platform terms only after testing broader social concepts",
    ],
    journals_or_sources: [
      "Youth & Society",
      "Journal of Youth Studies",
      "Social Science & Medicine",
      "Children and Youth Services Review",
    ],
  },
];

const SUGGESTED_SEARCH_GROUPS = [
  { label: "Platforms", terms: "social media OR Instagram OR TikTok OR Snapchat" },
  { label: "Population", terms: "adolescent OR teenager OR youth" },
  { label: "Outcomes", terms: "mental health OR depression OR anxiety OR well-being" },
  { label: "Mechanisms", terms: "screen time OR social comparison OR cyberbullying" },
];

const SAMPLE_SEARCH_STRING =
  '("social media" OR TikTok OR Instagram) AND (adolescent OR teen*) AND ("mental health" OR anxiety OR depression)';

// Conservatively flag only clearly-primary source types.
const PRIMARY_TYPES = new Set(["archival_material", "manuscript", "manuscripts", "image", "audio", "realia", "collection"]);
const likelyPrimary = (t) => PRIMARY_TYPES.has(String(t || "").toLowerCase().replace(/\s+/g, "_"));

const NEXT_STEP_ACTIONS = [
  {
    label: "Find peer-reviewed articles",
    prompt: "Help me find peer-reviewed articles on this topic.",
  },
  {
    label: "Narrow my topic",
    prompt: "Help me narrow this topic into a focused research question.",
  },
  {
    label: "Get citation help",
    prompt: "Help me cite sources for this topic.",
  },
];

const REFINEMENT_OPTIONS = [
  { label: "Peer-reviewed articles", prompt: "only peer-reviewed or scholarly articles" },
  { label: "Primary sources", prompt: "primary sources only where appropriate" },
  { label: "Books", prompt: "books or ebooks" },
  { label: "Recent sources", prompt: "recent sources from the last 5 years when possible" },
  { label: "PsycINFO", prompt: "focus on PsycINFO" },
  { label: "PubMed / MEDLINE", prompt: "focus on PubMed or MEDLINE" },
  { label: "Comm & Mass Media", prompt: "focus on Communication & Mass Media Complete" },
];

function normalizeSuggestedFollowup(followup) {
  const raw = String(followup || "").trim();
  if (raw.length < 12) return null;
  if (/^(try (a |the )?(narrower|broader|different)|continue|more|ok\b|sure\b|yes\b|no\b)/i.test(raw)) return null;

  const cleaned = raw.replace(/\s+/g, " ").replace(/[?!.]+$/, "");

  const tellMore = cleaned.match(/^tell me more about\s+(.+)$/i);
  if (tellMore?.[1]) {
    const target = tellMore[1]
      .replace(/\byou are\b/gi, "I am")
      .replace(/\byou\b/gi, "me")
      .replace(/\byour\b/gi, "my")
      .trim();
    if (/specific event or person/i.test(target)) {
      return {
        label: "Help me choose a specific event or person to research",
        prompt: "Help me identify a few specific events or people I could research for this topic, and explain which one would be strongest for finding sources.",
      };
    }
    return {
      label: `Help me explore ${target}`,
      prompt: `Help me explore ${target} for this topic and suggest focused research angles I can search in ZSR.`,
    };
  }

  const aspect = cleaned.match(/^what specific aspect of\s+(.+?)\s+are you\s+(?:researching|interested in)(?:\s*\((?:e\.g\.,?\s*)?(.+)\))?$/i);
  if (aspect?.[1]) {
    const examples = aspect[2]
      ?.replace(/\betc\.?$/i, "")
      .replace(/\s+or\s+/gi, ", or ")
      .trim();
    const label = examples
      ? `Narrow to ${examples}`
      : `Narrow to one specific aspect of ${aspect[1]}`;
    return { label, prompt: label };
  }

  const interested = cleaned.match(/^are you interested in\s+(.+)$/i);
  if (interested?.[1]) {
    const topic = interested[1]
      .replace(/^learning about\s+/i, "")
      .replace(/^finding\s+/i, "")
      .replace(/\byou\b/gi, "I")
      .replace(/\byour\b/gi, "my");
    const label = `Look into ${topic}`;
    return { label, prompt: label };
  }

  const wouldLike = cleaned.match(/^(would you like|do you want|should i|can i)\s+(?:me to\s+)?(.+)$/i);
  if (wouldLike?.[2]) {
    const action = wouldLike[2]
      .replace(/^to\s+/i, "")
      .replace(/\byou\b/gi, "me")
      .replace(/\byour\b/gi, "my");
    const normalizedAction = /^recommendations?\s+for\b/i.test(action)
      ? action.replace(/^recommendations?/i, "Find recommendations")
      : action;
    const label = /^(find|search|look|focus|narrow|broaden|compare|explain|cite|evaluate|show|help)\b/i.test(normalizedAction)
      ? normalizedAction[0].toUpperCase() + normalizedAction.slice(1)
      : `Help me ${normalizedAction}`;
    return { label, prompt: label };
  }

  if (/\?$/.test(raw) && /^(are|is|do|does|did|would|could|should|can|what|why|how)\b/i.test(raw)) {
    return null;
  }

  return { label: cleaned, prompt: cleaned };
}

function isSocialMediaMentalHealthTopic(topic) {
  const t = String(topic || "").toLowerCase();
  return (
    t.includes("social media") &&
    /(adolescent|teen|youth)/.test(t) &&
    /(mental health|depression|anxiety|well-being|wellbeing)/.test(t)
  );
}

function sourceImageSrc(name) {
  if (/special collections|archives/i.test(String(name || ""))) {
    return "/special-collections-preview.png";
  }
  return null;
}

function SourceImage({ resourceName, type }) {
  const src = sourceImageSrc(resourceName, type);
  if (!src) return null;
  return (
    <img
      className="source-image"
      src={sourceImageSrc(resourceName, type)}
      alt=""
      loading="lazy"
    />
  );
}

function resourcePreviewImage(resource) {
  if (resource?.previewImage) return resource.previewImage;
  return databasePreviewImage({
    database: resource?.name || "ZSR Resource",
    az_area: resource?.subjectArea || "ZSR research path",
  });
}

function displayStartingPoint(sp, resource) {
  const resourceName = sp.resource_name || resource?.name || "ZSR resource";
  const isHomepage =
    resource?.id === "zsr-homepage" || /zsr library homepage/i.test(resourceName);
  if (!isHomepage) return sp;
  return {
    ...sp,
    resource_name: "ZSR topic research tools",
    type: "library_portal",
    badge: "TOOLS",
    bestFor:
      "Use A-Z Databases, Subject & Course Research Guides, Find a Journal, ZSR Library Search, and Ask ZSR from this page.",
  };
}

/** Cover image for a live result. Missing covers are omitted instead of faked. */
function ResultThumb({ cover }) {
  const [failed, setFailed] = useState(false);
  if (cover && !failed) {
    return (
      <img
        className="result-thumb"
        src={cover}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return null;
}

function boundedResultText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 3)).trimEnd()}...`;
}

const NON_AUTHOR_RESULT_RE = /\b(?:acknowledg|agenc|associat|centre|center|cnrs|contribution|council|depart|ecosyst|facult|foundat|funding|hospital|inrae|institut|laborat|ministry|national|nerc|program|project|recherche|research|school|supported|survey|team|unit|universit|would like)/i;

function looksLikeResultAuthor(value) {
  const author = String(value || "").replace(/\s+/g, " ").trim();
  if (!author || author.length > 80 || /\d|https?:|[()[\]{}:]/i.test(author)) return false;
  if (NON_AUTHOR_RESULT_RE.test(author)) return false;
  const words = author.replace(/,/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return words.every((word) => /^[\p{L}][\p{L}.'’\-]*$/u.test(word));
}

function compactResultAuthor(value) {
  const authors = String(value || "")
    .split(/\s*;\s*/)
    .map((author) => author.trim())
    .filter(Boolean);
  if (!authors.length) return "";
  const likelyAuthors = authors.filter(looksLikeResultAuthor);
  if (!likelyAuthors.length) {
    return authors.length === 1 ? boundedResultText(authors[0], 80) : "";
  }
  const visible = likelyAuthors.slice(0, 2).join("; ");
  const suffix = likelyAuthors.length > 2 && !/\bet al\.?$/i.test(visible) ? " et al." : "";
  return boundedResultText(`${visible}${suffix}`, 110);
}

function resultMetaText(result) {
  return [
    boundedResultText(result?.type, 36),
    compactResultAuthor(result?.author),
    boundedResultText(result?.date, 24),
  ].filter(Boolean).join(" · ");
}

// Render inline **bold** markdown as real <strong> instead of literal asterisks.
function renderRich(text) {
  return String(text || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      return m ? <strong key={i}>{m[1]}</strong> : part;
    });
}

function SectionHeader({ icon, children }) {
  return (
    <h3>
      <span className="sec-icon">{icon}</span>
      {children}
    </h3>
  );
}

function EvidenceChips({ items = [], compact = false }) {
  const visible = items.filter(Boolean).slice(0, 4);
  if (!visible.length) return null;
  return (
    <div className={`evidence-chips ${compact ? "compact" : ""}`} aria-label="Recommendation evidence">
      {visible.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function provenanceText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item != null && item !== "")
      .map(([key, item]) => `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${provenanceText(item)}`)
      .join("; ");
  }
  return String(value || "").trim();
}

function ResourceProvenance({ resource }) {
  const provenance = resource.provenance || {};
  const rows = [
    ["Why this route", resource.whyFits],
    ["Source kinds", provenance.sourceKinds || resource.sourceKinds],
    ["Query dialect", provenance.queryDialect || resource.queryDialect],
    ["Matched source mode", provenance.matchedSourceMode],
    ["Matched subject", provenance.matchedSubject],
    ["Not best for", resource.notBestFor],
    ["Metadata source", provenance.metadataSource || resource.metadataSource],
    ["Maintenance owner", provenance.maintenanceOwner || resource.maintenanceOwner],
    ["Review status", provenance.reviewStatus || resource.reviewStatus],
    ["Configuration reviewed", provenance.configReviewedOn || resource.configReviewedOn],
    ["Librarian reviewed", provenance.librarianReviewedOn || resource.librarianReviewedOn],
    ["Configuration version", provenance.configVersion || resource.configVersion],
  ].map(([label, value]) => [label, provenanceText(value)]).filter(([, value]) => value);
  if (!rows.length) return null;
  return (
    <dl className="resource-provenance">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CitationLinks({ guides } = {}) {
  const links = guides?.length
    ? guides
        .filter((guide) => guide.url)
        .map((guide) => ({ label: guide.label, url: guide.url }))
    : CITATION_LINKS;
  const todos = guides?.filter((guide) => !guide.url) || [];
  return (
    <div className="citation-links">
      {links.map((link) => (
        <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
          {link.label}
          <span className="ext-icon">{Icon.external}</span>
        </a>
      ))}
      {todos.map((guide) => (
        <span key={guide.id} className="citation-todo">
          {guide.label}: URL pending librarian review
        </span>
      ))}
    </div>
  );
}

function azDatabaseHref(database) {
  return `https://guides.zsr.wfu.edu/az.php?q=${encodeURIComponent(database || "")}`;
}

function uniqueTerms(terms = []) {
  const seen = new Set();
  const out = [];
  for (const term of terms) {
    const clean = String(term || "").trim();
    const key = normalizeSearchOptionKey(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

const DATABASE_PREVIEW_PALETTES = [
  { bg: "#fff3cf", ink: "#4d3607", accent: "#b88a22", soft: "#fffaf0" },
  { bg: "#eaf3f0", ink: "#183f38", accent: "#357f72", soft: "#f7fcfa" },
  { bg: "#f0edf9", ink: "#302650", accent: "#6955a3", soft: "#fbf9ff" },
  { bg: "#edf3fb", ink: "#18395e", accent: "#3d72a7", soft: "#f8fbff" },
  { bg: "#f9eee6", ink: "#553018", accent: "#b36a2b", soft: "#fffaf6" },
];

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function previewLines(value, maxLength = 22) {
  const words = String(value || "ZSR Resource").trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function normalizedPreviewLabel(database) {
  const value = String(database || "").trim();
  const lower = value.toLowerCase();
  if (lower.includes("cq")) return "CQ Researcher";
  if (lower.includes("proquest")) return "ProQuest";
  if (lower.includes("communication") || lower.includes("mass media")) return "Communication & Mass Media";
  if (lower.includes("psycinfo")) return "PsycINFO";
  if (lower.includes("pubmed") || lower.includes("medline")) return "PubMed / MEDLINE";
  if (lower.includes("socindex")) return "SocINDEX";
  if (lower.includes("jstor")) return "JSTOR";
  if (lower.includes("factiva")) return "Factiva";
  if (lower.includes("scholar")) return "Google Scholar";
  if (lower.includes("a-z") || lower.includes("database")) return value || "A-Z Databases";
  if (lower.includes("article")) return "ZSR Articles";
  return value || "ZSR Resource";
}

function previewKicker(item) {
  const database = String(item?.database || "").toLowerCase();
  if (item?.az_area) return item.az_area;
  if (database.includes("cq")) return "Issues, policy, background";
  if (database.includes("proquest")) return "Articles, news, dissertations";
  if (database.includes("factiva")) return "Business and news";
  if (database.includes("pubmed") || database.includes("medline")) return "Health sciences";
  if (database.includes("psycinfo")) return "Psychology";
  if (database.includes("jstor")) return "Scholarly archives";
  return "ZSR research path";
}

function databasePreviewSvg(item) {
  const label = normalizedPreviewLabel(item?.database);
  const hash = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = DATABASE_PREVIEW_PALETTES[hash % DATABASE_PREVIEW_PALETTES.length];
  const [lineOne, lineTwo] = previewLines(label);
  const subtitle = previewKicker(item);
  const secondLine = lineTwo
    ? `<text x="54" y="162" font-family="Georgia, serif" font-size="34" font-weight="700" fill="${palette.ink}">${escapeSvgText(lineTwo)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${escapeSvgText(label)} preview">
    <rect width="640" height="360" rx="24" fill="${palette.bg}"/>
    <rect x="30" y="30" width="580" height="300" rx="20" fill="${palette.soft}" stroke="${palette.accent}" stroke-width="3"/>
    <rect x="54" y="58" width="154" height="20" rx="10" fill="${palette.accent}" opacity="0.18"/>
    <text x="54" y="74" font-family="Arial, sans-serif" font-size="15" font-weight="800" letter-spacing="2.4" fill="${palette.ink}" opacity="0.78">ZSR PATH</text>
    <text x="54" y="122" font-family="Georgia, serif" font-size="36" font-weight="700" fill="${palette.ink}">${escapeSvgText(lineOne)}</text>
    ${secondLine}
    <rect x="54" y="204" width="316" height="12" rx="6" fill="${palette.ink}" opacity="0.16"/>
    <rect x="54" y="232" width="248" height="12" rx="6" fill="${palette.ink}" opacity="0.12"/>
    <rect x="54" y="264" width="202" height="34" rx="17" fill="${palette.accent}" opacity="0.16"/>
    <text x="75" y="286" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="${palette.ink}">${escapeSvgText(subtitle)}</text>
    <circle cx="532" cy="104" r="48" fill="${palette.accent}" opacity="0.14"/>
    <path d="M506 104h52M532 78v52" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round" opacity="0.72"/>
  </svg>`;
}

function databasePreviewImage(item) {
  if (item?.preview_image) return item.preview_image;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(databasePreviewSvg(item))}`;
}

// A result's DOI/PMID may live in dedicated fields or inside its text.
function resultIds(r) {
  const text = `${r.doi || ""} ${r.pmid || ""} ${r.description || ""} ${(r.detailPoints || []).join(" ")}`;
  return { doi: r.doi || extractDoi(text), pmid: r.pmid || extractPmid(text) };
}

function SaveResearchButton({ item, onSaveResearchItem, savedResearchItemKeys }) {
  if (!onSaveResearchItem) return null;
  const saved = savedResearchItemKeys?.has(researchItemKey(item));
  return (
    <button
      type="button"
      className={`save-research-btn ${saved ? "saved" : ""}`}
      onClick={() => onSaveResearchItem(item)}
      disabled={saved}
      aria-label={saved ? `${item.title} saved to research trail` : `Save ${item.title} to research trail`}
    >
      {Icon.save}
      <span>{saved ? "Saved" : "Save to trail"}</span>
    </button>
  );
}

function DatabaseStrategySection({ strategy = [], topic = "", onSaveResearchItem, onTrackSearch, savedResearchItemKeys }) {
  const visible = strategy.filter((item) => item?.database).slice(0, 4);
  if (!visible.length) return null;

  return (
    <section className="database-strategy">
      <SectionHeader icon={Icon.search}>Where to search in ZSR</SectionHeader>
      <p className="database-scope-note">
        Guided shortlist based on the topic. Use A-Z Databases to confirm access and open the database.
      </p>
      <ul className="database-strategy-list">
        {visible.map((item) => {
          const searchInside = (item.search_inside || []).filter(Boolean).slice(0, 4);
          const sourceLeads = (item.journals_or_sources || []).filter(Boolean).slice(0, 5);
          const previewImage = databasePreviewImage(item);
          const databaseUrl = azDatabaseHref(item.database);
          const savedItem = { kind: "database", title: item.database, url: databaseUrl, detail: item.why || item.az_area || "ZSR database path" };
          return (
            <li key={item.database} className="database-card-item">
              <details className="database-card has-preview">
                <summary className="database-card-toggle">
                  <img
                    className="database-preview"
                    src={previewImage}
                    alt=""
                    loading="lazy"
                  />
                  <div className="database-card-summary-copy">
                    <div className="database-card-head">
                      <span className="database-name">{item.database}</span>
                      {item.az_area && <span className="database-area-pill">{item.az_area}</span>}
                    </div>
                    {item.why && <p>{item.why}</p>}
                  </div>
                </summary>
                <div className="database-card-details">
                  <div className="database-link-row">
                    <a
                      className="database-action"
                      href={databaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onTrackSearch?.({ query: item.database, tool: "ZSR A-Z Databases", url: databaseUrl })}
                    >
                      Search A-Z for this database
                      <span className="ext-icon">{Icon.external}</span>
                    </a>
                    {topic && (
                      <a
                        className="database-topic-search"
                        href={fillTemplate(LIBRARY_LINKS.zsrArticleSearch, `${topic} ${item.database}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => onTrackSearch?.({ query: `${topic} ${item.database}`, tool: "ZSR Articles", url: fillTemplate(LIBRARY_LINKS.zsrArticleSearch, `${topic} ${item.database}`) })}
                      >
                        Search this topic in ZSR Articles
                        <span className="ext-icon">{Icon.external}</span>
                      </a>
                    )}
                  </div>
                  <SaveResearchButton item={savedItem} onSaveResearchItem={onSaveResearchItem} savedResearchItemKeys={savedResearchItemKeys} />
                  {item.az_area && (
                    <p className="database-area">
                      <strong>A-Z area:</strong> {item.az_area}
                    </p>
                  )}
                  <EvidenceChips
                    compact
                    items={[
                      "A-Z database route",
                      item.az_area ? `${item.az_area} fit` : "",
                      "Access must be confirmed in ZSR",
                    ]}
                  />
                  {searchInside.length > 0 && (
                    <section className="search-inside database-detail-block">
                      <h4>Search inside this database</h4>
                      <div>
                        {searchInside.map((term) => (
                          <span key={term}>{term}</span>
                        ))}
                      </div>
                    </section>
                  )}
                  {sourceLeads.length > 0 && (
                    <section className="source-leads database-detail-block">
                      <h4>Journals, periodicals, or source types inside this area</h4>
                      <ul>
                        {sourceLeads.map((lead) => (
                          <li key={lead}>{lead}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TopicOptionsSection({ options = [], onFollowup }) {
  const visible = options
    .filter((option) => option?.title || option?.research_question)
    .slice(0, 6);
  if (!visible.length) return null;

  return (
    <section className="topic-options-section">
      <SectionHeader icon={Icon.info}>Topic options</SectionHeader>
      <div className="topic-options-grid" role="list">
        {visible.map((option, index) => {
          const title = option.title || `Option ${index + 1}`;
          const question = option.research_question || title;
          const sourceTypes = (option.source_types || []).filter(Boolean).slice(0, 4);
          const terms = (option.search_terms || []).filter(Boolean).slice(0, 4);
          return (
            <details className="topic-option-card" key={`${title}-${index}`} role="listitem">
              <summary className="topic-option-summary">
                <div className="topic-option-head">
                  <span>{index + 1}</span>
                  <h4>{title}</h4>
                </div>
              </summary>
              <div className="topic-option-body">
                <p className="topic-question">{question}</p>
                {option.why && <p>{option.why}</p>}
                {sourceTypes.length > 0 && (
                  <div className="mini-chip-row" aria-label="Likely source types">
                    {sourceTypes.map((sourceType) => <span key={sourceType}>{sourceType}</span>)}
                  </div>
                )}
                {terms.length > 0 && (
                  <details className="topic-terms">
                    <summary>Starter searches</summary>
                    <ul>
                      {terms.map((term) => <li key={term}><code>{term}</code></li>)}
                    </ul>
                  </details>
                )}
                {onFollowup && (
                  <button
                    type="button"
                    className="topic-option-use"
                    onClick={() => onFollowup(
                      [
                        `Chosen request: ${question}.`,
                        sourceTypes.length ? `Likely source types: ${sourceTypes.join(", ")}.` : "",
                        terms.length ? `Starter concepts: ${terms.join(" | ")}.` : "",
                        "Build a focused ZSR source-finding plan. Do not generate more topic options. Include where to search in ZSR, keyword-based search combinations, source evaluation, and concrete next steps.",
                      ].filter(Boolean).join(" "),
                      { skipPlanner: true }
                    )}
                  >
                    Use this angle
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function ClarifyingPlannerPrompt({ questions = [], onOpenPlanner }) {
  const visible = questions
    .filter((item) => item?.question && Array.isArray(item.options) && item.options.length)
    .slice(0, 3);
  if (!visible.length || !onOpenPlanner) return null;

  return (
    <section className="planner-inline no-print">
      <div>
        <SectionHeader icon={Icon.search}>Narrow the research plan</SectionHeader>
        <p>Answer a few quick questions before searching so the next response can choose the right ZSR path.</p>
      </div>
      <ol>
        {visible.map((item) => <li key={item.question}>{item.question}</li>)}
      </ol>
      <button type="button" onClick={() => onOpenPlanner(visible)}>Open guided planner</button>
    </section>
  );
}

function FindFullText() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const raw = value.trim();
    const doi = extractDoi(raw);
    // In this dedicated field a bare number is an explicit PubMed ID.
    const pmid = doi ? "" : extractPmid(raw) || (/^\d{4,9}$/.test(raw) ? raw : "");
    if (!doi && !pmid) {
      setError("Enter a DOI (e.g. 10.3390/nu13030715) or a PubMed ID.");
      return;
    }
    setError("");
    window.open(libkeyUrl({ doi, pmid }), "_blank", "noopener");
  }

  return (
    <aside className="full-text-help">
      <strong>Find Full Text Through ZSR</strong>
      <p>
        Paste a DOI or PubMed ID to check whether Wake Forest provides access through LibKey.
        For broader web research, install LibKey Nomad and select Wake Forest University.
      </p>
      <form className="fulltext-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={(event) => { setValue(event.target.value); setError(""); }}
          placeholder="DOI (10.xxxx/xxxx) or PubMed ID"
          aria-label="DOI or PubMed ID"
        />
        <button type="submit" className="fulltext-go">Find full text through ZSR</button>
      </form>
      {error && <p className="fulltext-error" role="alert">{error}</p>}
      <a className="nomad-link" href={LIBKEY_NOMAD_URL} target="_blank" rel="noopener noreferrer">
        Install LibKey Nomad
        <span className="ext-icon">{Icon.external}</span>
      </a>
    </aside>
  );
}

function StrategyTermGroup({ label, terms = [], linkBase }) {
  const visible = terms.filter(Boolean).slice(0, 5);
  if (!visible.length) return null;
  return (
    <div className="agent-term-group">
      <strong>{label}</strong>
      <div>
        {visible.map((term) => (
          <a
            key={term}
            href={fillTemplate(linkBase || LIBRARY_LINKS.zsrArticleSearch, term)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {term}
            <span className="ext-icon">{Icon.external}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function AgentResourceCard({ resource, onSaveResearchItem, onTrackSearch, savedResearchItemKeys }) {
  const terms = (resource.searchTerms || []).slice(0, 1);
  const filters = (resource.filters || []).filter(Boolean);
  const accessUrl = resource.accessUrl || resource.url || (resource.id === "primo" ? LIBRARY_LINKS.zsrPrimoSearch : "");
  const href = resource.id === "primo"
    ? fillTemplate(accessUrl, terms[0] || "")
    : accessUrl;
  const previewImage = resourcePreviewImage(resource);
  const savedItem = {
    kind: "database",
    title: resource.name,
    url: href,
    detail: resource.whyFits || resource.description || resource.subjectArea,
  };
  return (
    <li className="agent-resource-card has-preview">
      <img className="agent-resource-preview" src={previewImage} alt="" loading="lazy" />
      <div className="agent-resource-body">
        <div className="agent-resource-head">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTrackSearch?.({ query: terms[0] || resource.name, tool: resource.name, url: href })}
          >
            {resource.name}
            <span className="ext-icon">{Icon.external}</span>
          </a>
          <span>{resource.subjectArea}</span>
        </div>
        <p>{resource.description}</p>
        <div className="agent-card-summary">
          {terms.length > 0 ? (
            <span><strong>Search inside {resource.name}:</strong> <code>{terms[0]}</code></span>
          ) : (
            <span><strong>Use it to:</strong> {resource.bestFor}</span>
          )}
          {filters.length > 0 && (
            <span><strong>Then filter:</strong> {filters.join(" · ")}</span>
          )}
          <span><strong>Expect:</strong> {resource.expect}</span>
        </div>
        <EvidenceChips
          items={resource.generalStartingPoint
            ? ["Curated ZSR config", "Named secondary database", "Not top-ranked"]
            : [
                "Curated ZSR config",
                resource.subjectArea ? `${resource.subjectArea} match` : "",
                provenanceText(resource.sourceKinds),
                "Librarian-reviewable path",
              ]}
        />
        <SaveResearchButton item={savedItem} onSaveResearchItem={onSaveResearchItem} savedResearchItemKeys={savedResearchItemKeys} />
        <details className="agent-resource-details">
          <summary>Why this was recommended and provenance</summary>
          <p><strong>Why it fits:</strong> {resource.whyFits}</p>
          <p><strong>Best for:</strong> {resource.bestFor}</p>
          <p><strong>Not best for:</strong> {resource.notBestFor}</p>
          <p><strong>Caution:</strong> {resource.caution}</p>
          <p><strong>Next step:</strong> {resource.nextStep}</p>
          <ResourceProvenance resource={resource} />
        </details>
      </div>
    </li>
  );
}

function ResearchAgentSection({ plan, compact = false, liveResultCount = 0, visibleSearchTerms = [], onSaveResearchItem, onTrackSearch, savedResearchItemKeys }) {
  if (!plan?.query) return null;
  const firstFour = plan.recommendations.slice(0, 4);
  const remaining = plan.recommendations.slice(4);
  const otherStartingPoints = plan.otherStartingPoints || [];
  const showOtherStartingPoints =
    !plan.navigationOnly &&
    otherStartingPoints.length > 0 &&
    (plan.recommendations.length < 4 || liveResultCount < 3);
  const focusLabel = plan.subjectFocus?.label;
  const occupiedQueryKeys = new Set(
    [
      ...plan.recommendations,
      ...otherStartingPoints,
    ]
      .flatMap((resource) => resource.searchTerms || [])
      .concat(visibleSearchTerms)
      .map(normalizeSearchOptionKey)
      .filter(Boolean)
  );
  const fallbackQueryKeys = new Set();
  const visibleFallbacks = (plan.fallbacks || []).filter((fallback) => {
    if (!fallback.query) return true;
    const key = normalizeSearchOptionKey(fallback.query);
    if (!key || occupiedQueryKeys.has(key) || fallbackQueryKeys.has(key)) return false;
    fallbackQueryKeys.add(key);
    return true;
  });
  return (
    <section className="research-agent">
      <SectionHeader icon={Icon.search}>{plan.navigationOnly ? "Navigate ZSR" : "Search plan"}</SectionHeader>

      <div className="agent-resource-block">
        <div className="agent-block-head">
          <strong>{plan.navigationOnly ? "Choose what you need to do" : "Recommended ZSR paths"}</strong>
          <span>{plan.transparencyNote}</span>
          {focusLabel && (
            <span className="agent-focus-chip">
              Subject focus: {focusLabel}{plan.subjectFocus.autoDetected ? " (auto)" : ""}
            </span>
          )}
        </div>
        <ul className="agent-resource-list">
          {firstFour.map((resource) => (
            <AgentResourceCard key={resource.id} resource={resource} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
          ))}
        </ul>
        {remaining.length > 0 && (
          <details className="more-results agent-more">
            <summary>Show more ZSR paths</summary>
            <ul className="agent-resource-list">
              {remaining.map((resource) => (
                <AgentResourceCard key={resource.id} resource={resource} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
              ))}
            </ul>
          </details>
        )}
        {showOtherStartingPoints && (
          <details className="agent-general-starting-points">
            <summary>Other potentially helpful ZSR databases</summary>
            <p>
              These are named secondary databases to try when the strongest matches or live results are limited. Each has its own unused query and filters.
            </p>
            <ul className="agent-resource-list">
              {otherStartingPoints.map((resource) => (
                <AgentResourceCard key={resource.id} resource={resource} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
              ))}
            </ul>
          </details>
        )}
      </div>

      {!compact && visibleFallbacks.length > 0 && (
        <details className="agent-fallback" open>
          <summary>{plan.navigationOnly ? "ZSR task guide" : "If this search fails, try..."}</summary>
          <ul>
            {visibleFallbacks.map((fallback) => (
              <li key={`${fallback.label}-${fallback.query || fallback.text}`}>
                <strong>{fallback.label}:</strong>{" "}
                {fallback.href ? (
                  <a href={fallback.href} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: fallback.text, tool: fallback.label, url: fallback.href })}>
                    {fallback.text}
                    <span className="ext-icon">{Icon.external}</span>
                  </a>
                ) : (
                  fallback.text
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {plan.fullText && (
        <div className="agent-help-grid">
          <div className="agent-help-card">
            <strong>Full-text workflow</strong>
            <p>Install LibKey Nomad, choose Wake Forest University, then try DOI, PMID, exact-title, Scholar, or ZSR lookup.</p>
            <div className="agent-link-row compact">
              <a href={plan.fullText.installLink} target="_blank" rel="noopener noreferrer">
                Install LibKey Nomad
                <span className="ext-icon">{Icon.external}</span>
              </a>
              {plan.fullText.links.map((link) => (
                <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                  <span className="ext-icon">{Icon.external}</span>
                </a>
              ))}
            </div>
            <p className="muted terms-hint">This does not verify Wake Forest full-text access; it gives the student the right lookup path.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function LiveResultsSection({ liveResults = [], sourceDiscovery = null, compact = false, followup = false, onSaveResearchItem, onTrackSearch, savedResearchItemKeys }) {
  const openAccessStatus = sourceDiscovery?.lanes?.openAccess;
  const libraryResults = liveResults.filter((result) => result?.accessScope !== "open-access");
  const openAccessResults = liveResults.filter((result) => result?.accessScope === "open-access");
  if (!libraryResults.length && !openAccessResults.length && !openAccessStatus?.requested) return null;

  const renderResult = (r, i, laneId) => {
    const ids = resultIds(r);
    const hasId = Boolean(ids.doi || ids.pmid);
    const isOpenAccess = r.accessScope === "open-access";
    const isZsrRecord = /zsr discovery/i.test(r.sourceProvider || "");
    const hasBookFulfillment = Boolean(r.fulfillment);
    const reportedOpenUrl = r.openAccess?.landingPageUrl || r.openAccess?.pdfUrl || r.url;
    const accessLinks = buildAccessLinks({ title: r.title, doi: ids.doi, pmid: ids.pmid })
      .filter((link) => !/full text|pubmed/i.test(link.label))
      .slice(0, 2);
    const visibleMeta = resultMetaText(r);
    const savedItem = {
      kind: "catalog",
      title: r.title,
      url: r.url,
      detail: visibleMeta || r.description || (isOpenAccess ? "Open-access metadata lead" : "ZSR discovery lead"),
    };

    return (
      <li key={`${laneId}-${r.url || r.title}-${i}`} className={`result-row ${r.cover ? "" : "no-thumb"}`}>
        <ResultThumb cover={r.cover} />
        <div className="result-body">
          <a className="result-title" href={r.url} target="_blank" rel="noopener noreferrer">
            {r.title}
            <span className="ext-icon">{Icon.external}</span>
          </a>
          {visibleMeta && <p className="result-meta">{visibleMeta}</p>}
          {isOpenAccess && (
            <div className="open-access-provenance" aria-label="Open-access provenance">
              <strong>OpenAlex reports an open-access location</strong>
              {r.openAccess?.license && <span>License: {r.openAccess.license}</span>}
              {r.openAccess?.version && <span>Version: {r.openAccess.version}</span>}
              <small>The linked work keeps its own copyright and license. The navigator has not retrieved or summarized its full text.</small>
            </div>
          )}
          {hasBookFulfillment && (
            <div className="book-fulfillment" aria-label="Book location and availability guidance">
              <strong>{r.fulfillment.statusLabel || "Check location and availability"}</strong>
              {r.fulfillment.location && <span>{r.fulfillment.location}</span>}
              {r.fulfillment.callNumber && <span>Call number: {r.fulfillment.callNumber}</span>}
              <small>Availability can change. Confirm in the ZSR record before visiting or requesting.</small>
            </div>
          )}
          <div className="result-actions">
            <SaveResearchButton item={savedItem} onSaveResearchItem={onSaveResearchItem} savedResearchItemKeys={savedResearchItemKeys} />
            <button
              type="button"
              className="ris-export-btn"
              onClick={() => downloadRis([r], { filename: r.title || "research-source" })}
              aria-label={`Download RIS citation for ${r.title || "this source"}`}
            >
              Download RIS
            </button>
            {isOpenAccess ? (
              <a className="fulltext-btn" href={reportedOpenUrl} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: r.title, tool: "OpenAlex open-access location", url: reportedOpenUrl })}>
                Open reported open-access copy
              </a>
            ) : hasBookFulfillment ? (
              <a className="fulltext-btn" href={r.fulfillment.recordUrl || r.url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: r.title, tool: "ZSR book record", url: r.fulfillment.recordUrl || r.url })}>
                {r.fulfillment.actionLabel || "Check location and availability"}
              </a>
            ) : hasId ? (
              <a className="fulltext-btn" href={libkeyUrl(ids)} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: r.title, tool: "ZSR full text", url: libkeyUrl(ids) })}>
                <svg className="dl-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
                </svg>
                Find full text through ZSR
              </a>
            ) : (
              <a className="fulltext-btn" href={fillTemplate(LIBRARY_LINKS.googleScholarSearch, r.title || "")} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: r.title, tool: "Google Scholar", url: fillTemplate(LIBRARY_LINKS.googleScholarSearch, r.title || "") })}>
                Find via Google Scholar
              </a>
            )}
            {!isOpenAccess && (
              <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={() => onTrackSearch?.({ query: r.title, tool: isZsrRecord ? "ZSR record" : "DOI record", url: r.url })}>
                {isZsrRecord ? "Open in ZSR" : "Open DOI record"}
              </a>
            )}
            {hasBookFulfillment && (
              <a href={r.fulfillment.requestUrl || LIBRARY_LINKS.zsrDelivers} target="_blank" rel="noopener noreferrer">
                {r.fulfillment.requestLabel || "Request through ZSR Delivers"}
              </a>
            )}
          </div>
          <details className="result-details">
            <summary>Source details and access</summary>
            <div className="result-details-body">
              <EvidenceChips
                compact
                items={[
                  r.sourceProvider || "Live catalog metadata",
                  r.type ? `${r.type}` : "",
                  isOpenAccess ? "OA reported by OpenAlex" : hasId ? "DOI/PMID detected" : "Title lookup needed",
                  isOpenAccess
                    ? r.openAccess?.license ? `License: ${r.openAccess.license}` : "No reusable-content license supplied"
                    : isZsrRecord ? "Confirm access in record" : "Check access through ZSR",
                ]}
              />
              {r.abstractExcerpt ? (
                <section className="result-abstract" aria-label="Provider-supplied abstract excerpt">
                  <div className="result-abstract-heading">
                    <strong>Abstract excerpt</strong>
                    <span>{r.abstractSource || "Provider metadata"} · not AI-generated</span>
                  </div>
                  <p>{r.abstractExcerpt}</p>
                </section>
              ) : (
                <p className="result-abstract-unavailable">
                  {isOpenAccess
                    ? r.summaryEligible
                      ? "This location may qualify for a later rights-controlled summary pilot, but no full text was retrieved and no summary was generated."
                      : "No permissive summary license was confirmed for this location, so no full text was retrieved and no summary was generated."
                    : "No provider-supplied abstract was available, so no source summary was generated."}
                </p>
              )}
              {r.description && <p className="result-description">{r.description}</p>}
              {r.detailPoints?.length > 0 && (
                <ul>
                  {r.detailPoints.map((point, pointIndex) => (
                    <li key={pointIndex}>{point}</li>
                  ))}
                </ul>
              )}
              {(ids.pmid || accessLinks.length > 0) && (
                <div className="result-secondary-links" aria-label="Additional source links">
                  {ids.pmid && (
                    <a href={`https://pubmed.ncbi.nlm.nih.gov/${String(ids.pmid).replace(/\D/g, "")}/`} target="_blank" rel="noopener noreferrer">
                      PubMed record
                    </a>
                  )}
                  {accessLinks.map((link) => (
                    <a key={`${r.title}-${link.label}`} href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </li>
    );
  };

  const renderLane = (results, laneId) => {
    if (!results.length) {
      if (laneId !== "open-access" || !openAccessStatus?.requested) return null;
      return (
        <section className={`live-results open-access-lane ${followup ? "followup-first" : ""} ${compact ? "compact-extra" : ""}`}>
          <SectionHeader icon={Icon.search}>Open-access source lane</SectionHeader>
          <p className="found-note">
            {!openAccessStatus.enabled
              ? "OpenAlex is not configured on this deployment, so no open-access search was sent. A server-side OpenAlex API key is required and is never exposed to the browser."
              : "OpenAlex returned no strong open-access matches for this search. Try revising one concept or broaden the source mode."}
          </p>
        </section>
      );
    }

    const isOpenAccessLane = laneId === "open-access";
    const usesMetadataFallback = !isOpenAccessLane && results.some((result) => /crossref/i.test(result.sourceProvider || ""));
    const visibleResults = results.slice(0, 5);
    const moreResults = results.slice(5, 10);
    const heading = isOpenAccessLane
      ? compact ? "Open-access examples" : "Open-access source leads"
      : compact
        ? usesMetadataFallback ? "Scholarly source examples" : "ZSR discovery examples"
        : usesMetadataFallback ? "Scholarly source leads" : "Live ZSR discovery leads";

    return (
      <section className={`live-results ${isOpenAccessLane ? "open-access-lane" : "library-lane"} ${followup ? "followup-first" : ""} ${compact ? "compact-extra" : ""}`}>
        <div className="live-results-heading-row">
          <SectionHeader icon={Icon.search}>{heading}</SectionHeader>
          <button
            type="button"
            className="ris-export-btn"
            onClick={() => downloadRis(results, { filename: isOpenAccessLane ? "open-access-source-leads" : "library-source-leads" })}
          >
            Export lane RIS
          </button>
        </div>
        {!compact && (
          <p className="found-note">
            {isOpenAccessLane
              ? "OpenAlex reports these source locations as open access. Confirm topic fit, access, version, and the linked work's license before using or sharing it."
              : usesMetadataFallback
                ? "These records come from ZSR discovery when available and verified Crossref bibliographic metadata when the ZSR search is too narrow. Treat them as starting leads and confirm topic fit and access through ZSR."
                : "These records passed an automated keyword-relevance check. Treat them as starting leads, not endorsements, and open each record to confirm topic fit, access, and format."}
          </p>
        )}
        <ul className="results">
          {visibleResults.map((result, index) => renderResult(result, index, laneId))}
        </ul>
        {moreResults.length > 0 && (
          <details className="more-results">
            <summary>Show {moreResults.length} more {isOpenAccessLane ? "open-access" : "ZSR"} results</summary>
            <ul className="results">
              {moreResults.map((result, index) => renderResult(result, index + visibleResults.length, laneId))}
            </ul>
          </details>
        )}
        {!compact && (
          <p className="muted terms-hint">
            {isOpenAccessLane
              ? "OpenAlex metadata is CC0. Linked articles and PDFs retain their own copyright and licenses; the navigator does not retrieve their full text."
              : usesMetadataFallback
                ? "Live bibliographic metadata. Crossref records do not confirm Wake Forest access; use the provided ZSR and full-text links to check availability."
                : "Live metadata from ZSR discovery. Weak matches are intentionally omitted; images appear only when ZSR or ISBN metadata provides a real thumbnail."}
          </p>
        )}
      </section>
    );
  };

  return (
    <>
      {renderLane(libraryResults, "library")}
      {renderLane(openAccessResults, "open-access")}
    </>
  );
}

export default function AssistantMessage({
  reply,
  matched,
  searchTools,
  liveResults,
  sourceDiscovery,
  topic,
  mode = DEFAULT_MODE_ID,
  responseStyle = DEFAULT_RESPONSE_STYLE_ID,
  subjectFocusId,
  researchSpec,
  researchPlan,
  releaseId,
  isFollowup = false,
  isLatest,
  onFollowup,
  onRerunInterpretation,
  onOpenPlanner,
  onSaveResearchItem,
  onTrackSearch,
  savedResearchItemKeys,
}) {
  const [copied, setCopied] = useState(null); // index of copied term, or "all"
  const [fb, setFb] = useState("idle"); // idle | done
  const [showGap, setShowGap] = useState(false);
  const [gapNote, setGapNote] = useState("");
  const [selectedRefinements, setSelectedRefinements] = useState([]);

  if (!reply) return null;
  // Keep only substantive follow-ups and render them as action prompts, not vague yes/no questions.
  const followups = (reply.suggested_followups ?? [])
    .map(normalizeSuggestedFollowup)
    .filter(Boolean);
  const tools = searchTools || [];
  const activeMode = getSearchMode(mode);
  const localAgentPlan = buildResearchPlan(topic || reply.message || "", 5, subjectFocusId, mode);
  const providedAgentPlan = researchPlan && Array.isArray(researchPlan.recommendations)
    ? {
        ...localAgentPlan,
        ...researchPlan,
        strategy: { ...localAgentPlan.strategy, ...(researchPlan.strategy || {}) },
        recommendations: researchPlan.recommendations,
        otherStartingPoints: researchPlan.otherStartingPoints || [],
        fallbacks: researchPlan.fallbacks || localAgentPlan.fallbacks,
      }
    : localAgentPlan;
  const matchedById = new Map((matched || []).filter((resource) => resource?.id).map((resource) => [resource.id, resource]));
  const matchedByName = new Map((matched || []).filter((resource) => resource?.name).map((resource) => [String(resource.name).toLowerCase(), resource]));
  const enrichResource = (resource) => {
    const matchedResource = matchedById.get(resource.id) || matchedByName.get(String(resource.name || "").toLowerCase()) || {};
    const enriched = { ...resource, ...matchedResource };
    return {
      ...enriched,
      accessUrl: enriched.accessUrl || enriched.url || "",
    };
  };
  const agentPlan = {
    ...providedAgentPlan,
    recommendations: (providedAgentPlan.recommendations || []).map(enrichResource),
    otherStartingPoints: (providedAgentPlan.otherStartingPoints || []).map(enrichResource),
  };

  // Enrich each recommended link with curated metadata (type, access) by URL.
  const byUrl = new Map((matched || []).map((r) => [r.url, r]));
  const norm = (u) => String(u || "").replace(/\/+$/, "").toLowerCase();
  const byUrlNorm = new Map((matched || []).map((r) => [norm(r.url), r]));
  const lookup = (url) => byUrl.get(url) || byUrlNorm.get(norm(url));
  const showTopicSpecificPlan = !isFollowup && isSocialMediaMentalHealthTopic(topic);
  const suggestedSearchGroups = showTopicSpecificPlan ? SUGGESTED_SEARCH_GROUPS : [];
  const startingPoints = showTopicSpecificPlan
    ? SOCIAL_MEDIA_MENTAL_HEALTH_RESOURCES
    : reply.starting_points || [];
  const latestAsk = String(topic || "");
  const substantiveResearchRequest = isSubstantiveResearchRequest(latestAsk);
  const selectedSourcePlanRequest = /chosen request|source-finding plan|do not generate more topic options|where to search in zsr|suggested search terms/i.test(latestAsk);
  const rawTopicOptions = [];
  const seenTopicOptions = new Set();
  for (const option of reply.topic_options || []) {
    if (!option?.title && !option?.research_question) continue;
    const key = String(option.research_question || option.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seenTopicOptions.has(key)) continue;
    seenTopicOptions.add(key);
    rawTopicOptions.push(option);
    if (rawTopicOptions.length >= 6) break;
  }
  const optionSearchTerms = uniqueTerms(
    rawTopicOptions.flatMap((option) => option.search_terms || [])
  ).slice(0, 8);
  const searchTermCandidates = reply.search_terms?.length
    ? reply.search_terms
    : selectedSourcePlanRequest
      ? optionSearchTerms
      : substantiveResearchRequest
        ? [...agentPlan.strategy.betterTerms, ...agentPlan.strategy.narrowerTerms.slice(0, 3)]
        : [];
  const reservedOutsideSearchTerms = new Set(
    [
      ...agentPlan.recommendations,
      ...(agentPlan.otherStartingPoints || []),
    ]
      .flatMap((resource) => resource.searchTerms || [])
      .concat((agentPlan.fallbacks || []).map((fallback) => fallback.query).filter(Boolean))
      .map(normalizeSearchOptionKey)
      .filter(Boolean)
  );
  const deterministicSearchTerms = agentPlan.searchTerms || [];
  const displaySearchTerms = uniqueTerms(
    deterministicSearchTerms.length
      ? deterministicSearchTerms
      : searchTermCandidates.length
        ? buildSearchTermSuggestions(latestAsk, searchTermCandidates, subjectFocusId, 12)
        : []
  )
    .filter((term) => !reservedOutsideSearchTerms.has(normalizeSearchOptionKey(term)))
    .slice(0, 8);
  const databaseStrategy = showTopicSpecificPlan
    ? SOCIAL_MEDIA_DATABASE_STRATEGY
    : reply.database_strategy?.length
      ? reply.database_strategy
      : selectedSourcePlanRequest
        ? agentPlan.recommendations.map((resource) => ({
            database: resource.name,
            az_area: resource.subjectArea,
            why: resource.whyFits,
            search_inside: [
              `Run: ${resource.searchTerms[0]}`,
              ...resource.filters,
            ].filter(Boolean),
            journals_or_sources: [resource.expect].filter(Boolean),
          }))
        : [];
  const topicOptions = selectedSourcePlanRequest ? [] : rawTopicOptions;
  const clarifyingQuestions = (reply.clarifying_questions || [])
    .filter((item) => item?.question && Array.isArray(item.options) && item.options.length)
    .slice(0, 4);
  const displayStartingPoints = [];
  const seenStartingPoints = new Set();
  for (const sp of startingPoints) {
    const r = lookup(sp.url);
    const displaySp = displayStartingPoint(sp, r);
    const key = norm(displaySp.url || r?.url || displaySp.resource_name);
    if (!key || seenStartingPoints.has(key)) continue;
    seenStartingPoints.add(key);
    displayStartingPoints.push(displaySp);
  }
  const primaryStartingPoints = displayStartingPoints.slice(0, 3);
  const moreStartingPoints = displayStartingPoints.slice(3);
  const wantsStartingPointHelp = /starting point|recommended|database|resource|where (should|can) i search|where to search/i.test(latestAsk);
  const wantsResourceHelp = /database|resource|where|source|peer|article|journal|search|find/i.test(latestAsk);
  const wantsSearchHelp = /term|keyword|boolean|search|string|database|find|article/i.test(latestAsk);
  const wantsCitationHelp = /citat|cite|apa|mla|zotero|bibliograph/i.test(latestAsk);
  const wantsEvaluationHelp = /evaluat|credible|peer|scholarly|quality/i.test(latestAsk);
  const wantsDatabaseStrategyHelp = /a-?z|database|databases|where to search|where can i search|periodical|periodicals|journal|journals|inside|within|specific resources/i.test(latestAsk);
  const wantsOnlyCitationHelp =
    wantsCitationHelp &&
    !/sources?|articles?|books?|databases?|catalog|find|get|show|provide|evidence|pdf|full[-\s]?text|doi|pmid/i.test(latestAsk);
  const wantsSourceHeavyHelp =
    wantsStartingPointHelp ||
    wantsResourceHelp ||
    wantsSearchHelp ||
    wantsCitationHelp ||
    wantsEvaluationHelp ||
    /evidence|sources?|articles?|books?|journals?|database|databases|catalog|find|get|show|provide|pdf|full[-\s]?text/i.test(latestAsk);
  const allowSourceSections = responseStyle !== "answer" || wantsSourceHeavyHelp || substantiveResearchRequest;
  const showAgenticSearchPlan =
    allowSourceSections &&
    (topicOptions.length === 0 || substantiveResearchRequest) &&
    !wantsOnlyCitationHelp &&
    (wantsSourceHeavyHelp ||
      substantiveResearchRequest ||
      responseStyle === "hybrid" ||
      responseStyle === "sources" ||
      responseStyle === "plan") &&
    (!isFollowup || isLatest || wantsSourceHeavyHelp || responseStyle === "sources" || responseStyle === "plan");
  const showModeGuidance = false;
  const showStartingPointCards = allowSourceSections && primaryStartingPoints.length > 0 && (!isFollowup || wantsStartingPointHelp || responseStyle === "sources");
  const showDatabaseStrategy =
    allowSourceSections &&
    !showAgenticSearchPlan &&
    databaseStrategy.length > 0 &&
    (showTopicSpecificPlan || !isFollowup || wantsDatabaseStrategyHelp || responseStyle === "sources" || responseStyle === "plan");
  const showGeneratedTerms =
    allowSourceSections &&
    !showTopicSpecificPlan &&
    displaySearchTerms.length > 0 &&
    (!isFollowup || wantsSearchHelp || wantsDatabaseStrategyHelp || responseStyle === "sources" || responseStyle === "plan");
  const showCatalogResults =
    liveResults?.length > 0 || Boolean(sourceDiscovery?.lanes?.openAccess?.requested);
  const benefitsFromRefinement =
    isFollowup &&
    (showCatalogResults ||
      /find|provide|show|get|source|sources|article|articles|book|books|database|primary|peer|recent|journal/i.test(latestAsk));
  const providedSourceChecks = (reply.source_evaluation || []).filter(Boolean);
  const moreSourceChecks = (providedSourceChecks.length
    ? providedSourceChecks
    : [
        activeMode.evaluation,
        "Open the record and verify that its topic, source type, date, and evidence actually fit your assignment before citing it.",
      ]).slice(0, 3);
  const providedCitationTips = (reply.citation_tips || []).filter(Boolean);
  const moreCitationTips = (providedCitationTips.length
    ? providedCitationTips
    : [
        "Capture the author, title, source or container, date, URL or DOI, and access date when the style requires it.",
        "Check the assignment's required style, then verify the final citation against ZSR citation guidance before submitting.",
      ]).slice(0, 3);
  const moreJournalLeads = (reply.key_journals || []).filter(Boolean).slice(0, 4);
  const moreIntegrityNote =
    reply.academic_integrity_note ||
    "Use this output as a research starting point. Verify claims in the sources you open, and cite the sources you actually read.";
  const moreLimitations =
    reply.limitations ||
    "This prototype does not authenticate into ZSR databases, verify full-text access, or read paywalled sources. Open records through ZSR to confirm access, format, and citation details.";
  const showMoreGuidance =
    moreSourceChecks.length > 0 ||
    moreCitationTips.length > 0 ||
    moreJournalLeads.length > 0 ||
    Boolean(moreIntegrityNote || moreLimitations);
  const showStandaloneCitationTips =
    allowSourceSections &&
    !showTopicSpecificPlan &&
    reply.citation_tips?.length > 0 &&
    wantsCitationHelp &&
    (!isFollowup || responseStyle === "sources");
  const showStandaloneFullTextHelp =
    allowSourceSections &&
    !showAgenticSearchPlan &&
    /doi|pmid|full[-\s]?text|pdf|find this article|article title/i.test(latestAsk);
  const modeLinks = showTopicSpecificPlan
    ? SOCIAL_MEDIA_MENTAL_HEALTH_RESOURCES.slice(0, 3).map((resource) => [
        resource.resource_name,
        resource.url,
        resource.bestFor,
      ])
    : activeMode.recommended.slice(0, 3);
  const nextStepActions =
    !showTopicSpecificPlan && followups.length > 0
      ? followups.slice(0, 3)
      : NEXT_STEP_ACTIONS;
  const showNextStep =
    isLatest &&
    (!isFollowup || (followups.length > 0 && !benefitsFromRefinement));
  const zsrSearchTool =
    tools.find((tool) => tool.id === "zsr-discovery") ||
    tools.find((tool) => /ZSR|library|catalog|discovery/i.test(tool.name || ""));
  const zsrSearchHref = (term) =>
    (zsrSearchTool?.search_url_template ||
      (mode === "scholarly" ? LIBRARY_LINKS.zsrArticleSearch : LIBRARY_LINKS.zsrPrimoSearch)
    ).replace("{q}", encodeURIComponent(term));

  function copy(text, key) {
    const markCopied = () => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    };

    const fallbackCopy = () => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        markCopied();
      } catch {
        /* ignore clipboard failures */
      } finally {
        document.body.removeChild(textarea);
      }
    };

    fallbackCopy();
  }

  const shortToolName = (n) => n.replace(/^Google\s+/, "").replace(/^ZSR\b.*/, "ZSR");

  function toggleRefinement(prompt) {
    setSelectedRefinements((selected) =>
      selected.includes(prompt)
        ? selected.filter((item) => item !== prompt)
        : [...selected, prompt]
    );
  }

  function applyRefinements() {
    if (!selectedRefinements.length) return;
    onFollowup(
      `Refine this search for "${topic || "my topic"}" with these limits: ${selectedRefinements.join(
        "; "
      )}. Show real ZSR results first when available and keep the answer focused.`
    );
  }

  function sendFeedback(rating, note = "") {
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, note, topic }),
    }).catch(() => {});
    setFb("done");
    setShowGap(false);
  }

  return (
    <div className="bubble assistant">
      {researchSpec && (
        <ResearchInterpretationPanel
          researchSpec={researchSpec}
          fallbackTopic={topic}
          fallbackMode={mode}
          releaseId={releaseId}
          isLatest={isLatest}
          onRerun={onRerunInterpretation || onFollowup}
          onRefine={onFollowup}
        />
      )}

      {reply.message && (
        <section className="research-orientation" aria-label="AI-generated research orientation">
          {substantiveResearchRequest && (
            <div className="research-orientation-label">
              <strong>Research orientation</strong>
              <span>Starting context, not a research conclusion</span>
            </div>
          )}
          <p className="msg plan-intro">{reply.message}</p>
        </section>
      )}

      {reply.redirect_notice && (
        <div className="notice redirect" role="note">
          <strong>A quick note:</strong> {reply.redirect_notice}
        </div>
      )}

      {topicOptions.length > 0 && (
        <TopicOptionsSection options={topicOptions} onFollowup={onFollowup} />
      )}

      {isLatest && clarifyingQuestions.length > 0 && (
        <ClarifyingPlannerPrompt questions={clarifyingQuestions} onOpenPlanner={onOpenPlanner} />
      )}

      {["hybrid", "sources"].includes(responseStyle) && reply.source_notice && (
        <div className="notice source-relevance" role="note">
          <span className="sec-icon">{Icon.info}</span>
          <div>
            <strong>About these source leads</strong>
            <p>{reply.source_notice}</p>
          </div>
        </div>
      )}

      {showModeGuidance && (
        <section className="mode-guidance">
          <div>
            <span>Research mode</span>
            <strong>{activeMode.label}</strong>
            <p>{activeMode.description}</p>
          </div>
          <div className="mode-links">
            {modeLinks.map(([name, url, bestFor]) => (
              <a
                key={name}
                href={fillTemplate(url, topic)}
                target="_blank"
                rel="noopener noreferrer"
                title={bestFor}
              >
                {name}
                <span className="ext-icon">{Icon.external}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {allowSourceSections && isFollowup && showCatalogResults && (
        <LiveResultsSection liveResults={liveResults} sourceDiscovery={sourceDiscovery} followup onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
      )}

      {showAgenticSearchPlan && (
        <ResearchAgentSection plan={agentPlan} compact={isFollowup} liveResultCount={liveResults?.length || 0} visibleSearchTerms={displaySearchTerms} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
      )}

      {showDatabaseStrategy && (
        <DatabaseStrategySection strategy={databaseStrategy} topic={topic} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
      )}

      {allowSourceSections && showTopicSpecificPlan && (
        <section className="suggested-terms-section">
          <SectionHeader icon={Icon.search}>Suggested search terms</SectionHeader>
          <div className="term-groups" role="list">
            {suggestedSearchGroups.map((group) => (
              <a
                key={group.label}
                className="term-group term-group-link"
                href={zsrSearchHref(group.terms)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onTrackSearch?.({ query: group.terms, tool: "ZSR Articles", url: zsrSearchHref(group.terms) })}
                role="listitem"
                aria-label={`Search ZSR for ${group.label}: ${group.terms}`}
              >
                <div className="term-group-title">
                  <span>{group.label}</span>
                  <span className="term-open">Search ZSR <span className="ext-icon">{Icon.external}</span></span>
                </div>
                <code>{group.terms}</code>
              </a>
            ))}
          </div>
          <div className="sample-search">
            <div className="sample-search-head">
              <h4>Sample database search string</h4>
              <button
                type="button"
                className={`icon-copy ${copied === "sample-search" ? "is-copied" : ""}`}
                onClick={() => copy(SAMPLE_SEARCH_STRING, "sample-search")}
                aria-label={copied === "sample-search" ? "Sample search string copied" : "Copy sample search string"}
              >
                {Icon.copy}
                <span className="sr-only">{copied === "sample-search" ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <code>{SAMPLE_SEARCH_STRING}</code>
          </div>
        </section>
      )}

      {allowSourceSections && !isFollowup && showCatalogResults && (
        <LiveResultsSection liveResults={liveResults} sourceDiscovery={sourceDiscovery} onSaveResearchItem={onSaveResearchItem} onTrackSearch={onTrackSearch} savedResearchItemKeys={savedResearchItemKeys} />
      )}

      {showStandaloneFullTextHelp && <FindFullText />}

      {showGeneratedTerms && (
        <section>
          <div className="sec-head-row">
            <SectionHeader icon={Icon.search}>Search terms to try</SectionHeader>
            <button
              type="button"
              className={`icon-copy copy-all-terms ${copied === "all" ? "is-copied" : ""}`}
              onClick={() => copy(displaySearchTerms.join("\n"), "all")}
              aria-label={copied === "all" ? "All search terms copied" : "Copy all search terms"}
            >
              {Icon.copy}
              <span>{copied === "all" ? "Copied" : "Copy all"}</span>
            </button>
          </div>
          <ul className="terms">
            {displaySearchTerms.map((term, i) => (
              <li key={i} className="term-row">
                <span className="term">
                  <code>{term}</code>
                </span>
                <button
                  type="button"
                  className={`icon-copy ${copied === `generated-${i}` ? "is-copied" : ""}`}
                  onClick={() => copy(term, `generated-${i}`)}
                  aria-label={
                    copied === `generated-${i}`
                      ? `Search term ${i + 1} copied`
                      : `Copy search term ${i + 1}`
                  }
                >
                  {Icon.copy}
                  <span className="sr-only">{copied === `generated-${i}` ? "Copied" : "Copy"}</span>
                </button>
                <SaveResearchButton
                  item={{ kind: "search", title: term, detail: "Keyword search suggested by the Navigator" }}
                  onSaveResearchItem={onSaveResearchItem}
                  savedResearchItemKeys={savedResearchItemKeys}
                />
                {tools.map((tool) => (
                  <a
                    key={tool.id}
                    className="term-search"
                    href={tool.search_url_template.replace("{q}", encodeURIComponent(term))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Run this search in ${tool.name}`}
                    onClick={() => onTrackSearch?.({ query: term, tool: tool.name, url: tool.search_url_template.replace("{q}", encodeURIComponent(term)) })}
                  >
                    ↗ {shortToolName(tool.name)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          <div className="term-combo-advice" role="note">
            <strong>Combine concepts deliberately.</strong>
            <span>Start with the first two concept groups. Use OR for synonyms within one idea and AND between different ideas. If results are thin, swap one synonym or remove one limiter before changing databases.</span>
          </div>
          {tools.length > 0 && (
            <p className="muted terms-hint">Use the copy icon for a single term, or ↗ to run it as a search.</p>
          )}
        </section>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.academic_integrity_note && !isFollowup && !showMoreGuidance && (
        <div className="notice integrity">
          <span className="sec-icon">{Icon.shield}</span>
          <div>
            <strong>Responsible AI &amp; academic integrity</strong>
            <p>{reply.academic_integrity_note}</p>
          </div>
        </div>
      )}

      {showStandaloneCitationTips && !showMoreGuidance && (
        <section>
          <SectionHeader icon={Icon.cite}>Citing what you find</SectionHeader>
          <ul className="eval">
            {reply.citation_tips.map((tip, i) => (
              <li key={i}>{renderRich(tip)}</li>
            ))}
          </ul>
          <CitationLinks guides={agentPlan.citationGuides} />
        </section>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.key_journals?.length > 0 && (!isFollowup || wantsStartingPointHelp || responseStyle === "sources") && (
        <section>
          <SectionHeader icon={Icon.cite}>Journals &amp; databases to look in</SectionHeader>
          <ul className="journals">
            {reply.key_journals.map((j, i) => (
              <li key={i}>
                <span>{j}</span>
                {tools.map((tool) => (
                  <a
                    key={tool.id}
                    className="term-search"
                    href={tool.search_url_template.replace("{q}", encodeURIComponent(j))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Look for ${j} in ${tool.name}`}
                  >
                    ↗ {shortToolName(tool.name)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          <p className="muted terms-hint">Suggested places to search — confirm access via ZSR's Find a Journal.</p>
        </section>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.limitations && !isFollowup && !showMoreGuidance && (
        <details className="notice limitations limitations-toggle">
          <summary>
            <span className="sec-icon">{Icon.info}</span>
            <strong>Limitations</strong>
          </summary>
          <p>{reply.limitations}</p>
        </details>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.starting_points?.length > 0 && !isFollowup && (
        <details className="roadmap-toggle">
          <summary>Show the research roadmap</summary>
          <ResearchRoadmap />
        </details>
      )}

      {showMoreGuidance && (
        <details className="more-guidance">
          <summary aria-label="Show source evaluation, citation notes, responsible AI notes, and limitations">
            <span className="more-guidance-title">Evaluation, citations, limitations & AI</span>
            <span className="more-guidance-chips" aria-hidden="true">
              <span>Evaluate</span>
              <span>Citations</span>
              <span>AI use</span>
              <span>Limits</span>
            </span>
          </summary>
          <div className="more-guidance-body">
            {moreSourceChecks.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.evaluate}>Evaluating these sources</SectionHeader>
                <ul className="eval">
                  {moreSourceChecks.map((tip, i) => (
                    <li key={i}>{renderRich(tip)}</li>
                  ))}
                </ul>
              </section>
            )}

            {moreCitationTips.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.cite}>Citation notes</SectionHeader>
                <ul className="eval">
                  {moreCitationTips.map((tip, i) => (
                    <li key={i}>{renderRich(tip)}</li>
                  ))}
                </ul>
                <CitationLinks guides={agentPlan.citationGuides} />
              </section>
            )}

            {moreJournalLeads.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.cite}>Journal leads</SectionHeader>
                <ul className="journals compact-journals">
                  {moreJournalLeads.map((j, i) => (
                    <li key={i}><span>{j}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {moreIntegrityNote && (
              <p className="compact-note">
                <strong>Responsible AI:</strong> {moreIntegrityNote}
              </p>
            )}

            {moreLimitations && (
              <p className="compact-note">
                <strong>Limitations:</strong> {moreLimitations}
              </p>
            )}
          </div>
        </details>
      )}

      {showNextStep && (
        <section className="next-step-section no-print">
          <SectionHeader icon={Icon.info}>{isFollowup ? "Keep going" : "Next step"}</SectionHeader>
          <div className="next-actions">
            {nextStepActions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="next-action"
                onClick={() => onFollowup(action.prompt)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {isLatest && benefitsFromRefinement && (
        <details className="refine-box no-print">
          <summary>Refine results</summary>
          <div className="refine-options">
            {REFINEMENT_OPTIONS.map((option) => (
              <label key={option.label} className="refine-option">
                <input
                  type="checkbox"
                  checked={selectedRefinements.includes(option.prompt)}
                  onChange={() => toggleRefinement(option.prompt)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="refine-apply"
            onClick={applyRefinements}
            disabled={!selectedRefinements.length}
          >
            Apply
          </button>
        </details>
      )}

      <div className="feedback no-print">
        {fb === "done" ? (
          <span className="fb-thanks">Thanks — your feedback helps librarians improve the collection.</span>
        ) : showGap ? (
          <form
            className="gap-form"
            onSubmit={(e) => {
              e.preventDefault();
              sendFeedback("gap", gapNote);
            }}
          >
            <input
              type="text"
              value={gapNote}
              onChange={(e) => setGapNote(e.target.value)}
              placeholder="What resource or source were you hoping to find? (optional)"
              maxLength={500}
              aria-label="Describe the missing resource"
            />
            <button type="submit" className="tool">Send</button>
          </form>
        ) : (
          <>
            <span className="fb-label">Was this helpful?</span>
            <button type="button" className="fb-btn" aria-label="Helpful" onClick={() => sendFeedback("up")}>
              {Icon.helpful}
            </button>
            <button type="button" className="fb-btn" aria-label="Not helpful" onClick={() => sendFeedback("down")}>
              {Icon.notHelpful}
            </button>
            <button type="button" className="fb-gap" onClick={() => setShowGap(true)}>Missing a resource?</button>
          </>
        )}
      </div>
    </div>
  );
}
