import { useEffect, useState } from "react";

import {
  getBatch,
  getHistory,
  listResources,
  verifyEvent,
  type AnchorBatch,
  type Resource,
  type VerificationResult,
  type Version
} from "../api";

import { StatusBadge } from "../components/StatusBadge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function VerifyView() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");

  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [batch, setBatch] = useState<AnchorBatch | null>(null);

  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadResources() {
    setLoadingResources(true);
    setError("");

    try {
      const result = await listResources();

      setResources(result.items);

      if (result.items.length > 0 && !selectedResourceId) {
        setSelectedResourceId(result.items[0].id);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load records"
      );
    } finally {
      setLoadingResources(false);
    }
  }

  async function loadHistory(resourceId: string) {
    setLoadingHistory(true);
    setError("");
    setMessage("");
    setVerification(null);
    setBatch(null);
    setSelectedEventId("");
    setVersions([]);

    try {
      const result = await getHistory(resourceId);

      setVersions(result.versions);

      if (result.versions.length > 0) {
        const latest = result.versions[result.versions.length - 1];

        setSelectedEventId(latest.eventId);
      } else {
        setMessage("This record has no evidence events yet.");
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load evidence history"
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleVerify(eventId = selectedEventId) {
    if (!eventId) {
      setError("Select an evidence event first.");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");
    setVerification(null);
    setBatch(null);

    try {
      const result = await verifyEvent(eventId);

      setVerification(result);

      if (result.batchId) {
        setBatch(await getBatch(result.batchId));
      }

      if (result.valid) {
        setMessage("Evidence is cryptographically verified.");
      } else {
        setMessage(
          result.reason === "NOT_ANCHORED"
            ? "Evidence exists but has not been anchored yet."
            : "Verification failed."
        );
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to verify evidence"
      );
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    void loadResources();
  }, []);

  useEffect(() => {
    if (selectedResourceId) {
      void loadHistory(selectedResourceId);
    }
  }, [selectedResourceId]);

  const selectedResource = resources.find(
    (resource) => resource.id === selectedResourceId
  );

  const selectedVersion = versions.find(
    (version) => version.eventId === selectedEventId
  );

  return (
    <div className="verify-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">INDEPENDENT VERIFICATION</p>
          <h2>Verify evidence</h2>
          <p className="page-copy">
            Validate a recorded state transition, its Merkle proof,
            and its blockchain anchor without relying on the Records view.
          </p>
        </div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="message-banner" role="status">
          {message}
        </div>
      )}

      <section className="verify-controls card">
        <div className="section-heading">
          <div>
            <p className="label">SELECT EVIDENCE</p>
            <h3>Choose a record and event</h3>
          </div>

          {verification && (
            <StatusBadge
              tone={verification.valid ? "success" : "warning"}
            >
              {verification.valid ? "VALID" : verification.reason}
            </StatusBadge>
          )}
        </div>

        <div className="verify-control-grid">
          <label>
            <span>Record</span>

            <select
              value={selectedResourceId}
              onChange={(event) =>
                setSelectedResourceId(event.target.value)
              }
              disabled={loadingResources || loadingHistory || verifying}
            >
              {!loadingResources && resources.length === 0 && (
                <option value="">No records available</option>
              )}

              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.externalId} · {resource.resourceType}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Evidence event</span>

            <select
              value={selectedEventId}
              onChange={(event) => {
                setSelectedEventId(event.target.value);
                setVerification(null);
                setBatch(null);
                setMessage("");
              }}
              disabled={
                loadingHistory ||
                verifying ||
                versions.length === 0
              }
            >
              {loadingHistory && (
                <option value="">Loading evidence…</option>
              )}

              {!loadingHistory && versions.length === 0 && (
                <option value="">No evidence available</option>
              )}

              {versions.map((version) => (
                <option
                  key={version.eventId}
                  value={version.eventId}
                >
                  Version {version.version} · {version.eventType} ·{" "}
                  {formatDate(version.timestamp)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="verify-action-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleVerify()}
            disabled={
              verifying ||
              loadingHistory ||
              !selectedEventId
            }
          >
            {verifying ? "Verifying…" : "Verify evidence"}
          </button>
        </div>
      </section>

      {selectedVersion && (
        <section className="record-overview-grid">
          <article className="card">
            <p className="label">SELECTED EVIDENCE</p>
            <h3>
              Version {selectedVersion.version} ·{" "}
              {selectedVersion.eventType}
            </h3>

            <div className="integrity-list">
              <div>
                <span>Event ID</span>
                <code>{selectedVersion.eventId}</code>
              </div>

              <div>
                <span>Actor</span>
                <strong>{selectedVersion.actorId}</strong>
              </div>

              <div>
                <span>Timestamp</span>
                <strong>
                  {formatDate(selectedVersion.timestamp)}
                </strong>
              </div>

              <div>
                <span>State hash</span>
                <code>{selectedVersion.stateHash}</code>
              </div>

              <div>
                <span>Previous state hash</span>
                <code>
                  {selectedVersion.previousStateHash ?? "None"}
                </code>
              </div>
            </div>
          </article>

          <article className="card">
            <p className="label">RECORDED STATE</p>
            <h3>
              {selectedResource?.externalId ?? "Selected record"}
            </h3>

            <div className="state-grid">
              {Object.entries(selectedVersion.state).map(
                ([key, value]) => (
                  <div key={key}>
                    <span>
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <strong>{String(value)}</strong>
                  </div>
                )
              )}
            </div>
          </article>
        </section>
      )}

      {verification && (
        <>
          <section className="card verification-result-card">
            <div className="section-heading">
              <div>
                <p className="label">VERIFICATION RESULT</p>
                <h3>
                  {verification.valid
                    ? "Evidence is valid"
                    : "Evidence requires attention"}
                </h3>
              </div>

              <StatusBadge
                tone={verification.valid ? "success" : "danger"}
              >
                {verification.valid
                  ? "VALID"
                  : verification.reason}
              </StatusBadge>
            </div>

            <div className="verification-summary-grid">
              <div>
                <span>State chain</span>
                <strong>
                  {verification.valid ? "Valid" : "Not verified"}
                </strong>
              </div>

              <div>
                <span>Merkle proof</span>
                <strong>
                  {verification.proof ? "Valid" : "Unavailable"}
                </strong>
              </div>

              <div>
                <span>Fabric anchor</span>
                <strong>
                  {batch?.status === "anchored"
                    ? "Confirmed"
                    : "Not confirmed"}
                </strong>
              </div>

              <div>
                <span>Batch</span>
                <strong>{verification.batchId || "None"}</strong>
              </div>
            </div>
          </section>

          {verification.proof && (
            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="label">MERKLE PROOF</p>
                  <h3>Cryptographic evidence</h3>
                </div>

                <span className="count-badge">
                  Index {verification.proof.index}
                </span>
              </div>

              <div className="technical-stack">
                <div>
                  <span>Leaf</span>
                  <code>{verification.proof.leaf}</code>
                </div>

                <div>
                  <span>Root</span>
                  <code>{verification.proof.root}</code>
                </div>

                <div>
                  <span>Merkle root</span>
                  <code>{verification.merkleRoot}</code>
                </div>

                <div>
                  <span>Sibling hashes</span>
                  <code>
                    {verification.proof.siblings.length === 0
                      ? "None — single-event batch"
                      : verification.proof.siblings.join(", ")}
                  </code>
                </div>
              </div>
            </section>
          )}

          <section className="record-overview-grid">
            <article className="card">
              <p className="label">BLOCKCHAIN</p>
              <h3>Fabric anchor</h3>

              <div className="integrity-list">
                <div>
                  <span>Status</span>
                  <strong>
                    {batch?.status ?? "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Transaction</span>
                  <code>
                    {batch?.blockchainReference ?? "Unavailable"}
                  </code>
                </div>

                <div>
                  <span>Anchored at</span>
                  <strong>
                    {batch?.anchoredAt
                      ? formatDate(batch.anchoredAt)
                      : "Not anchored"}
                  </strong>
                </div>
              </div>
            </article>

            <article className="card">
              <p className="label">BATCH</p>
              <h3>Commitment metadata</h3>

              <div className="integrity-list">
                <div>
                  <span>Batch ID</span>
                  <code>{verification.batchId || "None"}</code>
                </div>

                <div>
                  <span>Protocol</span>
                  <strong>
                    {batch?.protocolVersion ?? "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Merkle root</span>
                  <code>{verification.merkleRoot || "None"}</code>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
