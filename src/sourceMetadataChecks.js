// Conservative descriptions of provider metadata, not assessments of findings.
// Absence of a cue is unknown. Only explicit contradictions justify exclusion.
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalized = (value) => clean(value).toLowerCase().replace(/[_-]+/g, " ");

export function sourceMetadataText(source = {}) {
  return clean(source.abstractText || source.abstractExcerpt).slice(0, 20000);
}

export function sourceReportedType(source = {}) {
  return normalized(source.type || source.citationMetadata?.type || source.citation?.type || source.provenance?.recordType);
}

const METHOD_ALIASES = {
  "systematic review": ["systematic review"], "meta analysis": ["meta analysis"], "scoping review": ["scoping review"],
  "literature review": ["literature review", "systematic review", "scoping review", "meta analysis"],
  review: ["review", "review article", "book review", "systematic review", "scoping review", "meta analysis", "literature review", "theoretical review"],
  "qualitative interview": ["qualitative interview"], "qualitative study": ["qualitative study", "qualitative research", "qualitative interview"],
  "empirical study": ["empirical study", "original research", "randomized controlled trial", "randomised controlled trial", "observational study"],
  "randomized controlled trial": ["randomized controlled trial", "randomised controlled trial"],
};

function sentences(source) {
  // Avoid using reference lists, cited studies, or background mentions as this
  // source's methods. Self-description patterns below must start the clause.
  return sourceMetadataText(source).split(/(?<=[.!?;])\s+/).map(normalized);
}

// Normalization for matching only. Evidence quotations always use the original
// provider sentence, including its structured-abstract heading.
function studyClause(value) {
  let text = normalized(value);
  const structured = /^(?:methods?|design|abstract|participants):\s*/.test(text);
  const contextual = /^based on (?:this|these) [^,;.!?]{1,80},\s*/.test(text);
  text = text.replace(/^(?:methods?|design|abstract|participants):\s*/, "")
    .replace(/^based on (?:this|these) [^,;.!?]{1,80},\s*/, "");
  // 'The study' under a Participants heading denotes this record's sample.
  // A bare 'the study' can refer to earlier cited work and stays ambiguous.
  return structured || contextual ? text.replace(/^the study\b/, "this study") : text;
}

const AMBIGUOUS_STUDY_DESCRIPTION = /\b(?:not|never|no|without|instead of|rather than|previous|prior|earlier|propos\w*|plan\w*|will|would|could|should|protocol|according to|reported by|described by)\b/;
const PASSIVE_QUALITATIVE_INTERVIEWS = /^(?:in depth )?qualitative interviews (?:were|have been) conducted (?:with|among)\b/;
const CONDUCTED_QUALITATIVE_RESEARCH = /^(?:this|our|the present|the current) qualitative (?:study|research) (?:was|is|has been) conducted\b/;

function describesCompletedQualitativeInterviews(statement) {
  const clause = studyClause(statement);
  return PASSIVE_QUALITATIVE_INTERVIEWS.test(clause)
    || CONDUCTED_QUALITATIVE_RESEARCH.test(clause) && /\b(?:through|using|with) (?:in depth |semi structured )?interviews\b/.test(clause);
}

function ownMethodStatements(source) {
  return sourceMetadataText(source).split(/(?<=[.!?;])\s+/).filter((original) => {
    const sentence = studyClause(original);
    return (/^(?:(?:in\s+)?(?:this|our|the present|the current)\s+(?:study|paper|article|research|[a-z]+ review)|we\s)/.test(sentence)
      || PASSIVE_QUALITATIVE_INTERVIEWS.test(sentence) || CONDUCTED_QUALITATIVE_RESEARCH.test(sentence))
      && !AMBIGUOUS_STUDY_DESCRIPTION.test(sentence);
  });
}

function describesMethod(statement, name) {
  if ((name === "qualitative interview" || name === "qualitative study" || name === "qualitative research") && describesCompletedQualitativeInterviews(statement)) return true;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const method = escaped === "meta analysis" ? "meta analys(?:is|es)" : `${escaped}s?`;
  return new RegExp(`^(?:(?:methods?|design|abstract):\\s*)?(?:` +
    `(?:in\\s+)?(?:this|our|the present|the current)\\s+(?:(?:study|paper|article|research)\\s+(?:is|was|uses?|used|employs?|employed|presents?|reports?)\\s+)?(?:an?\\s+)?${method}\\b|` +
    `(?:we|(?:this|our|the present|the current)\\s+(?:study|paper|article|research))\\s+(?:conducted|conducts?|performed|performs?|undertook|used|uses?|employed|employs?|presents?|reports?)\\s+(?:an?\\s+)?${method}\\b` +
    `)`).test(studyClause(statement));
}

function isBookReview(source) {
  const title = clean(source.title);
  return sourceReportedType(source) === "book review" || /^(?:book review|review of (?:the )?book)\s*[:—-]/i.test(title)
    || /\(book review\)\s*$/i.test(title)
    || /^(?:this (?:article|paper) reviews? (?:the )?book|this is a book review|this book review\b|we review (?:the )?book)\b/i.test(sourceMetadataText(source));
}

export function sourceMethodEvidence(source, method) {
  const type = sourceReportedType(source);
  const requested = normalized(method);
  const aliases = METHOD_ALIASES[requested] || [requested];
  const statements = ownMethodStatements(source);
  if (aliases.includes(type)) return { status: "meets", detail: `The provider labels this record “${type}”. Confirm its methods in the source.` };
  const bookReview = isBookReview(source);
  const nonStudy = bookReview || /^(?:editorial|commentary|opinion|hearing)$/.test(type);
  if (requested === "empirical study" && nonStudy) {
    return { status: "mismatch", detail: bookReview ? "The provider's title, type, or description identifies a book review, rather than an original empirical study. Follow the reviewed book for its original argument and methods." : `The provider labels this record “${type}”, rather than an original empirical study. Follow its references for original research.` };
  }
  const explicit = statements.find((statement) => aliases.some((alias) => describesMethod(statement, alias)));
  const empirical = statements.find((statement) => /^we (?:interviewed|surveyed|recruited|randomized|randomised)\s/.test(studyClause(statement))
    || /^(?:this|our|the present|the current) study (?:interviewed|surveyed|recruited|randomized|randomised)\s/.test(studyClause(statement))
    || describesCompletedQualitativeInterviews(statement));
  if (explicit || requested === "empirical study" && empirical) {
    const passage = clean(explicit || empirical);
    return { status: "meets", detail: `The provider abstract describes this work's method: “${passage.slice(0, 260)}”${passage.length > 260 ? " (excerpt)" : ""}. This has not been checked against the full text.` };
  }
  const review = METHOD_ALIASES.review.includes(type) || statements.some((statement) => METHOD_ALIASES.review.some((alias) => describesMethod(statement, alias)));
  const mixedDesign = statements.some((statement) => /\band (?:then )?(?:interviewed|surveyed|recruited|randomized|randomised|conducted interviews)\b/.test(normalized(statement)));
  if (requested === "empirical study" && review && !mixedDesign) {
    return { status: "mismatch", detail: "The provider describes a review, commentary, or primary document, rather than an original empirical study. Follow its references for original research." };
  }
  return { status: "unverified", detail: "The available metadata does not establish this method. Read the methods or publication description; keyword mentions alone are insufficient." };
}

export function sourceFormatDetailCheck(source, contract) {
  const type = sourceReportedType(source);
  const title = clean(source.title);
  const bookReview = isBookReview(source);
  const hearing = /^(?:congressional |parliamentary )?hearing$/.test(type)
    || /(?:^|[:—])\s*hearings? before (?:the |a )?(?:committee|subcommittee|senate|house|congress|parliament)\b/i.test(title);
  if (contract?.id === "books" && (bookReview || hearing)) {
    return { id: "document-role", label: "Document role", status: "mismatch", detail: bookReview ? "This record describes a book review, not the book being reviewed." : "This record describes a government hearing, not a book or introductory overview." };
  }
  if (contract?.id === "scholarly" && hearing) {
    return { id: "document-role", label: "Document role", status: "mismatch", detail: "This record describes a government hearing, not a scholarly research article." };
  }
  return null;
}

// Educational levels have a clear, limited incompatibility. Broad ages (e.g.
// 'young adults') are not disjoint from college students and must not exclude.
const COLLEGE = /\b(?:undergraduates?|(?:college|university) students?)\b/;
const SCHOOL = /\b(?:(?:high|secondary|primary|elementary|middle) school (?:students?|pupils?)|schoolchildren|k 12 students?)\b/;

export function sourcePopulationCheck(source, population) {
  if (!clean(population)) return null;
  const requested = normalized(population).replace(/\*/g, "");
  const sentencesForStudy = sentences(source).map(studyClause).filter((sentence) =>
    (/^(?:we (?:recruited|surveyed|interviewed|studied|randomized|randomised)|(?:this|our|the present|the current) study (?:examines?|investigates?|assesses?|explores?|studies|studied|recruited|included|involved|focuses on)|(?:the |our )?(?:sample|participants) (?:consisted of|comprised|included|were))\b/.test(sentence)
      || PASSIVE_QUALITATIVE_INTERVIEWS.test(sentence))
    && !AMBIGUOUS_STUDY_DESCRIPTION.test(sentence));
  const college = sentencesForStudy.some((sentence) => COLLEGE.test(sentence));
  const school = sentencesForStudy.some((sentence) => SCHOOL.test(sentence));
  // For exclusion, a level must directly describe recruited participants, not
  // teachers discussing pupils or a study about transitions between levels.
  const samplePrefix = "^(?:methods?:\\s*)?(?:we (?:recruited|surveyed|interviewed|randomized|randomised)|(?:this|our|the present|the current) study (?:recruited|included|involved)|(?:the |our )?(?:sample|participants) (?:consisted of|comprised|included|were))\\s+(?:(?:a total of|a sample of|only|all|\\d+|male|female|first year)\\s+)*";
  const collegeSample = sentencesForStudy.some((sentence) => new RegExp(`${samplePrefix}${COLLEGE.source}`).test(sentence));
  const schoolSample = sentencesForStudy.some((sentence) => new RegExp(`${samplePrefix}${SCHOOL.source}`).test(sentence));
  const requestedPattern = COLLEGE.test(requested) ? COLLEGE.source : SCHOOL.test(requested) ? SCHOOL.source
    : `\\b${requested.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`;
  const populationModifiers = "(?:(?:\\d+|first year|final year|male|female|(?:non )?[a-z]+(?: [a-z]+)? major)\\s+)*";
  // Participants must be the population itself, not its teachers or caregivers.
  // A mixed sample stays available, but its applicability needs checking.
  const match = sentencesForStudy.some((sentence) => new RegExp(`${samplePrefix}${requestedPattern}`).test(sentence)
    || new RegExp(`^(?:this|our|the present|the current) study (?:examines?|investigates?|assesses?|explores?|studies|studied)\\b.{0,240}\\b(?:among|in)\\s+${populationModifiers}${requestedPattern}`).test(sentence)
    || new RegExp(`^(?:this|our|the present|the current) study focuses on\\s+${populationModifiers}${requestedPattern}`).test(sentence)
    || new RegExp(`^(?:in depth )?qualitative interviews (?:were|have been) conducted (?:with|among)\\s+${populationModifiers}${requestedPattern}`).test(sentence));
  // A mixed sample or a broader/overlapping population needs review, not rejection.
  const conflict = COLLEGE.test(requested) && schoolSample && !college || SCHOOL.test(requested) && collegeSample && !school;
  return { id: "population", label: "Study population", status: match ? "meets" : conflict ? "mismatch" : "unverified",
    detail: match ? `The provider's study description names the requested population (${population}). Verify the sample and applicability in the source.`
      : conflict ? `The provider's study description identifies ${school ? "school pupils" : "college students"}, which does not match the requested population (${population}).`
      : `The available metadata does not establish the requested population (${population}); check the study's sample or scope.` };
}

function interval(value) {
  const text = normalized(value).replace(/[–—]/g, " ");
  const range = text.match(/\b(1\d{3}|2[01]\d{2})\s*(?:to|through|and|\s)\s*(1\d{3}|2[01]\d{2})\b/);
  if (range) return Number(range[1]) <= Number(range[2]) ? { from: Number(range[1]), to: Number(range[2]) } : null;
  const bound = text.match(/\b(after|since|from|before|until|through|in)\s+(1\d{3}|2[01]\d{2})\b/);
  if (bound) {
    const value = Number(bound[2]);
    if (bound[1] === "in") return { from: value, to: value };
    if (["before", "until", "through"].includes(bound[1])) return { from: null, to: value - (bound[1] === "before" ? 1 : 0) };
    return { from: value + (bound[1] === "after" ? 1 : 0), to: null };
  }
  const decade = text.match(/\b(1\d{2}0|20\d0)s\b/);
  return decade ? { from: Number(decade[1]), to: Number(decade[1]) + 9 } : null;
}

function intervals(value) {
  const text = normalized(value).replace(/[–—]/g, " ");
  const ranges = [...text.matchAll(/\b(1\d{3}|2[01]\d{2})\s*(?:to|through|and|\s)\s*(1\d{3}|2[01]\d{2})\b/g)].map((match) => interval(match[0])).filter(Boolean);
  return ranges.length ? ranges : [interval(text)].filter(Boolean);
}

export function sourcePeriodCheck(source, timePeriod, publicationYear) {
  if (!clean(timePeriod)) return null;
  const requested = interval(timePeriod);
  if (!requested) return null;
  const scope = sentences(source).filter((sentence) =>
    (/^(?:(?:methods?|data):\s*)?(?:we (?:used|analy[sz]ed|examined|studied)|(?:this|our|the present|the current) (?:study|paper|analysis) (?:uses?|used|analy[sz]es|analy[sz]ed|examines?|studies|covers?)|(?:the |our )?data (?:cover|span|were collected)|using (?:a |the )?(?:data|panel|survey))\b/.test(sentence)
      || /^(?:leveraging|using) (?:a |the )?period\b.{0,450},\s*we (?:explore|examine|analy[sz]e|study)\b/.test(sentence))
    && !AMBIGUOUS_STUDY_DESCRIPTION.test(sentence)
    && !/\b(?:forecast\w*|project(?:ed|ions?))\b/.test(sentence));
  const ranges = scope.flatMap(intervals);
  const overlaps = (range) => (requested.from === null || range.to === null || range.to >= requested.from)
    && (requested.to === null || range.from === null || range.from <= requested.to);
  // Multiple periods can represent a historical comparison. Reject only when
  // every explicitly described study period is outside the requested period.
  const conflict = ranges.length > 0 && ranges.every((range) => !overlaps(range));
  const forecast = /\b(?:forecast\w*|projections?|projected|scenario\w*|prospective)\b/i.test(`${source.title || ""} ${sourceMetadataText(source)}`);
  const tooEarly = requested.from !== null && publicationYear !== null && publicationYear < requested.from && !forecast;
  const contained = ranges.some((range) => (requested.from === null || range.from !== null && range.from >= requested.from)
    && (requested.to === null || range.to !== null && range.to <= requested.to));
  return { id: "study-period", label: "Period studied", status: conflict || tooEarly ? "mismatch" : contained ? "meets" : "unverified",
    detail: conflict ? `The provider's study description covers ${ranges.map((range) => `${range.from ?? "earlier"}–${range.to ?? "later"}`).join("; ")}, outside the requested subject period (${timePeriod}).`
      : tooEarly ? `Published ${publicationYear}, before the requested subject period (${timePeriod}). This is a subject-coverage check, not a publication-date filter.`
      : contained ? `The provider's study description names a period within the requested subject period (${timePeriod}). Verify the temporal scope in the source.`
      : `Confirm coverage of the requested subject period (${timePeriod}). ${ranges.length ? "The provider describes an overlapping period, but metadata alone does not establish coverage of the whole request." : "Publication date alone does not establish the period studied."}` };
}
