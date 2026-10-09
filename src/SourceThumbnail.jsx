import { useState } from "react";
import { sourceImageCandidates } from "./sourcePresentation.js";

export default function SourceThumbnail({ source }) {
  const candidates = sourceImageCandidates(source);
  const [failedUrls, setFailedUrls] = useState([]);
  const image = candidates.find((candidate) => !failedUrls.includes(candidate.url));
  const failed = (url) => setFailedUrls((urls) => urls.includes(url) ? urls : [...urls, url]);
  if (!image) return <div className="source-thumbnail-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg></div>;
  return <figure className="source-thumbnail" title={image.description}>
    <img key={image.url} src={image.url} alt="" width="80" height="108" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => failed(image.url)} onLoad={(event) => { if (event.currentTarget.naturalWidth < 8 || event.currentTarget.naturalHeight < 8) failed(image.url); }} />
    <figcaption>{image.label}</figcaption>
  </figure>;
}
