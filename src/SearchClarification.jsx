import { useEffect, useRef, useState } from 'react';
import { completeSearchClarification, scopePriorityRows } from './searchClarification.js';
import './researchEnhancements.css';

export function ScopePriorityControls({ spec, priorities, onChange }) {
  const rows = scopePriorityRows(spec);
  if (!rows.length) return null;
  return <fieldset className="scope-priorities"><legend>Required or preferred?</legend><p>Required criteria remain filters. Preferred criteria are checked when metadata allows, but do not exclude other results. Only relax limits your assignment allows.</p>{rows.map(({ key, label, value, priority }) => <label key={key}><span><strong>{label}</strong><small>{value}</small></span><select aria-label={`${label} priority`} value={priorities[key] || priority} onChange={(event) => onChange({ ...priorities, [key]: event.target.value })}><option value="required">Required</option><option value="preferred">Preferred</option></select></label>)}</fieldset>;
}

export default function SearchClarification({ draft, onSearch, onCancel }) {
  const dialog = useRef(null);
  const [choice, setChoice] = useState('');
  const [priorities, setPriorities] = useState({});
  const [error, setError] = useState('');
  useEffect(() => { const previous = document.activeElement; dialog.current?.showModal(); return () => previous?.focus?.(); }, []);
  function finish(skip = false) {
    const { topic, spec } = completeSearchClarification(draft, choice, priorities, skip);
    if (topic.length > 2000) { setError('This clarification would exceed the 2,000-character limit. Close this step and shorten the topic, or skip the clarification.'); return; }
    onSearch(topic, spec);
  }
  return <dialog ref={dialog} className="search-clarification" onCancel={(event) => { event.preventDefault(); onCancel(); }} aria-labelledby="clarification-title"><form onSubmit={(event) => { event.preventDefault(); finish(); }}>
    <div className="clarification-heading"><span>One quick clarification · optional</span><button type="button" aria-label="Close clarification" onClick={onCancel}>×</button></div>
    <h2 id="clarification-title">{draft.question.question}</h2><p>Your original topic stays in the search. Choose a focus, or search as written.</p>
    <fieldset className="clarification-choices"><legend className="sr-only">Choose a focus</legend>{draft.question.choices.map((item) => <label key={item.label}><input type="radio" name="clarification" value={item.label} checked={choice === item.label} onChange={() => setChoice(item.label)} />{item.label}</label>)}</fieldset>
    {/* Only offer the criteria step when the search has a population, place or method to prioritize. */}
    {scopePriorityRows(draft.spec).length > 0 && <details className="clarification-criteria"><summary>Required or preferred criteria</summary><ScopePriorityControls spec={draft.spec} priorities={priorities} onChange={setPriorities} /></details>}
    {error && <p role="alert">{error}</p>}<div className="clarification-actions"><button type="submit">Search with these choices</button><button type="button" onClick={() => finish(true)}>Skip · search as written</button></div>
  </form></dialog>;
}
