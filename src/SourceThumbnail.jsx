import { useState } from "react";
import { sourceImageCandidates } from "./sourcePresentation.js";

/**
 * A cover appears only after it has actually loaded. Records without an image
 * (most articles) show nothing, rather than a repeated placeholder icon, and a
 * failed cover never leaves an empty box behind.
 */
export default function SourceThumbnail({ source }) {
  const candidates = sourceImageCandidates(source);
  const [failedUrls, setFailedUrls] = useState([]);
  const [loadedUrl, setLoadedUrl] = useState("");
  const image = candidates.find((candidate) => !failedUrls.includes(candidate.url));
  const failed = (url) => setFailedUrls((urls) => urls.includes(url) ? urls : [...urls, url]);
  if (!image) return null;
  return <figure className={`source-thumbnail ${loadedUrl === image.url ? "is-loaded" : "is-loading"}`} title={image.description}>
    <img key={image.url} src={image.url} alt="" width="80" height="108" decoding="async" referrerPolicy="no-referrer" onError={() => failed(image.url)} onLoad={(event) => { if (event.currentTarget.naturalWidth < 8 || event.currentTarget.naturalHeight < 8) failed(image.url); else setLoadedUrl(image.url); }} />
  </figure>;
}
