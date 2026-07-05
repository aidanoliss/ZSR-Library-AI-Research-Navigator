import { useState } from "react";

function summarizePayload(payload) {
  const parts = [
    payload.topic,
    payload.subjectFocus ? `Subject: ${payload.subjectFocus}` : "",
    `${payload.searchTerms?.length || 0} search terms`,
    `${payload.liveResults?.length || 0} catalog leads`,
    `${payload.matchedResources?.length || 0} ZSR paths`,
    `${payload.librarianRoutes?.length || 0} support routes`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export default function HandoffModal({ open, onClose, payload }) {
  const [note, setNote] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(null);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setPrepared(null);

    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, note, contact }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not prepare the handoff.");
      setPrepared(data);
      setStatus("ready");
      window.location.href = data.mailto;
    } catch (err) {
      setStatus("error");
      setError(err.message || "Could not prepare the handoff.");
    }
  }

  async function copyBody() {
    if (!prepared?.body) return;
    await navigator.clipboard?.writeText(prepared.body).catch(() => {});
    setStatus("copied");
  }

  function addRouteToNote(route) {
    const line = `Recommended route: ${route.label}${route.unit ? ` (${route.unit})` : ""} — ${route.reason}`;
    setNote((current) => current.includes(route.label) ? current : [current.trim(), line].filter(Boolean).join("\n"));
  }

  const routes = (payload.librarianRoutes || []).filter((route) => route?.label).slice(0, 3);

  return (
    <div className="modal-backdrop no-print" role="presentation">
      <section className="handoff-modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title">
        <div className="handoff-head">
          <div>
            <span>Librarian Handoff</span>
            <h2 id="handoff-title">Prepare Ask ZSR request</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close handoff">Close</button>
        </div>

        <p className="handoff-summary">{summarizePayload(payload)}</p>
        <p className="handoff-privacy">
          This creates a review package and opens your email client. Contact details are not retained by the app unless the server explicitly enables contact storage.
        </p>

        {routes.length > 0 && (
          <section className="handoff-routes" aria-label="Recommended ZSR support routes">
            <h3>Recommended ZSR routes</h3>
            <div>
              {routes.map((route) => (
                <article key={route.id || route.label}>
                  <span>{route.unit || "Research support"}</span>
                  <strong>{route.label}</strong>
                  <p>{route.reason}</p>
                  <div className="handoff-route-actions">
                    {route.href && <a href={route.href} target="_blank" rel="noopener noreferrer">Open route</a>}
                    <button type="button" onClick={() => addRouteToNote(route)}>Add to request</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <form className="handoff-form" onSubmit={submit}>
          <label>
            What do you want the librarian to help with?
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. I need peer-reviewed sources from psychology and communication databases."
              rows={3}
              maxLength={1000}
            />
          </label>
          <label>
            Contact info to include in the email body
            <input
              type="text"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Your Wake Forest email or preferred contact"
              maxLength={300}
            />
          </label>
          {error && <p className="error-note" role="alert">{error}</p>}
          <div className="handoff-actions">
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Preparing..." : "Open email draft"}
            </button>
            {prepared && (
              <>
                <a href={prepared.mailto}>Open again</a>
                <button type="button" onClick={copyBody}>
                  {status === "copied" ? "Copied" : "Copy email body"}
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
