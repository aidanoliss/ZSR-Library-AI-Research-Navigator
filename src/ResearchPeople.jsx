import { useId, useState } from "react";
import { recommendResearchPeople } from "../config/researchPeople.js";
import { WFU_INSTITUTION_PROFILE } from "../config/institutionProfile.js";
import "./researchPeople.css";

function checkedDate(value) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ResearchPeople({ researchSpec, institutionId = WFU_INSTITUTION_PROFILE.id }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const people = recommendResearchPeople(researchSpec, { institutionId });
  const librarian = people.librarian;
  const wake = people.institutionId === WFU_INSTITUTION_PROFILE.id;
  return <section className="research-people" aria-label="People who can help">
    <div className="research-people-heading">
      <div><h3>People who can help</h3><p>Get help with your search or explore related faculty expertise.</p></div>
      <button type="button" aria-expanded={open} aria-controls={`${id}-people`} onClick={() => setOpen(!open)}>{open ? "Hide people" : wake ? "Find someone at Wake" : "Find research help"}<span aria-hidden="true">{open ? "−" : "+"}</span></button>
    </div>
    {open && <div id={`${id}-people`} className="research-people-content">
      <div className="research-people-grid">
        <section className="research-person-group" aria-label="Librarian research support">
          <h4>Research librarian</h4><p className="research-person-purpose">For finding sources, choosing databases, and improving a search.</p>
          {librarian ? <article className="research-person-card">
            <h5>{librarian.personName || librarian.name}</h5><p className="research-person-unit">{librarian.title}</p>
            <p>{librarian.reason}</p>
            <div className="research-person-links"><a href={librarian.profileUrl} target="_blank" rel="noopener noreferrer">ZSR profile<span aria-hidden="true"> ↗</span></a><a href={librarian.appointmentUrl} target="_blank" rel="noopener noreferrer">Research consultation<span aria-hidden="true"> ↗</span></a></div>
            <small>Directory checked {checkedDate(librarian.lastReviewedDate || librarian.lastCheckedDate)} · <a href={librarian.sourceUrl} target="_blank" rel="noopener noreferrer">Subject coverage</a></small>
          </article> : <div className="research-person-empty"><strong>Start with library research help</strong><p>A named subject match isn’t confirmed in this pilot directory.</p>{people.fallback?.href && <a href={people.fallback.href} target="_blank" rel="noopener noreferrer">{people.fallback.label}</a>}</div>}
        </section>
        <section className="research-person-group" aria-label="Faculty with related expertise">
          <h4>Faculty with related expertise <span>Pilot</span></h4><p className="research-person-purpose">For exploring research interests and possible academic connections.</p>
          {people.faculty.length ? people.faculty.map(person => <article className="research-person-card" key={person.id}>
            <h5>{person.name}</h5><p className="research-person-unit">{person.department}</p>
            <p><strong>Why this match:</strong> {person.reason || person.evidenceSummary}</p>
            <div className="research-person-links"><a href={person.profileUrl} target="_blank" rel="noopener noreferrer">Faculty profile<span aria-hidden="true"> ↗</span></a>{person.sourceUrl !== person.profileUrl && <a href={person.sourceUrl} target="_blank" rel="noopener noreferrer">Research interests<span aria-hidden="true"> ↗</span></a>}</div>
            <small>Profile checked {checkedDate(person.lastCheckedDate)}</small>
          </article>) : <div className="research-person-empty"><strong>No verified faculty match yet</strong><p>This small pilot covers selected research interests. A missing match doesn’t mean there isn’t someone at {wake ? "Wake" : "your institution"} studying your topic.</p>{wake && <a href="https://www.wfu.edu/faculty-staff/" target="_blank" rel="noopener noreferrer">Browse Wake faculty directories<span aria-hidden="true"> ↗</span></a>}</div>}
        </section>
      </div>
      <p className="research-people-note">Matches use public subject assignments and research profiles. Faculty availability has not been confirmed. Review a profile before contacting someone.</p>
    </div>}
  </section>;
}
