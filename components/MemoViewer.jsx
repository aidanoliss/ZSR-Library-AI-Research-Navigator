export default function MemoViewer({ memo }) {
  return (
    <article className="memo-viewer">
      <pre>{memo}</pre>
    </article>
  );
}
