/**
 * Developer-curated paraphrases of public ZSR research guidance, selected on
 * 2026-10-21. These are a bounded reference snapshot, not librarian approval,
 * verbatim quotations, a live website lookup, or evidence of study findings.
 * See docs/validation/2026-10-21/conversational-coach/knowledge-sources.md.
 */
export const RESEARCH_COACH_KNOWLEDGE_VERSION = "2026-10-21.1";

export const RESEARCH_COACH_GUIDES = Object.freeze([
  {
    id: "topic-refinement",
    title: "Topic refinement — Humanities Research: Sources and Strategies",
    url: "https://guides.zsr.wfu.edu/c.php?g=922386&p=6669650",
    summary: "Develop both broad and narrow keyword sets for a topic. Time period, geographic region, and discipline can help describe scope. For comparative or interdisciplinary work, identify terms for each entity or discipline. List synonyms, then refine the vocabulary as reading reveals additional terms in titles, abstracts, bibliographies, and database subject headings. Broad terms can help locate background resources; narrower terms can support more focused catalog and article searches.",
    topics: ["getting started", "research question", "narrow topic", "comparison", "scope", "keywords"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "indexed-primary-page-text",
  },
  {
    id: "search-techniques",
    title: "Search Techniques — HST 323 Article Databases",
    url: "https://guides.zsr.wfu.edu/c.php?g=1072064&p=7805742",
    summary: "AND requires the joined search concepts; OR offers alternatives such as synonyms or related terms. Group alternatives in parentheses and use quotation marks to search a phrase. Truncation and wildcard symbols can retrieve word variants, but their behavior depends on the database; consult that tool's search help before reusing a symbol. Treat an expanded synonym as a vocabulary option to assess for relevance, not as a finding about the topic.",
    topics: ["Boolean", "AND", "OR", "synonyms", "search string", "phrase searching", "truncation"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "indexed-primary-page-text",
  },
  {
    id: "evaluate-and-read",
    title: "Evaluating Sources — FYS: The Good Life",
    url: "https://guides.zsr.wfu.edu/c.php?g=1457740&p=10838652",
    summary: "Check whether a source helps answer the research question and meets the assignment's requirements. Consider author expertise, publisher or journal, publication date in relation to the topic, citations, and the work's structure. A book's contents, introduction, or preface can help identify useful sections. An article's abstract, introduction, conclusion, and headings can help assess likely relevance before closer reading. For empirical articles, examine methods, results, and discussion rather than treating an abstract or a scholarly-looking record as sufficient evaluation.",
    topics: ["source evaluation", "scholarly sources", "peer review", "reading", "abstract", "methods", "evidence"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "indexed-primary-page-text",
  },
  {
    id: "citation-tools",
    title: "Citation Tools & Style Guides",
    url: "https://zsr.wfu.edu/research/guides/citation/",
    summary: "ZSR provides links to citation tools and style guides. Citation managers can help save, organize, and cite source records; bibliography tools can help assemble references. Use the style and edition required by the assignment, consult the relevant guide for the source format, and check the generated citation against the original record. Tool availability and a formatted reference do not verify a source's identity or the claims attributed to it.",
    topics: ["citation", "references", "bibliography", "Zotero", "citation manager", "style guide"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "public-page-text",
  },
  {
    id: "systematic-searching",
    title: "Conduct Literature Searches — Systematic Reviews & Evidence Synthesis",
    url: "https://guides.zsr.wfu.edu/c.php?g=1470676&p=10952495",
    summary: "A systematic review addresses a specific research question through a systematic, transparent approach to searching, selecting, and assessing studies. Develop concepts and terms, consider controlled vocabulary and field tags, adapt the strategy to each database, and document search iterations and results. Different databases index different journals, so a comprehensive review requires planned coverage across relevant tools rather than one search. ZSR recommends librarian support for constructing, testing, translating, and documenting systematic searches. A routine course literature review need not be described as a systematic review.",
    topics: ["systematic review", "literature review", "search log", "comprehensive search", "controlled vocabulary", "database selection"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "public-page-text",
  },
  {
    id: "ai-literacy",
    title: "ZSR Guide to Using AI",
    url: "https://zsr.wfu.edu/about/administration/ai-engagement-framework/guide-to-using-ai/",
    summary: "When considering AI assistance, examine its purpose, data and licensing concerns, whether output can be checked, consequences of error, effects on learning, and user choice. ZSR describes early idea generation and AI-assisted searching with human review among its uses. Its framework excludes presenting AI output as authoritative library guidance and loading licensed content where prohibited or restricted. This institutional framework does not determine a student's individual course rules; check the instructor's requirements and keep responsibility for verification and analysis.",
    topics: ["AI literacy", "AI limitations", "privacy", "verification", "course policy", "learning", "responsible AI"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "public-page-text",
  },
  {
    id: "librarian-support",
    title: "Research Help — Research Librarians",
    url: "https://zsr.wfu.edu/research/librarians/",
    summary: "ZSR's research-help page offers a route to one-on-one librarian research consultations and lets researchers find help by subject or topic. A librarian can help with developing a topic or finding sources at different stages of a project. Use the official page to find an appropriate contact and current booking details. Navigator cannot promise a particular appointment, response time, account eligibility, source access, or librarian approval of its advice.",
    topics: ["librarian", "research consultation", "research help", "stuck", "subject expert"],
    checkedAt: "2026-10-21",
    basis: "developer-curated-paraphrase",
    retrieval: "public-page-text",
  },
].map((guide) => Object.freeze({ ...guide, topics: Object.freeze(guide.topics) })));
