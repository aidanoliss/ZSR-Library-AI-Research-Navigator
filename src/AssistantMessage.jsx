import { useState } from "react";
import ResearchRoadmap from "./ResearchRoadmap.jsx";
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

const SUGGESTED_SEARCH_GROUPS = [
  { label: "Platforms", terms: "social media OR Instagram OR TikTok OR Snapchat" },
  { label: "Population", terms: "adolescent OR teenager OR youth" },
  { label: "Outcomes", terms: "mental health OR depression OR anxiety OR well-being" },
  { label: "Mechanisms", terms: "screen time OR social comparison OR cyberbullying" },
];

const SAMPLE_SEARCH_STRING =
  '("social media" OR TikTok OR Instagram) AND (adolescent OR teen*) AND ("mental health" OR anxiety OR depression)';

function modeSearchGroups(mode) {
  return [
    { label: "Mode terms", terms: mode.termSuffixes.slice(0, 4).join(" OR ") },
    { label: "Broaden", terms: mode.termStrategies.slice(0, 3).join(" OR ") },
  ].filter((group) => group.terms);
}

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

function CitationLinks() {
  return (
    <div className="citation-links">
      {CITATION_LINKS.map((link) => (
        <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">
          {link.label}
          <span className="ext-icon">{Icon.external}</span>
        </a>
      ))}
    </div>
  );
}

function azDatabaseHref(database) {
  return `https://guides.zsr.wfu.edu/az.php?q=${encodeURIComponent(database || "")}`;
}

// A result's DOI/PMID may live in dedicated fields or inside its text.
function resultIds(r) {
  const text = `${r.doi || ""} ${r.pmid || ""} ${r.description || ""} ${(r.detailPoints || []).join(" ")}`;
  return { doi: r.doi || extractDoi(text), pmid: r.pmid || extractPmid(text) };
}

function DatabaseStrategySection({ strategy = [], topic = "" }) {
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
          return (
            <li key={item.database} className="database-card">
              <div className="database-card-head">
                <a
                  className="database-name"
                  href={azDatabaseHref(item.database)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Look for ${item.database} in ZSR A-Z Databases`}
                >
                  {item.database}
                  <span className="ext-icon">{Icon.external}</span>
                </a>
                <a
                  className="database-action"
                  href={azDatabaseHref(item.database)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search A-Z for this database
                </a>
              </div>
              {item.az_area && (
                <p className="database-area">
                  <strong>A-Z area:</strong> {item.az_area}
                </p>
              )}
              {item.why && <p>{item.why}</p>}
              {searchInside.length > 0 && (
                <details className="search-inside">
                  <summary>Search inside</summary>
                  <div>
                    {searchInside.map((term) => (
                      <span key={term}>{term}</span>
                    ))}
                  </div>
                </details>
              )}
              {sourceLeads.length > 0 && (
                <details className="source-leads">
                  <summary>Journals, periodicals, or source types to try</summary>
                  <ul>
                    {sourceLeads.map((lead) => (
                      <li key={lead}>{lead}</li>
                    ))}
                  </ul>
                </details>
              )}
              {topic && (
                <a
                  className="database-topic-search"
                  href={fillTemplate(LIBRARY_LINKS.zsrArticleSearch, `${topic} ${item.database}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Search this topic in ZSR Articles
                  <span className="ext-icon">{Icon.external}</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
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

function LiveResultsSection({ liveResults = [], compact = false, followup = false }) {
  if (!liveResults.length) return null;
  const visibleResults = liveResults.slice(0, 5);
  const moreResults = liveResults.slice(5, 10);
  const renderResult = (r, i) => {
    const ids = resultIds(r);
    const hasId = Boolean(ids.doi || ids.pmid);
    // Secondary links (Scholar, ZSR search, Delivers) — the LibKey/full-text
    // and PubMed links are surfaced as primary buttons below, so drop them here.
    const accessLinks = buildAccessLinks({ title: r.title, doi: ids.doi, pmid: ids.pmid })
      .filter((link) => !/full text|pubmed/i.test(link.label))
      .slice(0, 2);
    return (
      <li key={`${r.url || r.title}-${i}`} className={`result-row ${r.cover ? "" : "no-thumb"}`}>
        <ResultThumb cover={r.cover} />
        <div className="result-body">
          <a className="result-title" href={r.url} target="_blank" rel="noopener noreferrer">
            {r.title}
            <span className="ext-icon">{Icon.external}</span>
          </a>
          <p className="result-meta">
            {[r.type, r.author, r.date].filter(Boolean).join(" · ")}
          </p>
          {r.description && <p className="result-description">{r.description}</p>}
          {r.detailPoints?.length > 0 && (
            <details className="result-details">
              <summary>More details</summary>
              <ul>
                {r.detailPoints.map((point, pointIndex) => (
                  <li key={pointIndex}>{point}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="result-actions">
            {hasId ? (
              <a className="fulltext-btn" href={libkeyUrl(ids)} target="_blank" rel="noopener noreferrer">
                <svg className="dl-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
                </svg>
                Find full text through ZSR
              </a>
            ) : (
              <a className="fulltext-btn" href={fillTemplate(LIBRARY_LINKS.googleScholarSearch, r.title || "")} target="_blank" rel="noopener noreferrer">
                <svg className="dl-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                Find via Google Scholar
              </a>
            )}
            <a href={r.url} target="_blank" rel="noopener noreferrer">Open in ZSR</a>
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
        </div>
      </li>
    );
  };

  return (
    <section className={`live-results ${followup ? "followup-first" : ""} ${compact ? "compact-extra" : ""}`}>
      <SectionHeader icon={Icon.search}>{compact ? "Catalog examples" : "Real results in ZSR's catalog"}</SectionHeader>
      {!compact && (
        <p className="found-note">
          Here's what I found in ZSR's catalog. Treat these as starting leads and open each record to confirm access, format, and fit.
        </p>
      )}
      <ul className="results">
        {visibleResults.map(renderResult)}
      </ul>
      {moreResults.length > 0 && (
        <details className="more-results">
          <summary>Show {moreResults.length} more ZSR results</summary>
          <ul className="results">
            {moreResults.map((r, i) => renderResult(r, i + visibleResults.length))}
          </ul>
        </details>
      )}
      {!compact && (
        <p className="muted terms-hint">
          Live from ZSR's catalog for your search. Images appear only when ZSR or ISBN metadata provides a real thumbnail.
        </p>
      )}
    </section>
  );
}

export default function AssistantMessage({
  reply,
  matched,
  searchTools,
  liveResults,
  topic,
  mode = DEFAULT_MODE_ID,
  responseStyle = DEFAULT_RESPONSE_STYLE_ID,
  isFollowup = false,
  isLatest,
  onFollowup,
}) {
  const [copied, setCopied] = useState(null); // index of copied term, or "all"
  const [fb, setFb] = useState("idle"); // idle | done
  const [showGap, setShowGap] = useState(false);
  const [gapNote, setGapNote] = useState("");
  const [selectedRefinements, setSelectedRefinements] = useState([]);

  if (!reply) return null;
  // Keep only substantive follow-ups; drop vague filler that makes a poor prompt.
  const followups = (reply.suggested_followups ?? []).filter((f) => {
    const t = String(f || "").trim();
    if (t.length < 12) return false;
    if (/^(try (a |the )?(narrower|broader|different)|continue|more|ok\b|sure\b|yes\b|no\b)/i.test(t)) return false;
    return true;
  });
  const tools = searchTools || [];
  const activeMode = getSearchMode(mode);

  // Enrich each recommended link with curated metadata (type, access) by URL.
  const byUrl = new Map((matched || []).map((r) => [r.url, r]));
  const norm = (u) => String(u || "").replace(/\/+$/, "").toLowerCase();
  const byUrlNorm = new Map((matched || []).map((r) => [norm(r.url), r]));
  const lookup = (url) => byUrl.get(url) || byUrlNorm.get(norm(url));
  const showTopicSpecificPlan = !isFollowup && isSocialMediaMentalHealthTopic(topic);
  const suggestedSearchGroups = showTopicSpecificPlan
    ? [...SUGGESTED_SEARCH_GROUPS, ...modeSearchGroups(activeMode)]
    : modeSearchGroups(activeMode);
  const startingPoints = showTopicSpecificPlan
    ? SOCIAL_MEDIA_MENTAL_HEALTH_RESOURCES
    : reply.starting_points || [];
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
  const latestAsk = String(topic || "");
  const wantsStartingPointHelp = /starting point|recommended|database|resource|where (should|can) i search|where to search/i.test(latestAsk);
  const wantsResourceHelp = /database|resource|where|source|peer|article|journal|search|find/i.test(latestAsk);
  const wantsSearchHelp = /term|keyword|boolean|search|string|database|find|article/i.test(latestAsk);
  const wantsCitationHelp = /citat|cite|apa|mla|zotero|bibliograph/i.test(latestAsk);
  const wantsEvaluationHelp = /evaluat|credible|peer|scholarly|quality/i.test(latestAsk);
  const wantsDatabaseStrategyHelp = /a-?z|database|databases|where to search|where can i search|periodical|periodicals|journal|journals|inside|within|specific resources/i.test(latestAsk);
  const wantsSourceHeavyHelp =
    wantsStartingPointHelp ||
    wantsResourceHelp ||
    wantsSearchHelp ||
    wantsCitationHelp ||
    wantsEvaluationHelp ||
    /evidence|sources?|articles?|books?|journals?|database|databases|catalog|find|get|show|provide|pdf|full[-\s]?text/i.test(latestAsk);
  const allowSourceSections = responseStyle !== "answer" || wantsSourceHeavyHelp;
  const showModeGuidance = responseStyle !== "answer" || wantsSourceHeavyHelp;
  const showStartingPointCards = allowSourceSections && primaryStartingPoints.length > 0 && (!isFollowup || wantsStartingPointHelp || responseStyle === "sources");
  const showGeneratedTerms = allowSourceSections && !showTopicSpecificPlan && reply.search_terms?.length > 0 && (!isFollowup || wantsSearchHelp || responseStyle === "sources");
  const showCatalogResults = liveResults?.length > 0;
  const benefitsFromRefinement =
    isFollowup &&
    (showCatalogResults ||
      /find|provide|show|get|source|sources|article|articles|book|books|database|primary|peer|recent|journal/i.test(latestAsk));
  const showMoreGuidance =
    showTopicSpecificPlan &&
    (reply.source_evaluation?.length > 0 ||
      reply.academic_integrity_note ||
      reply.citation_tips?.length > 0 ||
      reply.database_strategy?.length > 0 ||
      reply.key_journals?.length > 0 ||
      reply.limitations);
  const nextStepActions =
    !showTopicSpecificPlan && followups.length > 0
      ? followups.slice(0, 3).map((f) => ({ label: f, prompt: f }))
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
      {reply.message && <p className="msg plan-intro">{reply.message}</p>}

      {reply.redirect_notice && (
        <div className="notice redirect" role="note">
          <strong>A quick note:</strong> {reply.redirect_notice}
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
            {activeMode.recommended.slice(0, 3).map(([name, url, bestFor]) => (
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
        <LiveResultsSection liveResults={liveResults} followup />
      )}

      {allowSourceSections && reply.database_strategy?.length > 0 && (!isFollowup || wantsDatabaseStrategyHelp || responseStyle === "sources") && (
        <DatabaseStrategySection strategy={reply.database_strategy} topic={topic} />
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
        <LiveResultsSection liveResults={liveResults} />
      )}

      {allowSourceSections && (!isFollowup || showCatalogResults) && <FindFullText />}

      {showGeneratedTerms && (
        <section>
          <div className="sec-head-row">
            <SectionHeader icon={Icon.search}>Search terms to try</SectionHeader>
            <button
              type="button"
              className={`icon-copy ${copied === "all" ? "is-copied" : ""}`}
              onClick={() => copy(reply.search_terms.join("\n"), "all")}
              aria-label={copied === "all" ? "All search terms copied" : "Copy all search terms"}
            >
              {Icon.copy}
              <span className="sr-only">{copied === "all" ? "Copied" : "Copy all"}</span>
            </button>
          </div>
          <ul className="terms">
            {reply.search_terms.map((term, i) => (
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
                {tools.map((tool) => (
                  <a
                    key={tool.id}
                    className="term-search"
                    href={tool.search_url_template.replace("{q}", encodeURIComponent(term))}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Run this search in ${tool.name}`}
                  >
                    ↗ {shortToolName(tool.name)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          {tools.length > 0 && (
            <p className="muted terms-hint">Use the copy icon for a single term, or ↗ to run it as a search.</p>
          )}
        </section>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.source_evaluation?.length > 0 && (!isFollowup || wantsEvaluationHelp || responseStyle === "sources") && (
        <section>
          <SectionHeader icon={Icon.evaluate}>Evaluating your sources</SectionHeader>
          <ul className="eval">
            {reply.source_evaluation.map((tip, i) => (
              <li key={i}>{renderRich(tip)}</li>
            ))}
          </ul>
        </section>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.academic_integrity_note && !isFollowup && (
        <div className="notice integrity">
          <span className="sec-icon">{Icon.shield}</span>
          <div>
            <strong>Responsible AI &amp; academic integrity</strong>
            <p>{reply.academic_integrity_note}</p>
          </div>
        </div>
      )}

      {allowSourceSections && !showTopicSpecificPlan && reply.citation_tips?.length > 0 && (!isFollowup || wantsCitationHelp || responseStyle === "sources") && (
        <section>
          <SectionHeader icon={Icon.cite}>Citing what you find</SectionHeader>
          <ul className="eval">
            {reply.citation_tips.map((tip, i) => (
              <li key={i}>{renderRich(tip)}</li>
            ))}
          </ul>
          <CitationLinks />
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

      {allowSourceSections && !showTopicSpecificPlan && reply.limitations && !isFollowup && (
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

      {allowSourceSections && !showTopicSpecificPlan && matched?.length > 0 && !isFollowup && (
        <details className="matched">
          <summary>All curated resources matched to your topic ({matched.length})</summary>
          <ul className="resource-list">
            {matched.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.name}
                  <span className="ext-icon">{Icon.external}</span>
                </a>
                <span className="type-badge">{r.type.replace(/_/g, " ")}</span>
                <p>{r.description}</p>
                <p className="access">{r.access}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {allowSourceSections && showMoreGuidance && (
        <details className="more-guidance">
          <summary>More details</summary>
          <div className="more-guidance-body">
            {reply.source_evaluation?.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.evaluate}>Source checks</SectionHeader>
                <ul className="eval">
                  {reply.source_evaluation.slice(0, 3).map((tip, i) => (
                    <li key={i}>{renderRich(tip)}</li>
                  ))}
                </ul>
              </section>
            )}

            {reply.citation_tips?.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.cite}>Citation notes</SectionHeader>
                <ul className="eval">
                  {reply.citation_tips.slice(0, 3).map((tip, i) => (
                    <li key={i}>{renderRich(tip)}</li>
                  ))}
                </ul>
                <CitationLinks />
              </section>
            )}

            {reply.key_journals?.length > 0 && (
              <section className="compact-extra">
                <SectionHeader icon={Icon.cite}>Journal leads</SectionHeader>
                <ul className="journals compact-journals">
                  {reply.key_journals.slice(0, 4).map((j, i) => (
                    <li key={i}><span>{j}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {reply.academic_integrity_note && (
              <p className="compact-note">
                <strong>Responsible AI:</strong> {reply.academic_integrity_note}
              </p>
            )}

            {reply.limitations && (
              <p className="compact-note">
                <strong>Limitations:</strong> {reply.limitations}
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
