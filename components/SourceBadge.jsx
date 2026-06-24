export default function SourceBadge({ name, url }) {
  return (
    <a className="source-badge" href={url} target="_blank" rel="noreferrer">
      <span aria-hidden="true" />
      {name || "Source"}
    </a>
  );
}
