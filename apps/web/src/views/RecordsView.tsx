import { useEffect, useState } from "react";

import {
  createEvent,
  createResource,
  protectResource,
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

interface RecordsViewProps {
  onCreated?: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatStateKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (value) => value.toUpperCase());
}

function protectionTone(
  batch: AnchorBatch | null,
  verification: VerificationResult | null
) {
  if (verification?.valid && batch?.status === "anchored") {
    return "success" as const;
  }

  if (batch?.status === "failed") {
    return "danger" as const;
  }

  return "warning" as const;
}

export function RecordsView({ onCreated }: RecordsViewProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);

  const [versions, setVersions] = useState<Version[]>([]);
  const [batch, setBatch] = useState<AnchorBatch | null>(null);
  const [verification, setVerification] =
    useState<VerificationResult | null>(null);

  const [recordType, setRecordType] = useState("purchase");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [status, setStatus] = useState("open");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadResources() {
    setLoadingResources(true);

    try {
      const result = await listResources();
      setResources(result.items);

      if (resource) {
        const current = result.items.find(
          (item) => item.id === resource.id
        );

        if (!current) {
          setResource(null);
          setVersions([]);
          setBatch(null);
          setVerification(null);
        }
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

  useEffect(() => {
    void loadResources();
  }, []);

  async function refreshResource(resourceId: string) {
    const history = await getHistory(resourceId);
    setVersions(history.versions);

    const latest = history.versions.at(-1);

    if (!latest) {
      setVerification(null);
      setBatch(null);
      return;
    }

    const nextVerification = await verifyEvent(latest.eventId);
    setVerification(nextVerification);

    if (nextVerification.batchId) {
      setBatch(await getBatch(nextVerification.batchId));
    } else {
      setBatch(null);
    }
  }

  async function handleSelectResource(selected: Resource) {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      setResource(selected);
      await refreshResource(selected.id);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load record"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRecord() {
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (!customer.trim()) {
        throw new Error("Customer / counterparty is required");
      }

      if (!amount.trim()) {
        throw new Error("Amount is required");
      }

      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error("Enter a valid amount");
      }

      const created = await createResource({
        resourceType: recordType.trim()
      });

      setResource(created);

      await createEvent(created.id, {
        eventType: "create",
        state: {
          customer: customer.trim(),
          amount: numericAmount,
          currency,
          status
        }
      });

      const protection = await protectResource(created.id);
      setBatch(protection.batch);

      await refreshResource(created.id);
      await loadResources();

      setMessage(
        protection.status === "already_protected"
          ? `${created.externalId} is already protected.`
          : `${created.externalId} is protected and anchored to Hyperledger Fabric.`
      );

      onCreated?.();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to create record"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAddUpdate() {
    if (!resource) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (!customer.trim()) {
        throw new Error("Customer / counterparty is required");
      }

      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        throw new Error("Enter a valid amount");
      }

      await createEvent(resource.id, {
        eventType: "update",
        state: {
          customer: customer.trim(),
          amount: numericAmount,
          currency,
          status
        }
      });

      const protection = await protectResource(resource.id);
      setBatch(protection.batch);

      await refreshResource(resource.id);
      await loadResources();

      setMessage(
        protection.status === "already_protected"
          ? "New evidence recorded; the record was already protected."
          : "New evidence recorded and anchored to Hyperledger Fabric."
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to record update"
      );
    } finally {
      setBusy(false);
    }
  }

  function handleStartOver() {
    setResource(null);
    setVersions([]);
    setBatch(null);
    setVerification(null);
    setMessage("");
    setError("");
  }

  function handlePrepareNewRecord() {
    handleStartOver();
    setCustomer("");
    setAmount("");
    setRecordType("purchase");
    setCurrency("INR");
    setStatus("open");
  }

  if (!resource) {
    return (
      <div className="records-view">
        <section className="page-heading">
          <div>
            <p className="eyebrow">PROTECTED RECORDS</p>
            <h2>Your records</h2>
            <p className="page-copy">
              Select an existing record or create a new protected record.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handlePrepareNewRecord}
            disabled={busy}
          >
            Create new record
          </button>
        </section>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {loadingResources ? (
          <section className="card">
            <p className="muted">Loading records...</p>
          </section>
        ) : (
          <>
            {resources.length > 0 && (
              <section className="card">
                <div className="section-heading">
                  <div>
                    <p className="label">RECORD LIBRARY</p>
                    <h3>Existing records</h3>
                  </div>

                  <span className="count-badge">
                    {resources.length}
                  </span>
                </div>

                <div className="resource-list">
                  {resources.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="resource-list-item"
                      onClick={() => void handleSelectResource(item)}
                      disabled={busy}
                    >
                      <span>
                        <strong>{item.externalId}</strong>
                        <small>
                          {item.resourceType} ·{" "}
                          {formatDate(item.createdAt)}
                        </small>
                      </span>

                      <span className="resource-list-arrow">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {resources.length === 0 && (
              <section className="card empty-state">
                <p className="label">NO RECORDS</p>
                <h3>Nothing protected yet</h3>
                <p className="muted">
                  Create your first record to begin building verifiable
                  evidence.
                </p>
              </section>
            )}
          </>
        )}

        <section className="card record-form-card">
          <div className="section-heading">
            <div>
              <p className="label">NEW RECORD</p>
              <h3>Create a protected record</h3>
            </div>

            <StatusBadge>System generated</StatusBadge>
          </div>

          <div className="record-form">
            <label>
              <span>Record type</span>

              <select
                value={recordType}
                onChange={(event) =>
                  setRecordType(event.target.value)
                }
                disabled={busy}
              >
                <option value="purchase">Purchase agreement</option>
                <option value="trade">Trade record</option>
                <option value="shipment">Shipment</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              <span>Customer / counterparty</span>

              <input
                value={customer}
                onChange={(event) =>
                  setCustomer(event.target.value)
                }
                placeholder="e.g. Alice Trading"
                disabled={busy}
              />
            </label>

            <label>
              <span>Amount</span>

              <div className="record-amount">
                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  inputMode="decimal"
                  placeholder="e.g. 42000"
                  disabled={busy}
                />

                <select
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value)
                  }
                  disabled={busy}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </label>

            <label>
              <span>Current status</span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                disabled={busy}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
          </div>

          <div className="record-form-footer">
            <div>
              <strong>Reference generated automatically</strong>

              <p>
                You do not need to enter IDs, hashes, timestamps,
                Merkle roots, or blockchain transaction data.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() => void handleCreateRecord()}
              disabled={
                busy ||
                !customer.trim() ||
                !amount.trim()
              }
            >
              {busy ? "Creating..." : "Create protected record"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const latest = versions.at(-1);

  return (
    <div className="records-view">
      <section className="record-summary card">
        <div>
          <p className="eyebrow">
            {resource.resourceType.toUpperCase()}
          </p>

          <h2>{resource.externalId}</h2>

          <p className="page-copy">
            Created {formatDate(resource.createdAt)}
          </p>
        </div>

        <div className="record-summary-status">
          <StatusBadge
            tone={verification?.valid ? "success" : "warning"}
          >
            {verification?.valid
              ? "Verified"
              : "Verification pending"}
          </StatusBadge>

          <StatusBadge
            tone={
              batch?.status === "anchored"
                ? "success"
                : batch?.status === "failed"
                  ? "danger"
                  : "warning"
            }
          >
            {batch?.status === "anchored"
              ? "Anchored"
              : batch?.status ?? "Pending"}
          </StatusBadge>
        </div>
      </section>

      {message && (
        <div className="message-banner" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="record-overview-grid">
        <article className="card">
          <p className="label">CURRENT STATE</p>
          <h3>Latest evidence</h3>

          {latest ? (
            <>
              <div className="state-grid">
                {Object.entries(latest.state).map(
                  ([key, value]) => (
                    <div key={key}>
                      <span>{formatStateKey(key)}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  )
                )}
              </div>

              <div className="record-meta">
                <span>Version {latest.version}</span>
                <span>{formatDate(latest.timestamp)}</span>
              </div>
            </>
          ) : (
            <p className="muted">No evidence recorded yet.</p>
          )}
        </article>

        <article className="card integrity-card">
          <div className="section-heading">
            <div>
              <p className="label">INTEGRITY</p>
              <h3>Trust status</h3>
            </div>

            <StatusBadge
              tone={protectionTone(batch, verification)}
            >
              {verification?.valid && batch?.status === "anchored"
                ? "Protected"
                : batch?.status === "failed"
                  ? "Attention"
                  : "In progress"}
            </StatusBadge>
          </div>

          <div className="integrity-list">
            <div>
              <span>State chain</span>
              <strong>
                {verification?.valid ? "Valid" : "Pending"}
              </strong>
            </div>

            <div>
              <span>Merkle proof</span>
              <strong>
                {verification?.proof ? "Valid" : "Pending"}
              </strong>
            </div>

            <div>
              <span>Fabric anchor</span>
              <strong>
                {batch?.status === "anchored"
                  ? "Confirmed"
                  : "Pending"}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="label">EVIDENCE HISTORY</p>
            <h3>State transitions</h3>
          </div>

          <span className="count-badge">{versions.length}</span>
        </div>

        <div className="evidence-timeline">
          {versions.map((version) => (
            <article
              className="evidence-row"
              key={version.eventId}
            >
              <div className="evidence-index">
                {version.version}
              </div>

              <div className="evidence-row-content">
                <div className="evidence-row-heading">
                  <strong>
                    {version.eventType === "create"
                      ? "Record created"
                      : "Record updated"}
                  </strong>

                  <span>{formatDate(version.timestamp)}</span>
                </div>

                <div className="evidence-state">
                  {Object.entries(version.state).map(
                    ([key, value]) => (
                      <span key={key}>
                        {formatStateKey(key)}: {String(value)}
                      </span>
                    )
                  )}
                </div>

                <details>
                  <summary>Technical evidence</summary>

                  <div className="technical-stack">
                    <div>
                      <span>State hash</span>
                      <code>{version.stateHash}</code>
                    </div>

                    {version.previousStateHash && (
                      <div>
                        <span>Previous state hash</span>
                        <code>
                          {version.previousStateHash}
                        </code>
                      </div>
                    )}

                    <div>
                      <span>Event ID</span>
                      <code>{version.eventId}</code>
                    </div>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="record-overview-grid">
        <article className="card">
          <p className="label">NEXT STATE</p>
          <h3>Record an update</h3>

          <div className="record-form compact">
            <label>
              <span>Customer / counterparty</span>

              <input
                value={customer}
                onChange={(event) =>
                  setCustomer(event.target.value)
                }
                disabled={busy}
              />
            </label>

            <label>
              <span>Amount</span>

              <div className="record-amount">
                <input
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  inputMode="decimal"
                  disabled={busy}
                />

                <select
                  value={currency}
                  onChange={(event) =>
                    setCurrency(event.target.value)
                  }
                  disabled={busy}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </label>

            <label>
              <span>Status</span>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                disabled={busy}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="revoked">Revoked</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => void handleAddUpdate()}
            disabled={busy}
          >
            {busy ? "Recording..." : "Record new state"}
          </button>
        </article>

        <article className="card">
          <p className="label">BLOCKCHAIN</p>
          <h3>Anchoring</h3>

          <div className="integrity-list">
            <div>
              <span>Status</span>
              <strong>{batch?.status ?? "Not batched"}</strong>
            </div>

            <div>
              <span>Protected events</span>
              <strong>{batch?.eventCount ?? 0}</strong>
            </div>

            <div>
              <span>Transaction</span>
              <code>
                {batch?.blockchainReference ?? "Pending"}
              </code>
            </div>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={handleStartOver}
            disabled={busy}
          >
            Back to records
          </button>
        </article>
      </section>
    </div>
  );
}
