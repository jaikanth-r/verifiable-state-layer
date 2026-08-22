import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createResource,
  createEvent,
  createBatch,
  anchorBatch,
  getHistory,
  getBatch,
  verifyEvent,
  type AnchorBatch,
  type VerificationResult,
  type Version
} from "./api";
import "./styles.css";

function App() {
  const [resourceId, setResourceId] = useState("");
  const [externalId, setExternalId] = useState(
    `ui-demo-deal-${Date.now()}`
  );
  const [versions, setVersions] = useState<Version[]>([]);
  const [batch, setBatch] = useState<AnchorBatch | null>(null);
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadState(id: string) {
    const history = await getHistory(id);
    setVersions(history.versions);

    const latest = history.versions.at(-1);
    if (!latest) {
      setBatch(null);
      setVerification(null);
      return;
    }

    const verificationResult = await verifyEvent(latest.eventId);
    setVerification(verificationResult);

    if (verificationResult.batchId) {
      setBatch(await getBatch(verificationResult.batchId));
    }
  }

  async function handleCreateResource() {
    setBusy(true);
    setMessage("");

    try {
      const resource = await createResource({
        resourceType: "deal",
        externalId
      });

      setResourceId(resource.id);
      setVersions([]);
      setBatch(null);
      setVerification(null);

      setMessage(`Created ${resource.externalId}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateEvent() {
    if (!resourceId) return;

    setBusy(true);
    setMessage("");

    try {
      await createEvent(resourceId, {
        eventType: versions.length === 0 ? "create" : "update",
        actorId: "demo-user",
        timestamp: new Date().toISOString(),
        state:
          versions.length === 0
            ? {
                customer: "Alice",
                price: 35000,
                status: "open"
              }
            : {
                customer: "Alice",
                price: 42000,
                status: "approved"
              }
      });

      await loadState(resourceId);
      setMessage("Evidence event created");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBatch() {
    setBusy(true);
    setMessage("");

    try {
      const result = await createBatch(100);

      if (!result) {
        setMessage("No unbatched events");
        return;
      }

      setBatch(result);
      setMessage("Merkle batch created");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAnchor() {
    if (!batch) return;

    setBusy(true);
    setMessage("");

    try {
      const anchored = await anchorBatch(batch.id);
      setBatch(anchored);

      if (resourceId) {
        await loadState(resourceId);
      }

      setMessage("Anchored to Hyperledger Fabric");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">VERIFIABLE STATE LAYER</p>
          <h1>Integrity Dashboard</h1>
        </div>

        <span className="badge neutral">LIVE DEMO</span>
      </header>

      <section className="card demo-controls">
        <p className="label">DEMO WORKFLOW</p>

        <div className="resource-controls">
          <input
            value={externalId}
            onChange={(event) =>
              setExternalId(event.target.value)
            }
            placeholder="Resource external ID"
          />

          <button
            onClick={() => void handleCreateResource()}
            disabled={busy}
          >
            1. Create Resource
          </button>

          <button
            onClick={() => void handleCreateEvent()}
            disabled={busy || !resourceId}
          >
            2. Create Evidence
          </button>

          <button
            onClick={() => void handleCreateBatch()}
            disabled={busy || versions.length === 0}
          >
            3. Create Batch
          </button>

          <button
            onClick={() => void handleAnchor()}
            disabled={busy || !batch || batch.status === "anchored"}
          >
            4. Anchor to Fabric
          </button>
        </div>

        {resourceId && (
          <code className="resource-id">
            Resource ID: {resourceId}
          </code>
        )}

        {message && <p className="message">{message}</p>}
      </section>

      <section className="grid">
        <article className="card wide">
          <div className="card-header">
            <div>
              <p className="label">EVIDENCE HISTORY</p>
              <h2>{versions.length} versions</h2>
            </div>
          </div>

          {versions.length === 0 ? (
            <p className="muted">
              Create a resource and evidence event.
            </p>
          ) : (
            <div className="timeline">
              {versions.map((version) => (
                <div
                  className="timeline-item"
                  key={version.eventId}
                >
                  <div className="timeline-marker" />

                  <div className="timeline-content">
                    <div className="timeline-top">
                      <strong>
                        Version {version.version}
                      </strong>
                      <span>{version.eventType}</span>
                    </div>

                    <p>{JSON.stringify(version.state)}</p>

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
          )}
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

          <div className="hash-box">
            {batch?.blockchainReference ??
              "No transaction"}
          </div>
        </article>

        <article className="card wide verification">
          <div>
            <p className="label">INTEGRITY</p>

            <h2
              className={
                verification?.valid
                  ? "verified"
                  : "not-verified"
              }
            >
              {verification?.valid
                ? "✓ VERIFIED"
                : "Not verified"}
            </h2>

            <p className="muted">
              Merkle proof verification against the stored
              batch root.
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
