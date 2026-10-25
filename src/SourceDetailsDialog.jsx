import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './sourceDetailsDialog.css';

const sections = [['details','Details'],['reading','Read & note'],['explore','Related sources'],['feedback','Feedback']];
export default function SourceDetailsDialog({ id, title, metadata, children }) {
  const dialog = useRef(null);
  const heading = useId();
  const [section, setSection] = useState('details');
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => { node.close(); document.body.style.overflow = previousOverflow; trigger.current?.focus({preventScroll:true}); };
  }, [open]);
  return <><button type="button" ref={trigger} className="source-action-button source-more-toggle" aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => {setSection('details');setOpen(true);}}>Source tools <span aria-hidden="true">↗</span></button>
    {open && createPortal(<dialog ref={dialog} id={id} className="source-tools-dialog source-results-workspace" aria-labelledby={heading} onCancel={event => {event.preventDefault();close();}}>
      <header><div><span className="source-tools-eyebrow">Source tools</span><h2 id={heading}>{title || 'Untitled source'}</h2>{metadata && <p>{metadata}</p>}</div><button type="button" className="source-tools-close" onClick={close} aria-label="Close source tools" autoFocus>×</button></header>
      <nav aria-label="Source tools sections">{sections.map(([key,label]) => <button type="button" key={key} aria-pressed={section === key} aria-controls={`${id}-${key}`} onClick={() => setSection(key)}>{label}</button>)}</nav>
      <div className="source-tools-content">{sections.map(([key,label]) => <section className="source-tools-panel" hidden={section !== key} id={`${id}-${key}`} key={key} aria-label={label}><h3>{label}</h3>{children[key]}</section>)}</div>
      <footer>Check provider metadata and the original work. Automated fit checks and citation exports do not verify a claim.</footer>
    </dialog>, document.body)}</>;
}
