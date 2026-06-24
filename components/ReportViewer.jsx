export default function ReportViewer({ report, onExportMarkdown }) {
  return (
    <article className="report-viewer">
      <div className="report-head">
        <div>
          <h2>{report.title}</h2>
          <p>{report.period_start} to {report.period_end}</p>
        </div>
        <button className="primary-action" type="button" onClick={onExportMarkdown}>
          Export Markdown
        </button>
      </div>
      <section>
        <h3>Executive Overview</h3>
        <p>{report.content_json.executive_overview}</p>
      </section>
      <section>
        <h3>Best Startup by Domain</h3>
        <div className="report-list">
          {report.content_json.best_startup_by_domain.map((item) => (
            <div key={`${item.domain}-${item.company}`}>
              <strong>{item.domain}</strong>
              <span>{item.company} · {item.overall_score}/100 · {item.confidence_level} confidence</span>
              <p>{item.why_it_won}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Limitations</h3>
        <ul className="plain-list">
          {report.content_json.limitations.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </article>
  );
}
