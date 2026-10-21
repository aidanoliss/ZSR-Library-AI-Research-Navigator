import { buildResearchSpec, formatResearchTerm } from "../config/researchSpec.js";

// Procedural coaching does not require research findings. Keep this advice
// separate from generated interpretations so an outline cannot smuggle in an
// unsupported conclusion, citation, regime classification, or source summary.
const clean = (value, limit = 500) => String(value || "").replace(/<[^>]*>|https?:\/\/\S+|www\.\S+/gi, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const section = (title, text) => ({ title, text });
const followup = /^(?:yes[,!. ]*|please[,!. ]*)?(?:make (?:it|that|this) (?:more specific|shorter|clearer)|expand (?:it|that|this)|give (?:me )?(?:an example|more detail)|what (?:should I do|comes) next)[?.! ]*$/i;

export function researchCoachingIntent(question, messages = []) {
  const q = clean(question, 2000);
  if (/\b(?:ignore|bypass|override)\b.{0,50}\b(?:rules|instructions|sources|checks)\b/i.test(q)) return "";
  if (/\b(?:what|how|which)\s+(?:does|did|is|was|are|were)\b.{0,70}\b(?:this|that|the|attached)\s+(?:paper|article|study|source|author|abstract)\b/i.test(q)
    || /\b(?:summarize|report|quote|explain)\b.{0,60}\b(?:findings|results|authors?'? (?:thesis|argument)|paper's (?:structure|thesis))\b/i.test(q)) return "";
  // Explicit coaching takes priority over words such as "compare" and "study".
  if (/\b(?:structure|organize|outline|plan)\b.{0,65}\b(?:essay|paper|argument|literature review|assignment)\b|\b(?:essay|paper|literature review)\b.{0,65}\b(?:structure|outline|plan|organize)\b/i.test(q)) return /shorter|concise|brief/i.test(q) ? "brief-outline" : /more specific|paragraph.by.paragraph|detailed|expand/i.test(q) ? "paragraphs" : "outline";
  if (/\b(?:working|possible|cautious|tentative) thesis\b|\b(?:help|how|draft|develop|write|formulate|improve)\b.{0,45}\bthesis\b/i.test(q)) return "thesis";
  if (/\b(?:plan|draft|structure|write|start|help)\b.{0,45}\b(?:introduction|intro paragraph)\b/i.test(q)) return "introduction";
  if (/\b(?:paragraph.by.paragraph|paragraph plan|body paragraph|evidence map|evidence table|organize (?:my |the )?(?:sources|evidence))\b/i.test(q)) return "paragraphs";
  if (/\b(?:narrow|refine|develop|improve|formulate|frame|unbiased|neutral)\b.{0,65}\b(?:question|topic|prompt)\b|\b(?:question|topic|prompt)\b.{0,45}\b(?:narrower|less biased|more focused)\b/i.test(q)) return "question";
  if (/\b(?:improve|broaden|narrow|build|plan|refine)\b.{0,45}\bsearch\b|\b(?:search (?:terms|strategy|strings)|keywords|boolean|what (?:should|could) I (?:search|look for))\b/i.test(q)) return "search";
  if (/\b(?:how (?:should|can|do) I|help me|checklist|reading plan)\b.{0,60}\b(?:read|evaluate|assess|skim|cross.check|check claims|compare sources|compare (?:my |the )?(?:evidence|studies))\b/i.test(q)) return "reading";
  if (followup.test(q)) {
    const prior = [...messages].reverse().find((message) => message.role === "user" && !followup.test(clean(message.content, 2000)));
    const intent = prior ? researchCoachingIntent(prior.content) : "";
    if (["outline", "paragraphs", "brief-outline"].includes(intent)) return /shorter/i.test(q) ? "brief-outline" : /clearer/i.test(q) ? "outline" : "paragraphs";
    return intent;
  }
  return "";
}

function planningContext(request) {
  // The request/brief is a desired topic, not an assertion that it is true.
  const inferredTopic = [request.question, ...[...request.messages].reverse().filter((message) => message.role === "user").map((message) => message.content)]
    .map((value) => value.match(/\b(?:essay|paper|research project)\s+(?:on|about)\s+(.+?)(?:[?!]|$)/i)?.[1]).find(Boolean);
  const topic = clean(request.topic || inferredTopic, 350);
  const spec = topic ? buildResearchSpec(topic) : null;
  const terms = (spec?.concepts || []).slice(0, 6).map((concept) => clean(concept.preferredTerm, 80));
  const comparison = (spec?.comparison?.terms || []).slice(0, 2).map((term) => clean(term, 100));
  const outcome = /sanctions/i.test(topic) && /civilian|humanitarian|well.being|human rights|health/i.test(topic)
    ? "Choose one civilian outcome, such as access to humanitarian aid or a defined health measure, as a search direction to investigate; do not assume a harmful or beneficial effect."
    : "Choose one outcome or theme and define how you will recognize it in the evidence; do not assume the direction of the result.";
  const scope = [spec?.facets?.population, spec?.facets?.geography, spec?.facets?.timePeriod].filter(Boolean).map((value) => clean(value, 120));
  return { topic, terms, comparison, outcome, scope };
}

function sourceAudit(sources) {
  const usable = sources.filter((source) => source.abstract && !source.identityWarning);
  const metadata = sources.filter((source) => !source.abstract && !source.identityWarning);
  const warnings = sources.filter((source) => source.identityWarning);
  if (!sources.length) return "No sources are attached yet. Use this as an outline to fill, then search and read before adding findings or citations.";
  return [
    `You have ${usable.length} attached record${usable.length === 1 ? "" : "s"} with abstract evidence and ${metadata.length} with citation details only. This is an inventory, not an assessment of relevance or quality.`,
    metadata.length ? `Open the original record for ${metadata.map((source) => `“${clean(source.title, 160)}”`).join("; ")} before using its findings.` : "",
    warnings.length ? "Some attached records have identity or retraction warnings. Resolve those before citing them." : "",
    "A title or named country does not verify a study's population, regime classification, methods, or results. Do not assign a source to an argument until its text supports that use.",
  ].filter(Boolean).join(" ");
}

function searches(context) {
  if (!context.topic || !context.terms.length) return [];
  const base = context.terms.filter((term) => !context.comparison.includes(term));
  const query = (terms) => [...new Set([...terms, ...context.scope])].map(formatResearchTerm).join(" AND ");
  if (context.comparison.length === 2) return context.comparison.map((group) => query([...base, group])).slice(0, 2);
  return [query(context.terms)];
}

/** All output is procedural advice, placeholders, or authenticated record
 * inventory. No generated prose is admitted through this planning channel. */
export function researchCoachingReply(request) {
  const intent = researchCoachingIntent(request.question, request.messages);
  if (!intent) return null;
  const c = planningContext(request);
  const topicLine = c.topic ? `Working topic: ${c.topic}. ` : "You have not set a research topic yet. ";
  const comparison = c.comparison.length === 2;
  const compareLine = comparison
    ? `For your proposed comparison of ${c.comparison.join(" and ")}, use explicit, cited classification criteria and comparable outcomes, populations, dates, and methods. Do not infer the category from a country name in a title.`
    : "If you compare cases or perspectives, use the same outcome definitions and check whether populations, places, time periods, and methods are comparable.";
  const thesisFrame = comparison
    ? `In [population/place and period], the evidence suggests [qualified relationship] between [exposure] and [defined outcome], with [supported similarity or difference] between ${c.comparison.join(" and ")}; [important limitation] restricts that conclusion.`
    : "For [population/place and period], [exposure or issue] is associated with [outcome or interpretation], subject to [counterevidence or limitation].";
  let message, guidance, suggestions;
  if (intent === "brief-outline") {
    message = "Here is the shorter version. Treat it as a plan to fill with evidence.";
    guidance = [section("Opening", `${topicLine}State your focused question, scope, and tentative thesis.`), section("Body", `${compareLine} Organize by outcome or theme: point → cited evidence → explanation → limitation. Include counterevidence.`), section("Conclusion", "Give a qualified answer and the main unresolved limitation. Do not turn a title, an AI suggestion, or an abstract alone into a stronger finding.")];
    suggestions = ["Make the essay outline more specific with a paragraph plan.", "Help me draft a cautious working thesis."];
  } else if (intent === "outline") {
    message = "Yes. Build the essay around a question and a line of reasoning, rather than one paragraph per source. Here is a structure to fill with evidence.";
    guidance = [
      section("1. Introduce the question and scope", `${topicLine}${c.outcome} Define your population, place, and period${c.scope.length ? `, keeping your requested scope (${c.scope.join("; ")})` : ""}. End the introduction with a tentative thesis; revise it after reading.`),
      section("2. Define what you are comparing", `${compareLine} Explain why the cases can answer your question, rather than assuming they form a valid comparison.`),
      section("3. Organize the body by evidence and outcome", "Give each section one analytical purpose. Within a paragraph: provisional point → exact evidence with citation → explanation → method or scope limitation → connection to the question. Distinguish what an abstract reports from what you verified in the full text."),
      section("4. Test differences and alternative explanations", "Compare the same outcome across your cases or perspectives. Consider timing, policy design, study methods, and other explanations as possibilities to check, not established causes. Include evidence that challenges your initial view."),
      section("5. Conclude at the strength of the evidence", "Answer the question only as far as your sources support it. State the most important uncertainty and what additional evidence would resolve it. Do not introduce new findings in the conclusion."),
      section("Before you draft", sourceAudit(request.sources)),
    ];
    suggestions = ["Make the essay outline more specific with a paragraph plan.", "Help me draft a cautious working thesis.", "Help improve my search for this comparison."];
  } else if (intent === "paragraphs") {
    message = "Here is a more concrete paragraph plan. The bracketed statements are evidence slots, not conclusions to copy as facts.";
    guidance = [
      section("Opening paragraph", `${topicLine}Write: “This essay asks [focused question] in [scope]. I compare [cases/perspectives] using [outcome and criteria].” Add a working thesis only after the evidence supports it.`),
      section("Definitions and comparison paragraph", `${compareLine} Record the definition and its citation, the case-selection reason, and any limit on comparability.`),
      section("First evidence paragraph", "Draft the point as a question first: “What happens to [one outcome] in [case/population]?” Fill in: [claim supported by source] → [exact passage and page/section] → [what the method permits] → [why this matters]. Leave the claim blank if you only have a title."),
      section("Comparison paragraph", "Repeat the same evidence slots for the other case or perspective. Then write a separate sentence comparing only the measures and conditions that actually align. If they do not align, explain the gap instead of declaring a winner."),
      section("Challenge and conclusion paragraphs", "Give the strongest counterexample or competing explanation its own space. Finish with a qualified answer, the main evidence limitation, and a specific unresolved question. Adjust paragraph count to the assignment rather than padding the essay."),
      section("Build an evidence table before drafting", `Use columns: source | population and place | dates | method | outcome definition | exact passage and page | supported claim | limitation | proposed paragraph. ${sourceAudit(request.sources)}`),
    ];
    suggestions = ["Help me plan the introduction.", "Help me draft a cautious working thesis.", "How should I read and compare these studies?"];
  } else if (intent === "thesis") {
    message = "Use a provisional thesis with blanks until reading establishes the relationship. I cannot decide the finding from your topic or source titles.";
    guidance = [section("Working thesis frame", thesisFrame), section("What must earn its place", `${topicLine}Replace every bracket with evidence you can locate. ${compareLine} Use “associated with” for an association; reserve causal language for a design and analysis that justify it.`), section("Try to disprove it", "List the strongest counterevidence and ask what finding would make you revise the thesis. If your sources disagree, describe the conditions of the disagreement instead of forcing a single verdict."), section("Evidence check", sourceAudit(request.sources))];
    suggestions = ["Help me structure my essay around that thesis.", "How should I evaluate the evidence for my thesis?", "Help improve my search for counterevidence."];
  } else if (intent === "introduction") {
    message = "Start with the research problem and the precise question. Avoid an unsupported dramatic statistic or a verdict your sources have not earned.";
    guidance = [section("Opening move", `${topicLine}Name the issue and the question you want to resolve. Add background only with a source that supports it; no background facts are established by this planning response.`), section("Scope and terms", `${c.outcome} ${compareLine} State any limits on population, place, period, and source type.`), section("Thesis and route through the essay", `End with a qualified thesis frame: ${thesisFrame} Then briefly name the analytical sections your reader will encounter.`)];
    suggestions = ["Help me draft a cautious working thesis.", "Make the essay outline more specific."];
  } else if (intent === "question") {
    message = "Make the question answerable without building the conclusion into the wording. Choose one scope decision at a time.";
    guidance = [section("Choose an outcome and a scope", `${topicLine}${c.outcome} Pick a population, place, and period your sources can address.`), section("Use a neutral question frame", comparison ? `“For [population and period], how does [defined outcome] vary between ${c.comparison.join(" and ")} under [specified conditions], and what evidence supports that comparison?” This is a proposed question, not a finding.` : "“For [population/place and period], what is the relationship between [exposure/issue] and [outcome], and what evidence or alternative explanations qualify it?” This is a proposed question, not a finding."), section("Check feasibility before committing", `${compareLine} Find evidence for each part of the question. If one side is missing, broaden the search or revise the question transparently; do not fill the gap with an assumption.`)];
    suggestions = ["Help improve my search for this question.", "Help me structure my essay."];
  } else if (intent === "search") {
    message = "Search for evidence in stages. The search drafts below are vocabulary suggestions to review, not research findings.";
    guidance = [section("Separate your concepts", `${topicLine}${c.terms.length ? `Starting concepts from your topic: ${c.terms.join("; ")}. ` : "Identify the issue, outcome, and population or comparison. "}Join different concepts with AND and alternatives for one concept with OR. Use quotes for a phrase, and adapt syntax to the database.`), section("Search each side, then compare", comparison ? `Run a parallel search for ${c.comparison[0]} and for ${c.comparison[1]}. Do not require both labels to appear in every article. Keep the outcome and scope consistent across those searches.` : "Start with the main issue and outcome. Add population, place, or method one at a time so you can see which restriction removes useful records."), section("Look for disagreement and verify coverage", "Search for null results, unintended effects, and alternative explanations as possible directions. Follow cited and citing work, and check a subject database as well as library search. Record the query, tool, date, filters, and useful records; a few attached abstracts are not a comprehensive review."), section("Check the scope before using a source", sourceAudit(request.sources))];
    suggestions = ["Help me narrow my research question.", "How should I read and compare these studies?"];
  } else {
    message = "Use a consistent reading checklist so your essay compares evidence rather than just repeating summaries.";
    guidance = [section("Skim to decide relevance", `${topicLine}Check the research question, source type, population, place, dates, and method. An abstract can guide selection, but does not replace reading the relevant methods and results.`), section("Read for a claim you can trace", "For each useful point, record the exact passage, page or section, who or what was studied, how the outcome was measured, and uncertainty. Check that any AI summary describes the same population, period, measure, and result as that passage."), section("Compare without merging studies", `${compareLine} Keep each study's evidence separate. Distinguish the authors' findings, their interpretation, and your own inference.`), section("Put limits in the essay", `Check design, measurement, counterevidence, and whether the conclusion extends beyond the sample. If you cannot access the full text, mark that limitation. ${sourceAudit(request.sources)}`)];
    suggestions = ["Make an evidence table and paragraph plan.", "Help me draft a cautious working thesis."];
  }
  if (request.assignmentContext) guidance.push(section("Check your assignment before drafting", "Use the assignment brief for required length, sections, source types, citation style, and any course AI rules. Adjust this plan to those requirements; the brief is guidance, not evidence of research findings."));
  if (request.expiredSources) guidance.push(section("Refresh older attachments for evidence discussions", `${request.expiredSources} attached source record${request.expiredSources === 1 ? " has" : "s have"} expired. This plan does not use those records. Run their Navigator search again before asking about their findings.`));
  return {
    mode: "planning", status: "answered", message, guidance, blocks: [],
    suggestions, searchQuestions: intent === "search" ? searches(c) : [],
    notice: "Planning suggestions are not research findings. Check your assignment and verify source claims in the original text; no full text was read here.",
  };
}
