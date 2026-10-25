import { useEffect, useRef, useState } from 'react';
import { downloadRis } from './ris.js';
import { downloadBibtex } from './bibtex.js';
import './citationExport.css';

export default function CitationExport({ sources = [], filename = 'research-sources', label = 'Cite', description = 'Download citation', onExport }) {
  const menu = useRef(null);
  const [notice, setNotice] = useState('');
  const [position, setPosition] = useState(null);
  const close = () => { if (menu.current) menu.current.open = false; };
  useEffect(() => {
    if (!position) return;
    const pointer = event => { if (!menu.current?.contains(event.target)) close(); };
    const keyboard = event => { if (event.key === 'Escape') { close(); menu.current?.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', pointer);document.addEventListener('keydown',keyboard);window.addEventListener('resize',close);
    return () => {document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',keyboard);window.removeEventListener('resize',close);};
  }, [position]);
  const locate = () => {
    if (!menu.current?.open) { setPosition(null); return; }
    const rect = menu.current.querySelector('summary').getBoundingClientRect();
    const width = Math.min(285, window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom;
    setPosition({position:'fixed',width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),...(below >= 245 ? {top:rect.bottom+6} : {bottom:Math.max(12,window.innerHeight-rect.top+6)}),maxHeight:'calc(100dvh - 24px)',overflowY:'auto'});
  };
  const download = format => {
    try {
      const success = (format === 'bibtex' ? downloadBibtex : downloadRis)(sources, {filename});
      setNotice(success ? `${format === 'bibtex' ? 'BibTeX' : 'RIS'} download started. Check the source metadata before citing.` : 'No citations could be downloaded.');
      if (success) onExport?.(sources, format);
    } catch { setNotice('Citation download failed. Try again.'); }
    if (menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); }
  };
  return <div className="citation-export"><details ref={menu} onToggle={locate}><summary aria-label={description}>{label}<span aria-hidden="true">⌄</span></summary><div className="citation-export-options" style={position || {visibility:"hidden"}}><strong>Download citations</strong><button type="button" onClick={() => download('ris')}>RIS <small>Zotero & citation managers · .ris</small></button><button type="button" onClick={() => download('bibtex')}>BibTeX <small>LaTeX & Overleaf · .bib</small></button><p>Exports supplied metadata. Missing fields and source warnings still need checking.</p></div></details>{notice && <span role="status" className="citation-export-status">{notice}</span>}</div>;
}
