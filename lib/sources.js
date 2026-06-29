export const SOURCE_TYPES = {
  PUBLIC_API: "public_api",
  RSS: "rss",
  PUBLIC_DIRECTORY: "public_directory",
  MANUAL: "manual",
};

const HN_LAUNCH_SOURCE = {
  id: "src-hn-launch",
  name: "Hacker News Launch HN",
  type: SOURCE_TYPES.PUBLIC_API,
  default_reliability_score: 0.64,
};

const DOMAIN_RULES = [
  {
    domain: "Architecture and design software",
    subdomain: "Generative spatial design",
    keywords: ["residential architecture", "floor plan", "floor plans", "home design", "custom home", "schematic design", "built environment", "zoning", "bim", "pre-construction"],
    tags: ["applied AI", "AEC software", "Consumer AI", "design tools"],
  },
  {
    domain: "CAD and engineering design tools",
    subdomain: "Text-to-CAD",
    keywords: ["cad", "openscad", "mechanical design", "parametric 3d", "text to cad", "text-to-cad", "3d models", "tinkercad", "engineering design"],
    tags: ["applied AI", "Developer tools", "design tools", "technical software"],
  },
  {
    domain: "AI infrastructure",
    subdomain: "Compute optimization and model operations",
    keywords: ["gpu cluster", "gpu clusters", "hpc", "slurm", "kubernetes", "k8s", "scheduler", "orchestrator", "inference", "model serving", "vllm", "vector database", "embedding database", "evals", "model observability", "telemetry", "workload"],
    tags: ["AI infrastructure", "Developer tools", "compute infrastructure"],
  },
  {
    domain: "AI agents and workflow automation",
    subdomain: "Workflow automation",
    keywords: ["rpa", "desktop automation", "desktop rpa", "workflow", "automation", "assistant", "copilot", "back office", "ops", "operations", "vm", "virtual machine", "mcp"],
    tags: ["agents", "workflow automation", "operations", "Enterprise SaaS"],
  },
  {
    domain: "Developer tools",
    subdomain: "Engineering workflow",
    keywords: ["developer", "code", "api", "sdk", "debug", "deploy", "github", "terminal", "database", "devops", "e2e", "testing", "staging", "web and mobile apps"],
    tags: ["Developer tools", "engineering", "software"],
  },
  {
    domain: "Data and analytics tools",
    subdomain: "AI-native analytics workspace",
    keywords: ["analytics workspace", "dashboards", "bi tools", "business intelligence", "analyze data", "reporting", "visualization layer"],
    tags: ["Enterprise SaaS", "Developer tools", "analytics"],
  },
  {
    domain: "Communications infrastructure",
    subdomain: "Messaging APIs",
    keywords: ["imessage", "sms", "rcs", "twilio", "messaging", "send and receive", "phone line", "conversation", "communications"],
    tags: ["Enterprise SaaS", "communications", "infrastructure APIs"],
  },
  {
    domain: "Logistics and supply chain",
    subdomain: "Computer vision operations",
    keywords: ["freight", "trucking", "ltl", "terminal", "dock", "cctv", "dimensioning", "shipment", "carrier", "supply chain"],
    tags: ["Logistics", "Manufacturing", "industrial AI", "computer vision"],
  },
  {
    domain: "Cybersecurity",
    subdomain: "Security operations",
    keywords: ["security", "secure", "compliance", "vulnerability", "identity", "auth", "privacy", "encryption"],
    tags: ["cybersecurity", "security", "compliance"],
  },
  {
    domain: "Healthcare operations",
    subdomain: "Care and administrative workflow",
    keywords: ["health", "clinical", "clinic", "patient", "medical", "claims", "ehr", "hospital"],
    tags: ["healthcare", "operations", "regulated workflow"],
  },
  {
    domain: "Fintech",
    subdomain: "Financial workflow",
    keywords: ["finance", "invoice", "payments", "bank", "accounting", "tax", "payroll", "spend", "trading"],
    tags: ["fintech", "financial workflow", "compliance"],
  },
  {
    domain: "Enterprise SaaS",
    subdomain: "Business operations",
    keywords: ["sales", "crm", "enterprise", "customer", "support", "hr", "procurement", "analytics"],
    tags: ["Enterprise SaaS", "business operations", "software"],
  },
  {
    domain: "Consumer AI",
    subdomain: "Personal productivity",
    keywords: ["personal", "consumer", "creator", "photo", "video", "music", "social", "mobile"],
    tags: ["consumer", "AI", "productivity"],
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function slugify(value) {
  return String(value || "company")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "company";
}

function stableHash(input) {
  let hash = 0;
  for (const char of String(input || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function parseLaunchTitle(title = "") {
  const withoutPrefix = normalizeWhitespace(title).replace(/^Launch HN:\s*/i, "");
  const parts = withoutPrefix.split(/\s[-–—]\s/);
  const rawName = parts[0] || withoutPrefix;
  const batchMatch = rawName.match(/\((YC\s+[A-Z]\d{2}|Y Combinator[^)]*)\)/i);
  const name = normalizeWhitespace(rawName.replace(/\([^)]*\)/g, ""));
  const description = normalizeWhitespace(parts.slice(1).join(" - "));
  return {
    name: name || "Unknown Launch",
    description,
    batch: batchMatch?.[1] || "",
  };
}

function keywordHits(normalized, keywords = []) {
  return keywords.filter((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function inferDomain(text) {
  const normalized = String(text || "").toLowerCase();
  const ranked = DOMAIN_RULES
    .map((rule) => ({
      ...rule,
      matched_keywords: keywordHits(normalized, rule.keywords),
    }))
    .map((rule) => ({ ...rule, hits: rule.matched_keywords.length }))
    .filter((rule) => rule.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  const winner = ranked[0];
  if (winner) return { ...winner, classification_confidence: winner.hits >= 3 ? "High" : "Medium" };
  return {
    domain: "Enterprise SaaS",
    subdomain: "New product launch",
    tags: ["startup launch", "software", "needs diligence"],
    matched_keywords: [],
    classification_confidence: "Low",
  };
}

function hasSignal(normalized, pattern) {
  return pattern.test(normalized);
}

function analyzeLaunchSignals(text, domainInfo = {}) {
  const normalized = String(text || "").toLowerCase();
  const critiquePatterns = [
    /doesn.t make sense/,
    /fire code/,
    /single-story/,
    /staircase/,
    /bedroom missing/,
    /garage inaccessible/,
    /dead space/,
    /not compelling/,
    /product in search/,
    /\brough\b/,
    /buildability/,
    /structural/,
    /zoning/,
  ];
  const critical_comment_count = critiquePatterns.filter((pattern) => pattern.test(normalized)).length;
  return {
    has_ai: hasSignal(normalized, /\b(ai|llm|agent|model|copilot|generative)\b/),
    yc_batch: hasSignal(normalized, /\byc\s+[a-z]\d{2}\b/),
    has_paid_pilot: hasSignal(normalized, /paid pilot|pilot deployment|fixed monthly fee|onboarding customers|working with companies|customer promised to sign/),
    has_usage_scale: hasSignal(normalized, /\b\d[\d,.]*(?:k|m)?\s*(?:\+)?\s+(users|designs|jobs|messages|runs|companies|customers|lines)\b/),
    has_customer_signal: hasSignal(normalized, /customer|customers|pilot|pilots|design partner|working with companies|promised to sign/),
    has_demo_or_try: hasSignal(normalized, /demo|try it|launching|today|export|github|open source|install|api|dashboard/),
    has_founder_domain_fit: hasSignal(normalized, /ran .* for .* years|grew up|research at|quant funds|hpc facilities|national hpc|built the first|working on .* before/),
    has_hard_integration: hasSignal(normalized, /slurm|k8s|kubernetes|gpu|hpc|cgroups|telemetry|cupti|dcgm|virtual machine|imessage|cctv|openscad|\bcad\b|e2e|browser|mobile|line provisioning/),
    has_budget_pain: hasSignal(normalized, /\$\d|expensive|wasted|undercharges|support tickets|capacity|pricing|costs|months|revenue|utilization|utilisation/),
    physical_world: hasSignal(normalized, /home|architecture|\bcad\b|freight|trucking|cctv|mechanical|structural|zoning|construction|fire code/),
    regulated: hasSignal(normalized, /health|medical|patient|finance|bank|tax|legal|security|privacy|government|fire code|zoning/),
    critical_comment_count,
    category_confidence: domainInfo.classification_confidence || "Low",
  };
}

function scoreFromLaunchText({ text, points = 0, comments = 0, batch = "", domainInfo = {} }) {
  const signals = analyzeLaunchSignals(text, domainInfo);
  const domain = domainInfo.domain || "";
  const launchEngagement = clamp(Math.round(points / 12 + comments / 8), 0, 16);
  const ycBoost = batch ? 7 : 0;
  const critiquePenalty = Math.min(18, signals.critical_comment_count * 5);
  const domainTechnicalBoost = /AI infrastructure|CAD and engineering design tools|Developer tools|Logistics and supply chain|Communications infrastructure/.test(domain) ? 7 : 0;
  const domainMarketBoost = /AI infrastructure|Communications infrastructure|Logistics and supply chain|AI agents and workflow automation/.test(domain) ? 7 : 0;
  const consumerPenalty = /Consumer AI|Architecture and design software/.test(domain) ? 5 : 0;

  return {
    founder_signal: clamp(42 + ycBoost + (signals.has_founder_domain_fit ? 16 : 0) + (signals.has_customer_signal ? 4 : 0), 30, 86),
    market_signal: clamp(45 + domainMarketBoost + (signals.has_budget_pain ? 16 : 0) + (signals.has_customer_signal ? 6 : 0) - consumerPenalty, 30, 90),
    product_signal: clamp(42 + (signals.has_demo_or_try ? 12 : 0) + (signals.has_usage_scale ? 8 : 0) + (signals.has_hard_integration ? 5 : 0) - critiquePenalty, 25, 88),
    technical_defensibility: clamp(36 + domainTechnicalBoost + (signals.has_hard_integration ? 18 : 0) + (signals.has_founder_domain_fit ? 6 : 0) - Math.round(critiquePenalty / 2), 25, 90),
    traction_signal: clamp(34 + launchEngagement + ycBoost + (signals.has_paid_pilot ? 16 : 0) + (signals.has_usage_scale ? 10 : 0) + (signals.has_customer_signal ? 6 : 0) - critiquePenalty, 25, 88),
    timing_signal: clamp(46 + (signals.has_ai ? 10 : 0) + domainTechnicalBoost + (signals.has_budget_pain ? 5 : 0), 30, 90),
    risk_adjustment: clamp(68 - (signals.regulated ? 8 : 0) - (signals.physical_world ? 8 : 0) - critiquePenalty + (signals.has_paid_pilot ? 6 : 0), 25, 78),
  };
}

async function fetchHackerNewsItemDetails(fetchImpl, objectID) {
  try {
    const response = await fetchImpl(`https://hn.algolia.com/api/v1/items/${objectID}`, {
      headers: { "User-Agent": "VentureRadar/1.0 research ingestion" },
    });
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function collectHackerNewsComments(children = [], max = 12, output = []) {
  for (const child of children || []) {
    if (output.length >= max) break;
    if (child?.text && !child.deleted) output.push(normalizeWhitespace(child.text));
    if (child?.children?.length) collectHackerNewsComments(child.children, max, output);
  }
  return output.slice(0, max);
}

export function normalizeCompanyCandidate(candidate, source) {
  const sourceId = source.id || source.name || "source";
  const externalId = candidate.external_id || candidate.objectID || "";
  const sourceUrl = candidate.source_url || "";
  return {
    name: candidate.name,
    website_url: candidate.website_url || "",
    source_url: sourceUrl,
    source_name: source.name,
    source_uid: candidate.source_uid || `${sourceId}:${externalId || sourceUrl || slugify(candidate.name)}`,
    external_id: externalId,
    discovered_at: new Date().toISOString(),
    launch_date: candidate.launch_date || "",
    description: candidate.description || "",
    raw_text: candidate.raw_text || "",
    metadata: candidate.metadata || {},
    confidence_score: Math.round((source.default_reliability_score || 0.6) * 100),
  };
}

export async function ingestManualUrls(urls = []) {
  return urls.map((url) =>
    normalizeCompanyCandidate(
      {
        name: new URL(url).hostname.replace(/^www\./, ""),
        source_url: url,
        raw_text: "Manual URL queued for extraction.",
      },
      { name: "Manual URL upload", default_reliability_score: 0.7 }
    )
  );
}

export async function fetchHackerNewsLaunchPosts(options = {}) {
  const {
    limit = 12,
    fetchImpl = globalThis.fetch,
    query = "\"Launch HN\"",
  } = options;

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      candidates: [],
      reason: "No fetch implementation is available for Hacker News ingestion.",
    };
  }

  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", String(limit));

  const response = await fetchImpl(url.toString(), {
    headers: { "User-Agent": "VentureRadar/1.0 research ingestion" },
  });
  if (!response.ok) {
    return {
      ok: false,
      candidates: [],
      reason: `Hacker News search failed with HTTP ${response.status}.`,
    };
  }

  const payload = await response.json();
  const hits = Array.isArray(payload?.hits) ? payload.hits : [];
  const launchHits = hits
    .filter((hit) => /^Launch HN:/i.test(hit.title || ""))
    .slice(0, limit);

  const candidates = await Promise.all(launchHits.map(async (hit) => {
      const parsed = parseLaunchTitle(hit.title);
      const detail = await fetchHackerNewsItemDetails(fetchImpl, hit.objectID);
      const commentTexts = collectHackerNewsComments(detail?.children || []);
      const sourceUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const rawText = normalizeWhitespace([hit.title, detail?.text, hit.story_text, hit.comment_text, commentTexts.join("\n")].filter(Boolean).join("\n"));
      return normalizeCompanyCandidate(
        {
          name: parsed.name,
          source_url: sourceUrl,
          external_id: `hn-${hit.objectID}`,
          launch_date: hit.created_at ? hit.created_at.slice(0, 10) : "",
          description: parsed.description || rawText,
          raw_text: rawText || hit.title,
          metadata: {
            title: hit.title,
            hn_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            author: hit.author,
            points: Number(hit.points || 0),
            num_comments: Number(hit.num_comments || 0),
            batch: parsed.batch,
            created_at: hit.created_at,
            hn_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            top_comments: commentTexts,
          },
        },
        HN_LAUNCH_SOURCE
      );
    }));

  return {
    ok: true,
    source: HN_LAUNCH_SOURCE.name,
    fetched_at: new Date().toISOString(),
    candidates,
    raw_count: hits.length,
  };
}

export function extractCompanyFromCandidate(candidate) {
  const title = candidate.metadata?.title || candidate.raw_text || candidate.name;
  const parsed = parseLaunchTitle(title);
  const name = candidate.name || parsed.name;
  const description = candidate.description || parsed.description || `${name} surfaced in a Launch HN post.`;
  const combinedText = `${title} ${description} ${candidate.raw_text || ""}`;
  const domain = inferDomain(combinedText);
  const points = Number(candidate.metadata?.points || 0);
  const comments = Number(candidate.metadata?.num_comments || 0);
  const batch = candidate.metadata?.batch || parsed.batch || "";
  const scoreInputs = scoreFromLaunchText({ text: combinedText, points, comments, batch, domainInfo: domain });
  const signals = analyzeLaunchSignals(combinedText, domain);
  const sourceUrl = candidate.source_url || candidate.metadata?.hn_url || "";
  const sourceUid = candidate.source_uid || `${candidate.source_name || "source"}:${sourceUrl || name}`;
  const profileId = `cmp-${slugify(name)}-${stableHash(sourceUid).slice(0, 6)}`;
  const regulated = /Healthcare|Fintech|Cybersecurity|Govtech|Legal/i.test(domain.domain);
  const isAi = /\b(ai|llm|agent|model|copilot)\b/i.test(combinedText);
  const positioningWedge = inferPositioningWedge(domain.domain, combinedText, description);

  return {
    id: profileId,
    source_uid: sourceUid,
    name,
    website_url: candidate.website_url || "",
    source_url: sourceUrl,
    source_name: candidate.source_name || HN_LAUNCH_SOURCE.name,
    discovered_at: candidate.discovered_at || new Date().toISOString(),
    launch_date: candidate.launch_date || candidate.metadata?.created_at?.slice(0, 10) || "",
    domain: domain.domain,
    subdomain: domain.subdomain,
    description,
    product_summary: description,
    business_model: "Unknown",
    target_customer: inferTargetCustomer(domain.domain),
    pricing: "Unknown",
    geography: "Unknown",
    stage: batch ? "Pre-seed" : "Unknown",
    funding_status: batch ? `${batch} mentioned in Launch HN title; verify directly.` : "Unknown",
    founders: [],
    founder_background_summary: "Founder details were not extracted from the HN launch summary and need direct verification.",
    positioning_wedge: positioningWedge,
    classification_confidence: domain.classification_confidence,
    matched_classification_terms: domain.matched_keywords || [],
    technical_summary: signals.has_hard_integration || isAi || /api|sdk|developer|infrastructure|security/i.test(combinedText)
      ? technicalSummaryForDomain(domain.domain, positioningWedge)
      : "Technical implementation details are not confirmed from the launch metadata.",
    traction_summary: tractionSummary(points, comments, signals),
    competitors: [],
    tags: Array.from(new Set([...domain.tags, ...(batch ? ["accelerator-mentioned"] : []), "Launch HN"])),
    confidence_score: candidate.confidence_score || 64,
    score_inputs: scoreInputs,
    evidence: {
      confirmed: [
        `Launch HN post title: ${candidate.metadata?.title || title}`,
        `Source URL captured from ${candidate.source_name || HN_LAUNCH_SOURCE.name}.`,
      ],
      inferred: [
        `${domain.domain} category inferred from matched terms: ${(domain.matched_keywords || []).slice(0, 5).join(", ") || "fallback launch wording"}.`,
        "Scores are deterministic estimates from public launch metadata and should be reviewed by an analyst.",
      ],
      unverified: [
        "Customer usage, revenue, funding, founder credentials, and product performance are not independently confirmed.",
        "HN points and comments reflect discussion activity, not willingness to pay.",
      ],
      needs_diligence: [
        "Confirm company website, founder identities, customer references, and current financing status.",
      ],
    },
    traction_signals: [
      "Launch HN post",
      points > 0 ? `${points} HN points` : "HN points unavailable",
      comments > 0 ? `${comments} HN comments` : "HN comments unavailable",
      ...(signals.has_paid_pilot ? ["Paid pilot language present in source"] : []),
      ...(signals.has_usage_scale ? ["Usage-scale claim present in source"] : []),
      ...(signals.critical_comment_count ? [`${signals.critical_comment_count} source-quality concern patterns detected in HN discussion`] : []),
    ],
    pros: [
      "Recent public launch gives a concrete starting point for diligence.",
      `${domain.domain} mapping suggests a trackable venture domain around ${positioningWedge}.`,
      batch ? `${batch} mention may be relevant if independently verified.` : "Early launch signal can be monitored over time.",
    ],
    cons: [
      "Single-source profile with unverified traction.",
      "Business model and pricing are unknown.",
      "Founder and customer evidence require corroboration.",
      ...(signals.critical_comment_count ? ["HN discussion contains product-quality or feasibility criticism that should be read before outreach."] : []),
    ],
    risk_flags: [
      {
        risk_type: "Single-source profile",
        severity: "medium",
        explanation: "The company was extracted from one launch source; core claims need corroboration.",
        evidence_url: sourceUrl,
      },
      ...(isAi
        ? [{
          risk_type: "AI platform dependency",
          severity: "medium",
          explanation: "AI-native products can depend on third-party model reliability, pricing, and distribution shifts.",
          evidence_url: sourceUrl,
        }]
        : []),
      ...(signals.critical_comment_count
        ? [{
          risk_type: "Source-quality concerns",
          severity: "high",
          explanation: "HN discussion includes product-quality, feasibility, or buildability criticism that should be reviewed before calling this high-conviction.",
          evidence_url: candidate.metadata?.hn_url || sourceUrl,
        }]
        : []),
      ...domainSpecificRisks(domain.domain, sourceUrl),
      ...(regulated
        ? [{
          risk_type: "Regulated workflow",
          severity: "high",
          explanation: "The inferred category may require security, compliance, privacy, or procurement diligence.",
          evidence_url: sourceUrl,
        }]
        : []),
    ],
    diligence_questions: diligenceQuestionsForDomain(domain.domain, signals),
    raw_candidate: candidate,
  };
}

function inferTargetCustomer(domain) {
  if (/Developer tools|AI infrastructure/.test(domain)) return "Engineering, platform, and AI infrastructure teams";
  if (/CAD and engineering/.test(domain)) return "Mechanical engineers, CAD users, and technical design teams";
  if (/Architecture/.test(domain)) return "Homeowners, residential designers, architects, builders, and developers";
  if (/Communications/.test(domain)) return "Businesses running high-volume customer messaging workflows";
  if (/Logistics/.test(domain)) return "Freight carriers, terminal operators, and logistics teams";
  if (/Data and analytics/.test(domain)) return "Data, operations, and business teams building recurring reporting workflows";
  if (/AI agents/.test(domain)) return "Operations and engineering teams automating repetitive desktop or back-office workflows";
  if (/Healthcare/.test(domain)) return "Healthcare operators and administrative leaders";
  if (/Fintech/.test(domain)) return "Finance, accounting, and operations teams";
  if (/Cybersecurity/.test(domain)) return "Security and compliance teams";
  if (/Consumer/.test(domain)) return "Consumers or creators";
  return "Business teams with repeated operational workflows";
}

function inferPositioningWedge(domain, text, description) {
  const normalized = String(text || "").toLowerCase();
  if (domain === "AI infrastructure") {
    if (/gpu|hpc|slurm|k8s|kubernetes|cluster/.test(normalized)) return "HPC/GPU cluster utilization and scheduler-aware resource prediction";
    return "AI infrastructure workflow, model operations, or compute optimization";
  }
  if (domain === "Architecture and design software") return "AI-assisted residential floor-plan ideation and pre-construction visualization";
  if (domain === "CAD and engineering design tools") return "open-source text-to-CAD and parametric mechanical design";
  if (domain === "Communications infrastructure") return "programmatic iMessage and messaging infrastructure for business workflows";
  if (domain === "AI agents and workflow automation") {
    if (/desktop rpa|rpa|virtual machine|no api/.test(normalized)) return "desktop RPA orchestration for systems without APIs";
    return "agentic workflow automation for repeated business operations";
  }
  if (domain === "Developer tools") {
    if (/browser automation|websites that don t expose apis|run as code/.test(normalized)) return "browser automation maintained as code";
    if (/e2e|testing|web and mobile apps|staging/.test(normalized)) return "agentic QA testing for web and mobile releases";
    if (/edge devices|frontier models|model.*hardware|on-device/.test(normalized)) return "frontier-model optimization for edge hardware";
    return "engineering workflow tooling for software teams";
  }
  if (domain === "Logistics and supply chain") return "computer-vision freight dimensioning in logistics terminals";
  if (domain === "Data and analytics tools") return "AI-native analytics workspace for durable dashboards and reporting";
  if (/concrete|takeoff|estimation|contractors/.test(normalized)) return "AI-assisted takeoff and estimation for construction subcontractors";
  return String(description || domain || "new product launch").toLowerCase();
}

function technicalSummaryForDomain(domain, wedge) {
  if (domain === "AI infrastructure") return `Infrastructure angle is ${wedge}; validate scheduler integrations, telemetry depth, customer deployment friction, and model accuracy.`;
  if (domain === "Architecture and design software") return `Applied generative-design angle is ${wedge}; validate buildability, code/zoning constraints, export quality, and liability boundaries.`;
  if (domain === "CAD and engineering design tools") return `Technical software angle is ${wedge}; validate CAD fidelity, engineer workflow adoption, and whether open-source usage converts into a company.`;
  return `Technical angle is ${wedge}; architecture, production maturity, and repeat usage require review.`;
}

function tractionSummary(points, comments, signals) {
  const parts = [`Launch HN engagement: ${points} points and ${comments} comments when fetched.`];
  if (signals.has_paid_pilot) parts.push("Source text includes paid-pilot or customer-pilot language.");
  if (signals.has_usage_scale) parts.push("Source text includes a usage-scale claim that needs verification.");
  if (signals.critical_comment_count) parts.push("HN discussion includes feasibility or product-quality criticism.");
  parts.push("Treat HN engagement as community interest, not revenue or customer traction.");
  return parts.join(" ");
}

function domainSpecificRisks(domain, sourceUrl) {
  if (domain === "Architecture and design software") {
    return [{
      risk_type: "Physical-world validity",
      severity: "high",
      explanation: "Residential design software must prove generated plans are buildable, code-aware, and useful beyond ideation.",
      evidence_url: sourceUrl,
    }];
  }
  if (domain === "CAD and engineering design tools") {
    return [{
      risk_type: "Workflow conversion",
      severity: "medium",
      explanation: "Open-source CAD usage may not translate into paid enterprise adoption without clear professional workflow pull.",
      evidence_url: sourceUrl,
    }];
  }
  if (domain === "Communications infrastructure") {
    return [{
      risk_type: "Platform dependency",
      severity: "high",
      explanation: "Messaging infrastructure built around third-party consumer messaging channels can face platform policy, deliverability, and reliability risk.",
      evidence_url: sourceUrl,
    }];
  }
  return [];
}

function diligenceQuestionsForDomain(domain, signals) {
  const base = [
    "What product is live today and who is using it repeatedly?",
    signals.has_paid_pilot ? "What is the paid-pilot scope, price, renewal path, and customer reference quality?" : "Are any users paying, piloting, or only testing?",
    "What customer evidence exists outside the launch post?",
  ];
  if (domain === "AI infrastructure") {
    return [
      "Which clusters are installed or piloting today, and what utilization recovery has been measured?",
      "How accurate are resource predictions across new workloads, hardware, and schedulers?",
      "Who owns the budget: platform, research computing, AI infrastructure, or finance?",
      ...base,
    ];
  }
  if (domain === "Architecture and design software") {
    return [
      "Are generated plans code-aware and buildable, or mainly ideation artifacts?",
      "What retention exists after the first design session?",
      "Who pays: homeowners, builders, architects, developers, or lead buyers?",
      ...base,
    ];
  }
  if (domain === "CAD and engineering design tools") {
    return [
      "Are mechanical engineers using generated CAD in real workflows or only experimenting?",
      "What does open-source adoption look like beyond stars and demos?",
      "What paid product sits on top of the open-source CAD workflow?",
      ...base,
    ];
  }
  if (domain === "Communications infrastructure") {
    return [
      "How durable is the platform dependency around iMessage delivery and line provisioning?",
      "What production volumes, deliverability, and customer support SLAs can be verified?",
      ...base,
    ];
  }
  return base;
}

export function refreshExtractedCompanyProfile(company) {
  if (!company?.raw_candidate) return company;
  const refreshed = extractCompanyFromCandidate(company.raw_candidate);
  return {
    ...company,
    ...refreshed,
    id: company.id || refreshed.id,
    discovered_at: company.discovered_at || refreshed.discovered_at,
  };
}

export async function fetchProductHuntLaunches() {
  return {
    ok: false,
    candidates: [],
    reason: "Connector stub only. Configure official Product Hunt access or permitted public routes before live ingestion.",
  };
}

export async function fetchGithubTrendingRepositories() {
  return {
    ok: false,
    candidates: [],
    reason: "Connector stub only. Use GitHub public APIs or permitted pages and treat stars as interest, not business traction.",
  };
}
