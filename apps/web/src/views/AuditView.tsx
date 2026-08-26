import { useEffect, useState } from "react";

import {
  getAuditEvents,
  type AuditRecord
} from "../api";

import { StatusBadge } from "../components/StatusBadge";

const PAGE_SIZE = 25;

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function outcomeTone(
  outcome: AuditRecord["outcome"]
) {
  if (outcome === "success") {
    return "success" as const;
  }

  if (outcome === "denied") {
    return "warning" as const;
  }

  return "danger" as const;
}

function outcomeLabel(
  outcome: AuditRecord["outcome"]
) {
  return outcome.toUpperCase();
}

export function AuditView() {
  const [items, setItems] = useState<AuditRecord[]>([]);
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState<
    "" | "success" | "failure" | "denied"
  >("");
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAudit(
    nextOffset = offset
  ) {
    setLoading(true);
    setError("");

    try {
      const result = await getAuditEvents({
        limit: PAGE_SIZE,
        offset: nextOffset,
        action: action.trim() || undefined,
        outcome: outcome || undefined
      });

      setItems(result.items);
      setCount(result.count);
      setOffset(nextOffset);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load audit activity"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit(0);
  }, []);

  function handleApplyFilters() {
    void loadAudit(0);
  }

  function handlePrevious() {
    const nextOffset = Math.max(0, offset - PAGE_SIZE);
    void loadAudit(nextOffset);
  }

  function handleNext() {
    if (offset + PAGE_SIZE >= count) {
      return;
    }

    void loadAudit(offset + PAGE_SIZE);
  }

  const pageStart = count === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + items.length, count);

  return (
    <div className="audit-view">
      <section className="page-heading">
        <div>
          <p className="eyebrow">SECURITY ACTIVITY</p>
          <h2>Audit trail</h2>
          <p className="page-copy">
            Review security-sensitive activity recorded by the VSL
            service, including evidence creation, anchoring, and
            authorization decisions.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void loadAudit(offset)}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="card audit-filters">
        <div className="section-heading">
          <div>
            <p className="label">FILTER ACTIVITY</p>
            <h3>Find audit events</h3>
          </div>

          <span className="count-badge">{count}</span>
        </div>

        <div className="audit-filter-grid">
          <label>
            <span>Action</span>
            <input
              value={action}
              onChange={(event) =>
                setAction(event.target.value)
              }
              placeholder="e.g. EVIDENCE_CREATED"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleApplyFilters();
                }
              }}
            />
          </label>

          <label>
            <span>Outcome</span>
            <select
              value={outcome}
              onChange={(event) =>
                setOutcome(
                  event.target.value as
                    | ""
                    | "success"
                    | "failure"
                    | "denied"
                )
              }
            >
              <option value="">All outcomes</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Denied</option>
            </select>
          </label>

          <div className="audit-filter-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleApplyFilters}
              disabled={loading}
            >
              Apply filters
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="label">EVENTS</p>
            <h3>Security activity</h3>
          </div>

          <span className="muted">
            {count === 0
              ? "No events"
              : `${pageStart}–${pageEnd} of ${count}`}
          </span>
        </div>

        {loading ? (
          <div className="audit-empty">
            <p className="muted">Loading audit activity…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="audit-empty">
            <p className="label">NO MATCHES</p>
            <h3>No audit events found</h3>
            <p className="muted">
              Try another action or outcome filter.
            </p>
          </div>
        ) : (
          <div className="audit-list">
            {items.map((item) => (
              <details
                className="audit-row"
                key={item.id}
              >
                <summary>
                  <div className="audit-main">
                    <strong>{item.action}</strong>
                    <span>
                      {formatDate(item.occurredAt)}
                    </span>
                  </div>

                  <div className="audit-row-right">
                    <StatusBadge tone={outcomeTone(item.outcome)}>
                      {outcomeLabel(item.outcome)}
                    </StatusBadge>
                    <span className="audit-chevron">+</span>
                  </div>
                </summary>

                <div className="audit-details">
                  <div className="audit-detail-grid">
                    <div>
                      <span>Actor</span>
                      <code>
                        {item.userId ?? "System"}
                      </code>
                    </div>

                    <div>
                      <span>Tenant</span>
                      <code>{item.tenantId}</code>
                    </div>

                    <div>
                      <span>Resource</span>
                      <code>
                        {item.resourceId ?? "—"}
                      </code>
                    </div>

                    <div>
                      <span>Request ID</span>
                      <code>
                        {item.requestId ?? "—"}
                      </code>
                    </div>
                  </div>

                  <div className="audit-metadata">
                    <span>Metadata</span>
                    <pre>
                      {JSON.stringify(
                        item.metadata ?? {},
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}

        {count > PAGE_SIZE && (
          <div className="audit-pagination">
            <button
              type="button"
              className="secondary-button"
              onClick={handlePrevious}
              disabled={loading || offset === 0}
            >
              Previous
            </button>

            <span>
              Page {Math.floor(offset / PAGE_SIZE) + 1}
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={handleNext}
              disabled={
                loading ||
                offset + PAGE_SIZE >= count
              }
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
