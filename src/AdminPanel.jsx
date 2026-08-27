import { useMemo, useState } from "react";

function StatusPill({ ok, children }) {
  return <span className={`status-pill ${ok ? "ok" : "pending"}`}>{children}</span>;
}

function safeCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function IntegrationList({ integrations = {} }) {
  const rows = [
    ["Gemini", integrations.gemini?.configured, integrations.gemini?.configured ? integrations.gemini.model : "Not configured"],
    ["Public Primo lookup", integrations.primoPublicLookup?.configured, integrations.primoPublicLookup?.note],
    ["Official Primo API", integrations.primoApi?.configured, integrations.primoApi?.configured ? "Approved endpoint configured" : "Not integrated"],
    ["LibKey library ID", integrations.libkey?.libraryIdConfigured, integrations.libkey?.note],
    ["OpenAlex OA lane", integrations.openAlex?.enabled, integrations.openAlex?.enabled ? "Server-side provider configured" : `Not ready: ${integrations.openAlex?.reason || "status unavailable"}`],
  ];

  return (
    <div className="admin-list">
      {rows.map(([label, ok, detail]) => (
        <div key={label} className="admin-list-row">
          <strong>{label}</strong>
          <StatusPill ok={Boolean(ok)}>{ok ? "Ready" : "Review"}</StatusPill>
          <span>{detail || "No status supplied"}</span>
        </div>
      ))}
    </div>
  );
}

function displayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value || "Not specified");
}

function ResearchSpecReview({ packet }) {
  if (!packet?.researchSpec) {
    return <p className="admin-muted">No interpreted plan is available in this browser session.</p>;
  }
  const spec = packet.researchSpec;
  const facets = spec.facets || {};
  const concepts = (spec.concepts || []).map((concept) => concept?.preferredTerm || concept?.term || concept).filter(Boolean);
  const rows = [
    ["Topic", spec.topic],
    ["Mode", spec.modeId || spec.mode || spec.sourceMode],
    ["Disciplines", spec.disciplines],
    ["Concepts", concepts],
    ["Population", facets.population],
    ["Geography", facets.geography],
    ["Date range", facets.timePeriod],
    ["Method", facets.method],
    ["Document type", facets.documentType],
    ["Plan hash", spec.planHash || spec.plan_hash],
    ["Configuration", spec.configVersion || spec.config_version],
  ].filter(([, value]) => Array.isArray(value) ? value.length : value != null && value !== "");

  return (
    <dl className="qa-spec-grid">
      {rows.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>
      ))}
    </dl>
  );
}

function PlanTraceReview({ plan }) {
  if (!plan) return <p className="admin-muted">The response did not include a plan trace.</p>;
  const trace = {
    planHash: plan.planHash,
    configVersion: plan.configVersion,
    modeId: plan.modeId,
    sourceMode: plan.sourceMode,
    safety: plan.safety,
    safeFailure: plan.safeFailure,
    validation: plan.validation,
    routes: (plan.recommendations || []).map((resource) => ({
      id: resource.id,
      query: resource.searchTerms?.[0] || "",
      filters: resource.filters || [],
      queryValidation: resource.queryValidation || null,
    })),
  };
  return (
    <details className="admin-details qa-plan-trace">
      <summary>Exact plan validation and failure contract</summary>
      <pre>{JSON.stringify(trace, null, 2)}</pre>
    </details>
  );
}

function ProvenanceReview({ resources = [] }) {
  if (!resources.length) return <p className="admin-muted">No routed resources are attached to this local plan.</p>;
  return (
    <div className="qa-provenance-list">
      {resources.map((resource, index) => (
        <details key={resource.id || resource.url || `${resource.name}-${index}`}>
          <summary>
            <strong>{resource.name || resource.resource_name || resource.id || "Resource"}</strong>
            <span>{displayValue(resource.sourceKinds || resource.type)}</span>
          </summary>
          <dl>
            {(() => {
              const provenance = resource.provenance || {};
              return <>
            <div><dt>Why it fits</dt><dd>{displayValue(resource.whyFits || resource.bestFor)}</dd></div>
            <div><dt>Not best for</dt><dd>{displayValue(resource.notBestFor)}</dd></div>
            <div><dt>Query dialect</dt><dd>{displayValue(provenance.queryDialect || resource.queryDialect)}</dd></div>
            <div><dt>Matched mode</dt><dd>{displayValue(provenance.matchedSourceMode)}</dd></div>
            <div><dt>Maintenance owner</dt><dd>{displayValue(provenance.maintenanceOwner || resource.maintenanceOwner)}</dd></div>
            <div><dt>Review status</dt><dd>{displayValue(provenance.reviewStatus || resource.reviewStatus)}</dd></div>
            <div><dt>Last reviewed</dt><dd>{displayValue(provenance.librarianReviewedOn || provenance.configReviewedOn || resource.librarianReviewedOn || resource.configReviewedOn)}</dd></div>
              </>;
            })()}
          </dl>
        </details>
      ))}
    </div>
  );
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPanel({ onClose, reviewPackets = [], releaseId = "" }) {
  const [accessCode, setAccessCode] = useState("");
  const [summary, setSummary] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPacketId, setSelectedPacketId] = useState(() => reviewPackets.at(-1)?.id || "");

  const selectedPacket = useMemo(
    () => reviewPackets.find((packet) => packet.id === selectedPacketId) || reviewPackets.at(-1) || null,
    [reviewPackets, selectedPacketId]
  );

  async function authorize(event) {
    event.preventDefault();
    const token = accessCode.trim();
    if (!token || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/summary", {
        method: "GET",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) {
          throw new Error("Librarian QA access was not authorized. Check the session access code.");
        }
        throw new Error("The librarian QA service is temporarily unavailable.");
      }
      const data = await response.json();
      setSummary(data);
      setAuthorized(true);
      setAccessCode("");
    } catch (err) {
      setAuthorized(false);
      setSummary(null);
      setError(err.message || "Could not authorize librarian QA access.");
    } finally {
      setLoading(false);
    }
  }

  function lockPanel() {
    setAuthorized(false);
    setSummary(null);
    setAccessCode("");
    setError("");
  }

  if (!authorized || !summary) {
    return (
      <section className="admin-panel admin-gate" aria-labelledby="admin-access-title">
        <div className="admin-head">
          <div>
            <span>Restricted librarian QA</span>
            <h2 id="admin-access-title">Review access required</h2>
            <p>The review dashboard is not public. Enter the server-issued access code to request an authorized summary.</p>
          </div>
          <button type="button" onClick={onClose}>Back to navigator</button>
        </div>
        <form className="admin-access-form" onSubmit={authorize}>
          <label htmlFor="admin-access-code">Session access code</label>
          <div>
            <input
              id="admin-access-code"
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              autoComplete="off"
              spellCheck="false"
              aria-describedby="admin-access-note"
            />
            <button type="submit" disabled={!accessCode.trim() || loading}>{loading ? "Checking…" : "Open QA dashboard"}</button>
          </div>
          <p id="admin-access-note">The code is held in memory for this authorization request and is never saved in browser storage or included in exports.</p>
        </form>
        {error && <p className="error-note" role="alert">{error}</p>}
      </section>
    );
  }

  const resources = summary.resources || {};
  const privacy = summary.privacy || {};
  const feedback = summary.feedback || {};
  const handoffs = summary.handoffs || {};
  const currentRelease = releaseId || summary.releaseId || summary.release_id || "Not supplied";

  function exportReviewPacket() {
    if (!selectedPacket) return;
    downloadJson(`zsr-librarian-review-${selectedPacket.researchSpec?.planHash || "plan"}.json`, {
      exportedAt: new Date().toISOString(),
      releaseId: selectedPacket.releaseId || currentRelease,
      researchSpec: selectedPacket.researchSpec,
      researchPlan: selectedPacket.researchPlan ? {
        planHash: selectedPacket.researchPlan.planHash,
        configVersion: selectedPacket.researchPlan.configVersion,
        modeId: selectedPacket.researchPlan.modeId,
        sourceMode: selectedPacket.researchPlan.sourceMode,
        safety: selectedPacket.researchPlan.safety,
        safeFailure: selectedPacket.researchPlan.safeFailure,
        validation: selectedPacket.researchPlan.validation,
      } : null,
      matchedResources: selectedPacket.matchedResources,
      generatedOrientation: selectedPacket.reply?.message || "",
      reviewInstructions: [
        "Check whether the interpreted concepts and facets preserve the student's request.",
        "Check whether the top routes support the selected source type and discipline.",
        "Check query syntax, access caveats, maintenance ownership, and review dates.",
      ],
    });
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-title">
      <div className="admin-head">
        <div>
          <span>Authorized librarian QA</span>
          <h2 id="admin-title">Search-plan review dashboard</h2>
          <p>Inspect local plan evidence and aggregated service readiness. This dashboard does not edit resource configuration.</p>
        </div>
        <div className="admin-head-actions">
          <span className="release-chip">Release {currentRelease}</span>
          <button type="button" onClick={lockPanel}>Lock dashboard</button>
          <button type="button" onClick={onClose}>Back to navigator</button>
        </div>
      </div>

      <div className="admin-metrics" aria-label="Pilot metrics">
        <div>
          <span>Curated resources</span>
          <strong>{safeCount(resources.count)}</strong>
          <p>{safeCount(resources.searchableTools)} searchable tools.</p>
        </div>
        <div>
          <span>Query logging</span>
          <strong>{privacy.queryLoggingEnabled ? "On" : "Off"}</strong>
          <p>Raw research topics should remain off by default.</p>
        </div>
        <div>
          <span>Aggregated feedback</span>
          <strong>{safeCount(feedback.total ?? feedback.recent?.length)}</strong>
          <p>{safeCount(feedback.counts?.gap)} missing-resource reports.</p>
        </div>
        <div>
          <span>Recent handoffs</span>
          <strong>{safeCount(handoffs.totalRecent)}</strong>
          <p>Contact retention is {privacy.handoffContactStorageEnabled ? "enabled" : "disabled"}.</p>
        </div>
      </div>

      <div className="admin-grid">
        <section>
          <h3>Integration readiness</h3>
          <IntegrationList integrations={summary.integrations} />
        </section>
        <section>
          <h3>Resource coverage</h3>
          <div className="admin-type-grid">
            {Object.entries(resources.byType || {}).map(([type, count]) => (
              <span key={type}><strong>{count}</strong> {type.replace(/_/g, " ")}</span>
            ))}
          </div>
          {resources.missing?.length ? (
            <details className="admin-details">
              <summary>Review incomplete records</summary>
              <ul>{resources.missing.map((item) => <li key={item.id}>{item.id}: {(item.missingFields || []).join(", ")}</li>)}</ul>
            </details>
          ) : <p className="admin-muted">No incomplete resource records were reported.</p>}
        </section>
      </div>

      <section className="admin-wide qa-review-workbench" aria-labelledby="qa-workbench-title">
        <div className="qa-workbench-head">
          <div>
            <h3 id="qa-workbench-title">Local plan inspection</h3>
            <p>Plans shown here come only from this browser session. Opening the dashboard does not fetch stored research topics.</p>
          </div>
          <div>
            <label htmlFor="qa-plan-select">Plan to inspect</label>
            <select id="qa-plan-select" value={selectedPacket?.id || ""} onChange={(event) => setSelectedPacketId(event.target.value)} disabled={!reviewPackets.length}>
              {!reviewPackets.length && <option value="">No local plans</option>}
              {reviewPackets.map((packet, index) => (
                <option key={packet.id} value={packet.id}>Plan {index + 1} · {packet.researchSpec?.planHash || packet.releaseId || "unversioned"}</option>
              ))}
            </select>
            <button type="button" onClick={exportReviewPacket} disabled={!selectedPacket}>Export review packet</button>
          </div>
        </div>

        <div className="qa-review-grid">
          <section>
            <h4>Interpreted research specification</h4>
            <ResearchSpecReview packet={selectedPacket} />
            <PlanTraceReview plan={selectedPacket?.researchPlan} />
            {selectedPacket?.researchSpec?.sourceContract && (
              <details className="admin-details">
                <summary>Exact source-mode contract</summary>
                <pre>{JSON.stringify(selectedPacket.researchSpec.sourceContract, null, 2)}</pre>
              </details>
            )}
          </section>
          <section>
            <h4>Recommendation provenance</h4>
            <ProvenanceReview resources={selectedPacket?.matchedResources || []} />
          </section>
        </div>
      </section>
    </section>
  );
}
