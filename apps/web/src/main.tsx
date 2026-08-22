import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getBatch,
  getHistory,
  verifyEvent,
  type AnchorBatch,
  type VerificationResult,
  type Version
} from "./api";
import "./styles.css";

const RESOURCE_ID =
  "36273418-a9cd-4ccb-b3ea-23c81ef17fb6";

function App() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [batch, setBatch] = useState<AnchorBatch | null>(null);
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const history = await getHistory(RESOURCE_ID);
      setVersions(history.versions);

      const latestEvent =
        history.versions[history.versions.length - 1];

      if (!latestEvent) {
        setBatch(null);
        setVerification(null);
        return;
      }

      const result = await verifyEvent(latestEvent.eventId);
      setVerification(result);

      if (result.batchId) {
        const batchResult = await getBatch(result.batchId);
        setBatch(batchResult);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load VSL state"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">VERIFIABLE STATE LAYER</p>
          <h1>Integrity Dashboard</h1>
        </div>

        <button
          className="refresh"
          onClick={() => void loadDashboard()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <article className="card wide">
          <div className="card-header">
            <div>
              <p className="label">RESOURCE</p>
              <h2>demo-deal-001</h2>
            </div>
            <span className="badge neutral">
              {versions.length} versions
            </span>
          </div>

          <div className="timeline">
            {versions.map((version) => (
              <div className="timeline-item" key={version.eventId}>
                <div className="timeline-marker" />

                <div className="timeline-content">
                  <div className="timeline-top">
                    <strong>Version {version.version}</strong>
                    <span>{version.eventType}</span>
                  </div>

                  <p>
                    {JSON.stringify(version.state)}
                  </p>

                  <code>{version.stateHash}</code>

                  {version.previousStateHash && (
                    <small>
                      Previous: {version.previousStateHash}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <p className="label">MERKLE BATCH</p>
          <h2>{batch?.status ?? "—"}</h2>

          <div className="metric">
            <span>Events</span>
            <strong>{batch?.eventCount ?? "—"}</strong>
          </div>

          <div className="hash-box">
            {batch?.merkleRoot ?? "No batch"}
          </div>
        </article>

        <article className="card">
          <p className="label">BLOCKCHAIN</p>

          <div className="chain-status">
            <span
              className={
                batch?.status === "anchored"
                  ? "status-dot"
                  : "status-dot muted"
              }
            />

            <strong>
              {batch?.status === "anchored"
                ? "Anchored to Fabric"
                : "Not anchored"}
            </strong>
          </div>

          <div className="metric">
            <span>Protocol</span>
            <strong>
              {batch?.protocolVersion ?? "—"}
            </strong>
          </div>

          <div className="hash-box">
            {batch?.blockchainReference ??
              "No transaction"}
          </div>
        </article>

        <article className="card wide verification">
          <div>
            <p className="label">INTEGRITY VERIFICATION</p>

            <h2
              className={
                verification?.valid
                  ? "verified"
                  : "not-verified"
              }
            >
              {verification?.valid
                ? "✓ VERIFIED"
                : "Verification unavailable"}
            </h2>

            <p className="muted">
              The event's Merkle proof resolves to the
              stored batch root.
            </p>
          </div>

          {verification?.proof && (
            <div className="proof-grid">
              <div>
                <span>Leaf</span>
                <code>{verification.proof.leaf}</code>
              </div>

              <div>
                <span>Root</span>
                <code>{verification.proof.root}</code>
              </div>

              <div>
                <span>Proof siblings</span>
                <strong>
                  {verification.proof.siblings.length}
                </strong>
              </div>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
