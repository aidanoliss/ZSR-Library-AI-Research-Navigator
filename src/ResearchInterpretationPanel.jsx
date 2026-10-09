import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SEARCH_MODES, getSearchMode } from "../config/libraryLinks.js";
import { buildSearchRefinement } from "../config/searchRecovery.js";
import {
  buildBoundedRefinementPrompt,
  buildInterpretationCorrectionPrompt,
  normalizeResearchSpec,
  normalizeTextList,
  researchSpecDiff,
  sourceContractLines,
} from "./researchInterpretation.js";

const REFINEMENTS = [
  ["too-broad", "Too broad"],
  ["too-narrow", "Too narrow"],
  ["wrong-discipline", "Wrong discipline"],
  ["wrong-source-type", "Wrong source type"],
];

function stableSpecKey(spec) {
  try {
    return JSON.stringify(spec || {});
  } catch {
    return String(spec || "");
  }
}

export default function ResearchInterpretationPanel({
  researchSpec,
  fallbackTopic = "",
  fallbackMode = "",
  releaseId = "",
  isLatest = false,
  isRefreshing = false,
  onRerun,
  onRefine,
  editorRequest = 0,
  recoveryEditor = false,
}) {
  const panelId = useId();
  const topicInputRef = useRef(null);
  const conceptInputRef = useRef(null);
  const conceptGroupRef = useRef(null);
  const disciplineInputRef = useRef(null);
  const original = useMemo(
    () => normalizeResearchSpec(researchSpec, { topic: fallbackTopic, mode: fallbackMode }),
    [stableSpecKey(researchSpec), fallbackTopic, fallbackMode]
  );
  const [draft, setDraft] = useState(original);
  const [newConcept, setNewConcept] = useState("");
  const [requestedChange, setRequestedChange] = useState("");
  const [sourceTypeChoice, setSourceTypeChoice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => { if (editorRequest > 0) setEditorOpen(true); }, [editorRequest]);
  useEffect(() => {
    if (editorRequest > 0 && editorOpen) topicInputRef.current?.focus();
  }, [editorRequest, editorOpen]);
  const refinementSuggestion = useMemo(() => buildSearchRefinement(draft), [stableSpecKey(draft)]);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  useEffect(() => {
    setDraft(original);
    setNewConcept("");
    setRequestedChange("");
    setSourceTypeChoice("");
    setSuggestionApplied(false);
  }, [stableSpecKey(original)]);

  const pendingConcept = newConcept.replace(/\s+/g, " ").trim();
  const submittedDraft = pendingConcept && !draft.concepts.some((concept) => concept.preferredTerm.toLowerCase() === pendingConcept.toLowerCase())
    ? { ...draft, concepts: [...draft.concepts, { id: `student-${draft.concepts.length + 1}`, preferredTerm: pendingConcept, synonyms: [], required: true }] }
    : draft;
  const changes = researchSpecDiff(original, submittedDraft);
  const contractLines = sourceContractLines(draft.sourceContract);

  function updateFacet(field, value) {
    setDraft((current) => ({
      ...current,
      facets: { ...current.facets, [field]: value },
    }));
  }

  function updateRequirement(field, value) {
    setDraft((current) => ({ ...current, sourceRequirements: { ...current.sourceRequirements, [field]: value } }));
  }

  function addConcept() {
    const preferredTerm = newConcept.replace(/\s+/g, " ").trim();
    if (!preferredTerm) return;
    setDraft((current) => {
      if (current.concepts.some((concept) => concept.preferredTerm.toLowerCase() === preferredTerm.toLowerCase())) {
        return current;
      }
      return {
        ...current,
        concepts: [
          ...current.concepts,
          { id: `student-${current.concepts.length + 1}`, preferredTerm, synonyms: [], required: true },
        ],
      };
    });
    setNewConcept("");
  }

  function rerun(event) {
    event.preventDefault();
    if (submittedDraft.sourceRequirements.publicationYearFrom && submittedDraft.sourceRequirements.publicationYearTo && submittedDraft.sourceRequirements.publicationYearFrom > submittedDraft.sourceRequirements.publicationYearTo) {
      setRequestedChange("Published from must be no later than Published through. Adjust the dates above.");
      return;
    }
    const prompt = buildInterpretationCorrectionPrompt(original, submittedDraft);
    if (!prompt || !onRerun) return;
    setDraft(submittedDraft);
    setNewConcept("");
    onRerun(prompt, { mode: submittedDraft.mode, researchSpec: submittedDraft, changes });
  }

  function refine(kind) {
    if (kind === "wrong-source-type") {
      setRequestedChange("Choose the corrected source type");
      setSourceTypeChoice("");
      return;
    }
    const guidance = {
      "too-broad": "Add one more specific concept, then rerun with corrections. Keep the concepts that still matter.",
      "too-narrow": "Remove an unnecessary concept or relax one date or population limit above, then rerun with corrections.",
      "wrong-discipline": "Enter the corrected discipline above, then rerun with corrections.",
    };
    setRequestedChange(guidance[kind] || "");
    const target = kind === "wrong-discipline" ? disciplineInputRef.current : kind === "too-broad" ? conceptInputRef.current : conceptGroupRef.current?.querySelector("button");
    target?.focus();
  }

  function applySourceTypeRefinement() {
    if (!sourceTypeChoice || !onRefine) return;
    const editedSpec = { ...draft, mode: sourceTypeChoice };
    const prompt = buildBoundedRefinementPrompt("wrong-source-type", {
      topic: draft.topic || fallbackTopic,
      mode: draft.mode || fallbackMode,
      targetMode: sourceTypeChoice,
    });
    setRequestedChange(`Source type to ${sourceTypeChoice}`);
    onRefine(prompt, { skipPlanner: true, modeOverride: sourceTypeChoice, researchSpec: editedSpec, changes: researchSpecDiff(original, editedSpec) });
  }

  return (
    <section className="research-interpretation" aria-labelledby={`research-interpretation-${panelId}`}>
      <div className="interpretation-head">
        <div>
          <h3 id={`research-interpretation-${panelId}`}>Your search brief</h3>
          <p>Check that these concepts describe your topic.</p>
        </div>
      </div>
      <div className="brief-summary" aria-label="How the navigator interpreted your request">
        <p className="brief-concepts">{original.concepts.map((concept) => concept.preferredTerm).join(" + ") || original.topic}</p>
        <ul className="brief-facets">
          <li>{getSearchMode(original.mode).label}</li>
          {original.sourceRequirements.publicationYearFrom && <li>Published from {original.sourceRequirements.publicationYearFrom}</li>}
          {original.sourceRequirements.publicationYearTo && <li>Through {original.sourceRequirements.publicationYearTo}</li>}
          {original.sourceRequirements.peerReviewed && <li>Peer review required</li>}
          {original.sourceRequirements.requestedSourceCount && <li>Target: {original.sourceRequirements.requestedSourceCount} sources</li>}
          {original.facets.timePeriod && <li>Topic period: {original.facets.timePeriod}</li>}
          {original.facets.method && <li>Method: {original.facets.method}</li>}
          {original.facets.population && <li>Population: {original.facets.population}</li>}
        </ul>
      </div>
      {original.searchIntent?.scopeNotes?.length > 0 && <p className="source-evidence-limit">{original.searchIntent.scopeNotes.join(" ")}</p>}
      <details className="interpretation-editor" open={editorOpen} onToggle={(event) => setEditorOpen(event.currentTarget.open)}>
        <summary>Edit or refine this search</summary>
        <p>Edit the brief, then rerun to request new search terms, database routes, and source leads. A concept typed below is included when you rerun.</p>
        {recoveryEditor && <div className="interpretation-change-summary">
          <p role="status" aria-live="polite">{suggestionApplied ? "Suggested terms are in the brief. Review the changes, then choose Rerun with corrections." : "Search editor opened. Review a wording change below or edit the brief. Nothing has been submitted."}</p>
          {refinementSuggestion && !suggestionApplied ? <>
            <strong>Suggested wording change</strong>
            <p>{refinementSuggestion.explanation}</p>
            <div className="source-proposed-query"><code>{refinementSuggestion.query}</code></div>
            <button className="refinement-use-suggestion" type="button" disabled={isRefreshing} onClick={() => { setDraft(normalizeResearchSpec(refinementSuggestion.researchSpec)); setNewConcept(""); setSuggestionApplied(true); topicInputRef.current?.focus(); }}>Use suggested terms</button>
          </> : !refinementSuggestion && <p><strong>No safe automatic wording change is available.</strong> Edit a concept below, or use a subject database. Exact phrases and assignment requirements stay in place until you change them.</p>}
        </div>}
      <form className="interpretation-form" onSubmit={rerun}>
        <label className="interpretation-wide">
          <span>Topic</span>
          <input
            ref={topicInputRef}
            type="text"
            value={draft.topic}
            onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))}
          />
        </label>

        <fieldset className="interpretation-wide concept-editor">
          <legend>Required concepts</legend>
          <div ref={conceptGroupRef} className="concept-chips" aria-label="Current required concepts">
            {draft.concepts.map((concept) => (
              <button
                key={concept.id || concept.preferredTerm}
                type="button"
                className="concept-chip"
                onClick={() => setDraft((current) => ({
                  ...current,
                  concepts: current.concepts.filter((item) => item !== concept),
                }))}
                aria-label={`Remove concept ${concept.preferredTerm}`}
              >
                {concept.preferredTerm}<span aria-hidden="true"> ×</span>
              </button>
            ))}
            {!draft.concepts.length && <span className="interpretation-empty">No concepts extracted</span>}
          </div>
          <div className="concept-add-row">
            <label className="sr-only" htmlFor={`concept-add-${panelId}`}>Add a required concept</label>
            <input
              ref={conceptInputRef}
              id={`concept-add-${panelId}`}
              type="text"
              value={newConcept}
              onChange={(event) => setNewConcept(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addConcept();
                }
              }}
              placeholder="Add a concept"
            />
            <button type="button" onClick={addConcept} disabled={!newConcept.trim()}>Add</button>
          </div>
        </fieldset>

        <label>
          <span>Population</span>
          <input
            type="text"
            value={draft.facets.population}
            onChange={(event) => updateFacet("population", event.target.value)}
            placeholder="e.g. first-year students"
          />
        </label>
        <label>
          <span>Historical period studied</span>
          <input
            type="text"
            value={draft.facets.timePeriod}
            onChange={(event) => updateFacet("timePeriod", event.target.value)}
            placeholder="e.g. the 1920s"
          />
        </label>
        <label>
          <span>Source type</span>
          <select
            value={draft.mode || fallbackMode}
            onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))}
          >
            {SEARCH_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
          </select>
        </label>
        <label>
          <span>Discipline</span>
          <input
            type="text"
            value={draft.disciplines.join(", ")}
            ref={disciplineInputRef}
            onChange={(event) => setDraft((current) => ({
              ...current,
              disciplines: normalizeTextList(event.target.value),
            }))}
            placeholder="e.g. psychology, communication"
          />
        </label>

        <fieldset className="interpretation-wide publication-requirements">
          <legend>Assignment requirements</legend>
          <label><span>Published from</span><input type="number" min="1000" max="2100" value={draft.sourceRequirements.publicationYearFrom ?? ""} onChange={(event) => updateRequirement("publicationYearFrom", event.target.value ? Number(event.target.value) : null)} /></label>
          <label><span>Published through</span><input type="number" min="1000" max="2100" value={draft.sourceRequirements.publicationYearTo ?? ""} onChange={(event) => updateRequirement("publicationYearTo", event.target.value ? Number(event.target.value) : null)} /></label>
          <label><span>Source target</span><input type="number" min="1" max="100" value={draft.sourceRequirements.requestedSourceCount ?? ""} onChange={(event) => updateRequirement("requestedSourceCount", event.target.value ? Number(event.target.value) : null)} /></label>
          <label className="peer-review-requirement"><input type="checkbox" checked={draft.sourceRequirements.peerReviewed === true} onChange={(event) => updateRequirement("peerReviewed", event.target.checked)} /><span>Peer review required</span></label>
        </fieldset>

        <details className="interpretation-advanced interpretation-wide">
          <summary>Additional search facets</summary>
          <div>
            <label>
              <span>Geography</span>
              <input type="text" value={draft.facets.geography} onChange={(event) => updateFacet("geography", event.target.value)} />
            </label>
            <label>
              <span>Method</span>
              <input type="text" value={draft.facets.method} onChange={(event) => updateFacet("method", event.target.value)} />
            </label>
            <label>
              <span>Document type</span>
              <input type="text" value={draft.facets.documentType} onChange={(event) => updateFacet("documentType", event.target.value)} />
            </label>
          </div>
        </details>

        {changes.length > 0 && (
          <div className="interpretation-change-summary interpretation-wide" role="status" aria-live="polite">
            <strong>Changes to apply</strong>
            <ul>
              {changes.map((change) => (
                <li key={change.field}><span>{change.label}</span> <del>{change.before}</del> <span aria-hidden="true">→</span> <ins>{change.after}</ins></li>
              ))}
            </ul>
          </div>
        )}

        <div className="interpretation-actions interpretation-wide">
          <button type="submit" disabled={!changes.length || !onRerun || isRefreshing}>{isRefreshing ? "Refreshing search…" : "Rerun with corrections"}</button>
          {changes.length > 0 && <button type="button" className="secondary" onClick={() => { setDraft(original); setNewConcept(""); setSuggestionApplied(false); }}>Discard edits</button>}
        </div>
      </form>
      {isRefreshing && <p className="refresh-pending" role="status" aria-live="polite">Refreshing the search with your corrected brief. The updated result will appear below.</p>}

      {isLatest && onRefine && (
        <div className="bounded-refinements no-print">
          <strong>What should change?</strong>
          <p>Choose a change, review the relevant field, then rerun. Your other requirements stay in the brief.</p>
          <div>
            {REFINEMENTS.map(([kind, label]) => (
              <button key={kind} type="button" onClick={() => refine(kind, label)}>{label}</button>
            ))}
          </div>
          {requestedChange === "Choose the corrected source type" && (
            <div className="refinement-source-choice">
              <label htmlFor={`refinement-source-${panelId}`}>Correct source type</label>
              <select
                id={`refinement-source-${panelId}`}
                value={sourceTypeChoice}
                onChange={(event) => setSourceTypeChoice(event.target.value)}
              >
                <option value="">Choose one</option>
                {SEARCH_MODES.filter((mode) => mode.id !== (draft.mode || fallbackMode)).map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
              <button type="button" disabled={!sourceTypeChoice} onClick={applySourceTypeRefinement}>Apply one source-type change</button>
            </div>
          )}
          {requestedChange && <p className="refinement-status" role="status">{requestedChange}</p>}
        </div>
      )}

      </details>
      {(draft.planHash || draft.configVersion || contractLines.length > 0) && (
        <details className="staff-search-details">
          <summary>Technical details for librarian review</summary>
          <strong>Source-mode contract</strong>
          <ul>{contractLines.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className="plan-trace">
            {releaseId && <span>Release {releaseId}</span>}
            {draft.planHash && <span>Plan {draft.planHash}</span>}
            {draft.configVersion && <span>Config {draft.configVersion}</span>}
          </p>
        </details>
      )}
    </section>
  );
}
