import { useEffect, useMemo, useState } from "react";

function StatusPill({ ok, children }) {
  return <span className={`status-pill ${ok ? "ok" : "pending"}`}>{children}</span>;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function IntegrationList({ integrations = {} }) {
  const rows = [
    ["Gemini", integrations.gemini?.configured, integrations.gemini?.configured ? integrations.gemini.model : "API key missing"],
    ["Public Primo lookup", integrations.primoPublicLookup?.configured, integrations.primoPublicLookup?.note],
    ["Official Primo API", integrations.primoApi?.configured, integrations.primoApi?.configured ? "Endpoint and key configured" : "Awaiting approved endpoint/key"],
    ["LibKey library ID", integrations.libkey?.libraryIdConfigured, integrations.libkey?.note],
  ];

  return (
    <div className="admin-list">
      {rows.map(([label, ok, detail]) => (
        <div key={label} className="admin-list-row">
          <strong>{label}</strong>
          <StatusPill ok={ok}>{ok ? "Ready" : "Needs ZSR"}</StatusPill>
          <span>{detail}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPanel({ onClose }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/summary")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load admin summary.");
        return res.json();
      })
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load admin summary.");
      });
    return () => {
      active = false;
    };
  }, []);

  const gapFeedback = useMemo(
    () => (summary?.feedback?.recent || []).filter((item) => item.rating === "gap"),
    [summary]
  );

  if (error) {
    return (
      <section className="admin-panel">
        <div className="admin-head">
          <div>
            <span>Pilot Admin</span>
            <h2>Could not load status</h2>
          </div>
          <button type="button" onClick={onClose}>Back to navigator</button>
        </div>
        <p className="error-note" role="alert">{error}</p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="admin-panel">
        <div className="admin-head">
          <div>
            <span>Pilot Admin</span>
            <h2>Loading review dashboard</h2>
          </div>
          <button type="button" onClick={onClose}>Back to navigator</button>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-title">
      <div className="admin-head">
        <div>
          <span>Pilot Admin</span>
          <h2 id="admin-title">Librarian review dashboard</h2>
          <p>Read-only pilot controls for content quality, privacy posture, integration readiness, and student handoffs.</p>
        </div>
        <button type="button" onClick={onClose}>Back to navigator</button>
      </div>

      <div className="admin-metrics" aria-label="Pilot metrics">
        <div>
          <span>Curated resources</span>
          <strong>{summary.resources.count}</strong>
          <p>{summary.resources.searchableTools} searchable tools, {summary.resources.paywalled} with access notes.</p>
        </div>
        <div>
          <span>Query logging</span>
          <strong>{summary.privacy.queryLoggingEnabled ? "On" : "Off"}</strong>
          <p>Default is {summary.privacy.queryLoggingDefault}; turn on only after privacy review.</p>
        </div>
        <div>
          <span>Recent feedback</span>
          <strong>{summary.feedback.recent.length}</strong>
          <p>{summary.feedback.counts.gap || 0} missing-resource reports.</p>
        </div>
        <div>
          <span>Handoffs</span>
          <strong>{summary.handoffs.totalRecent}</strong>
          <p>Contact retention is {summary.privacy.handoffContactStorageEnabled ? "enabled" : "disabled"}.</p>
        </div>
      </div>

      <div className="admin-grid">
        <section>
          <h3>Integration Readiness</h3>
          <IntegrationList integrations={summary.integrations} />
        </section>

        <section>
          <h3>Resource Coverage</h3>
          <div className="admin-type-grid">
            {Object.entries(summary.resources.byType || {}).map(([type, count]) => (
              <span key={type}><strong>{count}</strong> {type.replace(/_/g, " ")}</span>
            ))}
          </div>
          {summary.resources.missing.length > 0 ? (
            <details className="admin-details">
              <summary>Review incomplete records</summary>
              <ul>
                {summary.resources.missing.map((item) => (
                  <li key={item.id}>{item.id}: {item.missingFields.join(", ")}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="admin-muted">All curated resources include the required pilot fields.</p>
          )}
        </section>

        <section>
          <h3>Feedback Gaps</h3>
          {gapFeedback.length ? (
            <ul className="admin-feed">
              {gapFeedback.slice(0, 8).map((item) => (
                <li key={`${item.ts}-${item.topic}`}>
                  <strong>{formatDate(item.ts)}</strong>
                  <span>{item.note || "Missing resource reported"}</span>
                  <em>{item.topic}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">No missing-resource feedback yet.</p>
          )}
        </section>

        <section>
          <h3>Query Demand</h3>
          {summary.querySummary.enabled ? (
            <ul className="admin-feed">
              {summary.querySummary.topTopics.map((item) => (
                <li key={item.value}>
                  <strong>{item.count}x</strong>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-muted">Anonymous query logging is off. Enable `LOG_QUERIES=on` only after ZSR approves retention and notice language.</p>
          )}
        </section>
      </div>

      <section className="admin-wide">
        <h3>Recent Handoffs</h3>
        {summary.handoffs.recent.length ? (
          <ul className="admin-feed handoff-feed">
            {summary.handoffs.recent.map((item) => (
              <li key={`${item.ts}-${item.topic}`}>
                <strong>{formatDate(item.ts)}</strong>
                <span>{item.topic}</span>
                <em>{item.note || "No student note"}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-muted">No librarian handoff packages yet.</p>
        )}
      </section>
    </section>
  );
}
