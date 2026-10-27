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
  if (people.institutionId !== WFU_INSTITUTION_PROFILE.id) return null;
  return <section className="research-people" aria-label="Faculty for your topic">
    <div className="research-people-heading">
      <div><h3>Faculty for your topic</h3><p>Connect with Wake faculty whose research relates to your question.</p></div>
      <button type="button" aria-expanded={open} aria-controls={`${id}-people`} onClick={() => setOpen(!open)}>{open ? "Hide faculty" : people.faculty.length ? "View faculty (" + people.faculty.length + ")" : "Explore faculty"}<span aria-hidden="true">{open ? "−" : "+"}</span></button>
    </div>
    {open && <div id={`${id}-people`} className="research-people-content">
      {people.faculty.length ? <>
        <div className="research-faculty-grid">{people.faculty.map(person => <article className="research-faculty-card" key={person.id} aria-labelledby={`${id}-${person.id}`}>
          <div className="research-faculty-identity"><span>{person.department}</span><h4 id={`${id}-${person.id}`}>{person.name}</h4></div>
          <ul className="research-faculty-expertise" aria-label="Research expertise">{person.expertise.map(term => <li key={term}>{term}</li>)}</ul>
          {person.scopeNote && <p className="research-faculty-scope">{person.scopeNote}</p>}
          <div className="research-faculty-actions">
            {person.contact && <a className="faculty-contact-link" href={person.contact.href} aria-label={`Get in touch with ${person.name}`} title={person.contact.hint} {...(person.contact.kind === "profile" ? { target: "_blank", rel: "noopener noreferrer" } : {})}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg>Get in touch</a>}
            <a href={person.profileUrl} target="_blank" rel="noopener noreferrer">View profile<span aria-hidden="true"> ↗</span></a>
          </div>
          {person.contact?.kind === "profile" && <small className="research-faculty-contact-hint">Contact details are on the university profile.</small>}
        </article>)}</div>
        <div className="research-faculty-footer"><p>{people.faculty.every(person => person.contact?.kind === "email") ? "Get in touch opens an email draft. Nothing is sent automatically." : "Get in touch opens official contact details."}</p>
          <details><summary>About these matches</summary><p>Suggestions use selected official Wake profiles and may cover part of your question. Review a profile before contacting someone. Navigator does not send messages.</p><ul>{people.faculty.map(person => <li key={person.id}><a href={person.sourceUrl} target="_blank" rel="noopener noreferrer">{person.name}</a> · profile and contact checked {checkedDate(person.lastCheckedDate)}<p>{person.evidenceSummary}</p></li>)}</ul></details>
        </div>
      </> : <div className="research-faculty-empty"><strong>No faculty match confirmed for this topic.</strong><p>Explore Wake’s faculty directory for more research interests and contact details.</p><a href="https://www.wfu.edu/faculty-staff/" target="_blank" rel="noopener noreferrer">Browse faculty directories<span aria-hidden="true"> ↗</span></a></div>}
    </div>}
  </section>;
}
