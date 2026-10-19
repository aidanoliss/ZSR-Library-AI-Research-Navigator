import { useEffect, useState } from "react";
import { expandedSpec } from "./searchTermsExpansion.js";
import "./searchTermsAnswer.css";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" className="search-terms-copy" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }} aria-label={`Copy ${text}`}>{copied ? "Copied" : "Copy"}</button>;
}

function TermList({ label, terms }) {
  if (!terms?.length) return null;
  return <div className="search-terms-row"><span>{label}</span><ul>{terms.map((term) => <li key={term}>{term}</li>)}</ul></div>;
}

export default function SearchTermsAnswer({ researchSpec, onSearch, busy = false, isLatest = false }) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  useEffect(() => {
    if (!researchSpec) { setState({ status: "error", data: null, error: "Run a search first, then ask for more terms." }); return undefined; }
    const controller = new AbortController();
    fetch("/api/search-terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ researchSpec }), signal: controller.signal })
      .then(async (res) => { const json = await res.json().catch(() => ({})); if (!res.ok) throw new Error(json.error || "Search terms could not load."); return json; })
      .then((data) => setState({ status: "ready", data, error: "" }))
      .catch((error) => { if (!controller.signal.aborted) setState({ status: "error", data: null, error: error.message || "Search terms could not load." }); });
    return () => controller.abort();
  }, [JSON.stringify(researchSpec?.concepts || []), researchSpec?.topic]);

  if (state.status === "loading") return <section className="search-terms-answer" aria-busy="true"><h3>More search terms</h3><p className="search-terms-note" role="status">Finding alternative words for your topic…</p></section>;
  if (state.status === "error") return <section className="search-terms-answer"><h3>More search terms</h3><p role="alert">{state.error}</p></section>;
  const { data } = state;
  const hasTerms = data.concepts.some((group) => group.synonyms.length || group.broader.length || group.narrower.length) || data.related.length;
  return <section className="search-terms-answer" aria-label="More search terms">
    <h3>More search terms</h3>
    <p className="search-terms-note">{data.source === "ai-suggested" ? "AI-suggested alternatives for each idea in your search. Keep the ones that fit your question." : "Alternatives from the Navigator's vocabulary list."}</p>
    {!hasTerms && <p>No new alternatives were found for these terms. Try a subject database's thesaurus, or ask a librarian.</p>}
    <div className="search-terms-groups">
      {data.concepts.map((group) => (group.synonyms.length || group.broader.length || group.narrower.length) ? <div className="search-terms-group" key={group.conceptId || group.term}>
        <h4>{group.term.replace(/\*$/, "")}</h4>
        <TermList label="Also try" terms={group.synonyms} />
        <TermList label="Narrower" terms={group.narrower} />
        <TermList label="Broader" terms={group.broader} />
      </div> : null)}
    </div>
    {data.related.length > 0 && <TermList label="Related ideas to add" terms={data.related} />}
    {data.searchStrings.length > 0 && <div className="search-terms-strings">
      <h4>Search strings to paste into a database</h4>
      <ul>{data.searchStrings.map((item) => <li key={item.query}><div><strong>{item.label}</strong><span>{item.description}</span></div><code>{item.query}</code><CopyButton text={item.query} /></li>)}</ul>
    </div>}
    {isLatest && onSearch && hasTerms && <button type="button" className="search-terms-run" disabled={busy} onClick={() => onSearch(expandedSpec(researchSpec, data))}>Search with these terms</button>}
  </section>;
}
