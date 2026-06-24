/**
 * A static, reusable "how research works" diagram. It describes the *process*
 * (navigation), never claims anything about the student's topic — so it carries
 * no fabrication risk. Safe to show on every plan.
 */
const STEPS = [
  { t: "Define & narrow your topic", d: "Turn a broad idea into a focused question with key concepts." },
  { t: "Pick a starting point", d: "Choose a database or guide suited to your subject (see above)." },
  { t: "Search with keywords & Boolean", d: "Combine concepts with AND/OR; try synonyms and variations." },
  { t: "Evaluate what you find", d: "Check credibility, currency, and relevance before you rely on it." },
  { t: "Cite as you go", d: "Capture full citation details while reading; use Zotero / the ZSR guide." },
  { t: "Stuck? Ask a librarian", d: "A subject librarian can unblock a hard topic fast." },
];

export default function ResearchRoadmap() {
  return (
    <ol className="roadmap" aria-label="General research process">
      {STEPS.map((s, i) => (
        <li key={i} className="roadmap-step">
          <span className="roadmap-num" aria-hidden="true">{i + 1}</span>
          <div className="roadmap-body">
            <strong>{s.t}</strong>
            <p>{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
