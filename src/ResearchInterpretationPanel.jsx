import { useEffect, useMemo, useState } from "react";
import { SEARCH_MODES } from "../config/libraryLinks.js";
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
  onRerun,
  onRefine,
}) {
  const original = useMemo(
    () => normalizeResearchSpec(researchSpec, { topic: fallbackTopic, mode: fallbackMode }),
    [stableSpecKey(researchSpec), fallbackTopic, fallbackMode]
  );
  const [draft, setDraft] = useState(original);
  const [newConcept, setNewConcept] = useState("");
  const [requestedChange, setRequestedChange] = useState("");
  const [sourceTypeChoice, setSourceTypeChoice] = useState("");

  useEffect(() => {
    setDraft(original);
    setNewConcept("");
    setRequestedChange("");
    setSourceTypeChoice("");
  }, [stableSpecKey(original)]);

  const changes = researchSpecDiff(original, draft);
  const contractLines = sourceContractLines(draft.sourceContract);

  function updateFacet(field, value) {
    setDraft((current) => ({
      ...current,
      facets: { ...current.facets, [field]: value },
    }));
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
    const prompt = buildInterpretationCorrectionPrompt(original, draft);
    if (!prompt || !onRerun) return;
    onRerun(prompt, { mode: draft.mode, researchSpec: draft, changes });
  }

  function refine(kind, label) {
    if (kind === "wrong-source-type") {
      setRequestedChange("Choose the corrected source type");
      setSourceTypeChoice("");
      return;
    }
    const prompt = buildBoundedRefinementPrompt(kind, {
      topic: draft.topic || fallbackTopic,
      mode: draft.mode || fallbackMode,
    });
    if (!prompt || !onRefine) return;
    setRequestedChange(label);
    onRefine(prompt, { skipPlanner: true, modeOverride: draft.mode || fallbackMode });
  }

  function applySourceTypeRefinement() {
    if (!sourceTypeChoice || !onRefine) return;
    const prompt = buildBoundedRefinementPrompt("wrong-source-type", {
      topic: draft.topic || fallbackTopic,
      mode: draft.mode || fallbackMode,
      targetMode: sourceTypeChoice,
    });
    setRequestedChange(`Source type to ${sourceTypeChoice}`);
    onRefine(prompt, { skipPlanner: true, modeOverride: sourceTypeChoice });
  }

  return (
    <section className="research-interpretation" aria-labelledby={`research-interpretation-${draft.planHash || "current"}`}>
      <div className="interpretation-head">
        <div>
          <span>Editable search brief</span>
          <h3 id={`research-interpretation-${draft.planHash || "current"}`}>How the navigator interpreted your request</h3>
          <p>Correct the search inputs below. These edits stay in this browser until you rerun the search.</p>
        </div>
        {(releaseId || draft.configVersion) && (
          <span className="release-chip">
            {releaseId ? `Release ${releaseId}` : `Config ${draft.configVersion}`}
          </span>
        )}
      </div>

      <form className="interpretation-form" onSubmit={rerun}>
        <label className="interpretation-wide">
          <span>Topic</span>
          <input
            type="text"
            value={draft.topic}
            onChange={(event) => setDraft((current) => ({ ...current, topic: event.target.value }))}
          />
        </label>

        <fieldset className="interpretation-wide concept-editor">
          <legend>Required concepts</legend>
          <div className="concept-chips" aria-label="Current required concepts">
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
            <label className="sr-only" htmlFor={`concept-add-${draft.planHash || "current"}`}>Add a required concept</label>
            <input
              id={`concept-add-${draft.planHash || "current"}`}
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
          <span>Date range</span>
          <input
            type="text"
            value={draft.facets.timePeriod}
            onChange={(event) => updateFacet("timePeriod", event.target.value)}
            placeholder="e.g. 2019–2026"
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
            onChange={(event) => setDraft((current) => ({
              ...current,
              disciplines: normalizeTextList(event.target.value),
            }))}
            placeholder="e.g. psychology, communication"
          />
        </label>

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
          <button type="submit" disabled={!changes.length || !onRerun}>Rerun with corrections</button>
          {changes.length > 0 && <button type="button" className="secondary" onClick={() => setDraft(original)}>Discard edits</button>}
        </div>
      </form>

      {contractLines.length > 0 && (
        <details className="source-contract-disclosure">
          <summary>Source-mode contract</summary>
          <ul>{contractLines.map((line) => <li key={line}>{line}</li>)}</ul>
        </details>
      )}

      {isLatest && onRefine && (
        <div className="bounded-refinements no-print">
          <strong>What should change?</strong>
          <p>Each option changes one search dimension and keeps the rest of the brief fixed.</p>
          <div>
            {REFINEMENTS.map(([kind, label]) => (
              <button key={kind} type="button" onClick={() => refine(kind, label)}>{label}</button>
            ))}
          </div>
          {requestedChange === "Choose the corrected source type" && (
            <div className="refinement-source-choice">
              <label htmlFor={`refinement-source-${draft.planHash || "current"}`}>Correct source type</label>
              <select
                id={`refinement-source-${draft.planHash || "current"}`}
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
          {requestedChange && <p className="refinement-status" role="status">Requested one change: {requestedChange}.</p>}
        </div>
      )}

      {(draft.planHash || draft.configVersion) && (
        <p className="plan-trace">
          {draft.planHash && <span>Plan {draft.planHash}</span>}
          {draft.configVersion && <span>Config {draft.configVersion}</span>}
        </p>
      )}
    </section>
  );
}
