import { dedupeSourceLeads, normalizeSourceLead, safeRisFilename } from './ris.js';

// Metadata export only: never fill missing bibliographic fields from AI.
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
const escapes = { '\\': '{\\textbackslash{}}', '{': '\\{', '}': '\\}', '%': '\\%', '&': '\\&', '#': '\\#', '_': '\\_', '$': '\\$', '^': '{\\textasciicircum{}}', '~': '{\\textasciitilde{}}' };
export const escapeBibtexText = value => clean(value).replace(/[\\{}%&#_$^~]/g, char => escapes[char]);
const literal = value => clean(value).replace(/[\\{}\s]/g, char => encodeURIComponent(char));
const ascii = value => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '');
function hash(value) { let n = 2166136261; for (const char of value) { n ^= char.codePointAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
function authorList(lead, fallback) {
  const input = lead.authors ?? lead.author;
  if (!Array.isArray(input)) return (fallback || []).map(escapeBibtexText).join(' and ');
  return input.map((author) => author?.literal ? `{${escapeBibtexText(author.literal)}}` : escapeBibtexText(typeof author === 'object' ? (author.family || author.familyName || author.lastName ? [author.family || author.familyName || author.lastName, author.given || author.givenName || author.firstName].filter(Boolean).join(', ') : author.name || author.displayName || author.author || '') : author)).filter(Boolean).join(' and ');
}
export function serializeBibtex(leads = []) {
  const used = new Set();
  return dedupeSourceLeads(leads).map(lead => {
    const f = normalizeSourceLead(lead);
    const isConference = /\b(?:conference|proceedings)\b/i.test(`${lead.sourceKind || ''} ${lead.type || ''}`);
    const type = isConference ? 'inproceedings' : ({ JOUR: 'article', NEWS: 'article', BOOK: 'book', CHAP: 'incollection' }[f.TY] || 'misc');
    const year = /^\d{4}$/.test(clean(f.PY)) ? clean(f.PY) : clean(f.DA).match(/^(\d{4})(?:-\d{2}(?:-\d{2}(?:T.*)?)?)?$/)?.[1] || '';
    const fields = {};
    const text = (name, value) => { if (clean(value)) fields[name] = escapeBibtexText(value); };
    // Protect supplied title capitalization, including acronyms and proper names.
    if (f.TI) fields.title = `{${escapeBibtexText(f.TI)}}`;
    const authors = authorList(lead, f.AU); if (authors) fields.author = authors;
    text('year', year);
    const container = f.T2 || f.JO;
    if (container && type !== 'book') text(['incollection','inproceedings'].includes(type) ? 'booktitle' : 'journal', container);
    text('volume', f.VL); text('number', f.IS);
    if (f.SP) text('pages', f.EP ? `${f.SP}--${f.EP}` : f.SP);
    text('publisher', f.PB); text('edition', f.ET);
    if (f.DO) fields.doi = literal(f.DO);
    if (f.UR && /^https?:\/\//i.test(f.UR)) fields.url = literal(f.UR);
    if (lead.isbn) text('isbn', Array.isArray(lead.isbn) ? lead.isbn.join(', ') : lead.isbn);
    if (lead.issn) text('issn', Array.isArray(lead.issn) ? lead.issn.join(', ') : lead.issn);
    if (f.AN) text('pmid', f.AN);
    text('note', Array.isArray(f.N1) ? f.N1.join(' ') : f.N1);
    const base = `${ascii((f.AU || [])[0] || 'source').slice(0,22) || 'source'}${year}${ascii(f.TI).slice(0,24)}${hash(JSON.stringify([f.TI,authors,f.DO,f.UR,f.ET,f.SN,year]))}`;
    let key = base, suffix = 2; while (used.has(key)) key = `${base}${suffix++}`; used.add(key);
    return `@${type}{${key},\n${Object.entries(fields).map(([name,value]) => `  ${name} = {${value}}`).join(',\n')}\n}`;
  }).join('\n\n') + (dedupeSourceLeads(leads).length ? '\n' : '');
}
export const safeBibtexFilename = value => safeRisFilename(String(value || 'research-sources').replace(/\.bib$/i, '')).replace(/\.ris$/i, '.bib');
export function downloadBibtex(leads, {filename = 'research-sources'} = {}) {
  const content = serializeBibtex(leads);
  if (!content || typeof document === 'undefined' || !document.body || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([content], {type:'application/x-bibtex;charset=utf-8'}));
  const link = document.createElement('a');
  try { link.href=url;link.download=safeBibtexFilename(filename);link.hidden=true;document.body.appendChild(link);link.click();return true; }
  finally {link.remove();URL.revokeObjectURL(url);}
}
