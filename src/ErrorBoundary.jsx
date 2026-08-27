import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, details) {
    console.error("[ui:render] The navigator could not render this view.", error, details);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const showLocalDetail = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    return (
      <main className="fatal-error" role="alert">
        <h1>The navigator could not display this response</h1>
        <p>Your saved research sessions remain in this browser. Reload the page or start a new topic, then try again.</p>
        {showLocalDetail && <pre>{String(error?.stack || error?.message || error)}</pre>}
        <button type="button" onClick={() => window.location.reload()}>Reload navigator</button>
      </main>
    );
  }
}
