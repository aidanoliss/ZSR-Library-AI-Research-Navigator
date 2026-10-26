import { extractTopicExclusions } from "./researchSpec.js";
import { recommendLibrarianRoutes } from "./librarianRoutes.js";

export const RESEARCH_PEOPLE_INSTITUTION = "wfu-zsr-prototype";

// Public profile checks establish only the listed research interests. They do
// not establish availability, willingness to advise, or institutional approval.
const reviewed = {
  institutionId: RESEARCH_PEOPLE_INSTITUTION,
  status: "active",
  reviewStatus: "public-source-checked",
  lastCheckedDate: "2026-10-26",
  nextReviewDate: "2027-01-24",
};

export const WFU_FACULTY_PILOT = Object.freeze([
  {
    ...reviewed, id: "christy-buchanan", name: "Christy Buchanan", department: "Psychology",
    profileUrl: "https://psychology.wfu.edu/christy-buchanan/",
    sourceUrl: "https://psychology.wfu.edu/christy-buchanan/",
    evidenceSummary: "Her profile describes research on adolescent adjustment, family relationships, parenting beliefs, and stereotypes about adolescence.",
    matchGroups: [["adolescence", "adolescent", "adolescents", "teen", "teens", "teenager", "teenagers"], ["parenting", "parent", "parents", "family", "families", "adjustment", "stereotypes", "development"]],
  },
  {
    ...reviewed, id: "miles-silman", name: "Miles Silman", department: "Biology",
    profileUrl: "https://biology.wfu.edu/faculty-research/miles-silman/",
    sourceUrl: "https://biology.wfu.edu/faculty-research/miles-silman/",
    evidenceSummary: "His profile describes Andean and Amazonian tree communities, tropical forest ecology, and relationships between plants and climate.",
    matchGroups: [["tropical", "amazon", "amazonian", "andes", "andean", "peru", "peruvian", "bolivia", "bolivian"], ["forest", "forests", "tree", "trees", "conservation", "biodiversity", "climate"]],
  },
  {
    ...reviewed, id: "sarah-lischer", name: "Sarah Lischer", department: "Politics & International Affairs",
    profileUrl: "https://politics.wfu.edu/faculty-and-staff/sarah-lischer/",
    sourceUrl: "https://politics.wfu.edu/faculty-and-staff/sarah-lischer/",
    evidenceSummary: "Her profile lists research on refugee crises, forced migration, humanitarian aid, and international conflict.",
    matchGroups: [["refugee", "refugees", "refugee camps", "forced migration", "forced displacement", "humanitarian aid", "humanitarian crises", "humanitarian crisis"]],
  },
  {
    ...reviewed, id: "adam-lenton", name: "Adam Lenton", department: "Politics & International Affairs",
    profileUrl: "https://politics.wfu.edu/faculty-and-staff/adam-lenton/",
    sourceUrl: "https://politics.wfu.edu/faculty-and-staff/adam-lenton/",
    evidenceSummary: "His profile describes nationalism, ethnic politics, political development, and security in Russia and the former Soviet Union.",
    matchGroups: [["russia", "russian", "eurasia", "eurasian", "soviet"], ["politics", "political", "nationalism", "ethnic", "security"]],
  },
].map(record => Object.freeze({ ...record, matchGroups: Object.freeze(record.matchGroups.map(group => Object.freeze(group))) })));

const words = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const phraseIn = (text, phrase) => (` ${text} `).includes(` ${words(phrase)} `);
const officialWakeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "wfu.edu" || url.hostname.endsWith(".wfu.edu")) && !url.search && !url.hash;
  } catch { return false; }
};
const officialConsultationUrl = value => {
  if (officialWakeUrl(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "wfu.libcal.com" && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
};
const dateOnly = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
};

export function validFacultyPilotRecord(record, { asOf = new Date() } = {}) {
  if (!record || record.institutionId !== RESEARCH_PEOPLE_INSTITUTION || record.status !== "active" || record.reviewStatus !== "public-source-checked") return false;
  if (!["id", "name", "department", "evidenceSummary"].every(key => typeof record[key] === "string" && record[key].trim().length > 0 && record[key].length <= 400)) return false;
  if (!officialWakeUrl(record.profileUrl) || !officialWakeUrl(record.sourceUrl)) return false;
  const checked = dateOnly(record.lastCheckedDate), next = dateOnly(record.nextReviewDate);
  const instant = new Date(asOf);
  if (!Number.isFinite(instant.getTime())) return false;
  const today = Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate());
  if (![checked, next].every(Number.isFinite) || checked > today || today > next || next < checked || next - checked > 93 * 86400000) return false;
  return Array.isArray(record.matchGroups) && record.matchGroups.length > 0 && record.matchGroups.length <= 4 && record.matchGroups.every(group => Array.isArray(group) && group.length > 0 && group.length <= 12 && group.every(term => typeof term === "string" && term.length <= 60 && /^[\p{L}\p{N} -]+$/u.test(term) && words(term)));
}

/** Build matching input only from the student's topic and explicit positive
 * concepts/facets. Provider abstracts and model-written answers are never input. */
export function researchPeopleMatchText(spec = {}) {
  const exclusionCommands = /\b(?:exclude|excluding|omit|avoid|leave out)\s+([^.!;]+)/gi;
  const rawTopic = String(spec.topic || "");
  const commandTerms = [...rawTopic.matchAll(exclusionCommands)].map(match => match[1]);
  const positiveTopic = rawTopic.replace(exclusionCommands, " ");
  const parsed = extractTopicExclusions(positiveTopic);
  const excluded = [...parsed.terms, ...commandTerms, ...(Array.isArray(spec.excludedTerms) ? spec.excludedTerms : [])].map(words).filter(Boolean);
  const concepts = (Array.isArray(spec.concepts) ? spec.concepts : [])
    .filter(concept => concept && concept.required !== false)
    .map(concept => concept.preferredTerm);
  const facets = [spec.facets?.population, spec.facets?.geography];
  let text = words([...(spec.correctedByStudent && concepts.length ? [] : [parsed.topicText]), ...concepts, ...facets].filter(value => typeof value === "string").map(value => value.replace(exclusionCommands, " ")).join(" "));
  for (const term of excluded) {
    // Terms are normalized to letters, numbers and spaces, so the regex has no
    // user-controlled syntax. Mask excluded concepts even in supplied facets.
    text = text.replace(new RegExp(`(^| )${term}(?:s|es)?(?= |$)`, "g"), " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

/** Conservative, local, directory-backed suggestions. A mismatch produces no
 * faculty card rather than a model-generated expert or a broad department guess. */
export function recommendResearchPeople(researchSpec = {}, options = {}) {
  const institutionId = Object.hasOwn(options, "institutionId") ? options.institutionId : RESEARCH_PEOPLE_INSTITUTION;
  const base = { librarian: null, faculty: [], fallback: null, institutionId, pilot: true };
  // A Wake pilot is never presented as a directory for another institution.
  if (institutionId !== RESEARCH_PEOPLE_INSTITUTION) return base;
  const text = researchPeopleMatchText(researchSpec);
  const asOf = options.asOf ?? new Date();
  const routes = recommendLibrarianRoutes(text, researchSpec.mode || "scholarly", [], { institutionId, asOf, ...(Object.hasOwn(options, "librarianDirectory") ? { directory: Array.isArray(options.librarianDirectory) ? options.librarianDirectory : [] } : {}) });
  const verifiedLibrarian = route => route.personName && officialWakeUrl(route.profileUrl) && officialWakeUrl(route.sourceUrl) && officialConsultationUrl(route.appointmentUrl);
  let librarian = routes.find(verifiedLibrarian);
  const seen = new Set();
  const faculty = (Array.isArray(options.facultyRecords) ? options.facultyRecords : WFU_FACULTY_PILOT)
    .filter(record => validFacultyPilotRecord(record, { asOf }) && record.matchGroups.every(group => group.some(term => phraseIn(text, term))))
    .sort((left, right) => right.matchGroups.length - left.matchGroups.length || left.name.localeCompare(right.name))
    .filter(record => {
      const identity = words(record.name);
      if (seen.has(record.id) || seen.has(identity)) return false;
      seen.add(record.id); seen.add(identity); return true;
    })
    .slice(0, 2)
    .map(({ matchGroups, ...record }) => ({ ...record, reason: record.evidenceSummary }));
  // A verified faculty match also establishes a subject department for librarian
  // routing. Department alone never creates a faculty expertise match.
  if (!librarian && faculty.length) {
    const departmentRoutes = recommendLibrarianRoutes(faculty.map(person => person.department).join(" "), researchSpec.mode || "scholarly", [], { institutionId, asOf, ...(Object.hasOwn(options, "librarianDirectory") ? { directory: Array.isArray(options.librarianDirectory) ? options.librarianDirectory : [] } : {}) });
    librarian = departmentRoutes.find(verifiedLibrarian);
  }
  return {
    ...base,
    librarian: librarian ? { ...librarian, reason: librarian.subjectTags?.length ? `ZSR lists ${librarian.subjectTags.join(", ")} among this librarian’s subject areas.` : "ZSR’s subject directory links this librarian with the research area." } : null,
    faculty,
    fallback: { label: "Ask ZSR research help", href: "https://zsr.wfu.edu/ask/" },
  };
}
