import { useEffect, useState } from "react";

import {
  getOverview,
  type OverviewSummary
} from "../api";

import { StatusBadge } from "../components/StatusBadge";

interface DashboardViewProps {
  onCreateRecord: () => void;
  onVerify: () => void;
  onAudit: () => void;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function outcomeTone(
  outcome: OverviewSummary["recentAudit"][number]["outcome"]
) {
  if (outcome === "success") {
    return "success" as const;
  }

  if (outcome === "denied") {
    return "warning" as const;
  }

  return "danger" as const;
}

export function DashboardView({
  onCreateRecord,
  onVerify,
  onAudit
}: DashboardViewProps) {
  const [overview, setOverview] =
    useState<OverviewSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const result = await getOverview();
      setOverview(result);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load overview"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const protectionHealthy =
    overview !== null &&
    overview.failedBatches === 0;

  return (
    <div className="dashboard-view">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">TRUST INFRASTRUCTURE</p>

          <h2>
            Protect important state
            <br />
            with verifiable evidence.
          </h2>

          <p className="dashboard-copy">
            VSL records state changes, creates cryptographic evidence,
            groups evidence into Merkle proofs, and anchors the
            resulting commitment to Hyperledger Fabric.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onCreateRecord}
          >
            Create record
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onVerify}
          >
            Verify evidence
          </button>
        </div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-grid">
        <article className="metric-card">
          <div className="metric-card-top">
            <span>01</span>
            <StatusBadge tone={loading ? "warning" : "success"}>
              {loading ? "Loading" : "Live"}
            </StatusBadge>
          </div>

          <strong>
            {overview?.resources ?? "—"}
          </strong>

          <p>Protected records</p>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span>02</span>
            <StatusBadge tone={loading ? "warning" : "success"}>
              {loading ? "Loading" : "Live"}
            </StatusBadge>
          </div>

          <strong>
            {overview?.evidenceEvents ?? "—"}
          </strong>

          <p>Evidence events</p>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span>03</span>

            <StatusBadge
              tone={
                loading
                  ? "warning"
                  : protectionHealthy
                    ? "success"
                    : "danger"
              }
            >
              {loading
                ? "Loading"
                : protectionHealthy
                  ? "Healthy"
                  : "Attention"}
            </StatusBadge>
          </div>

          <strong>
            {overview?.anchoredBatches ?? "—"}
          </strong>

          <p>Anchored batches</p>
        </article>
      </section>

      <section className="dashboard-lower">
        <article className="card product-card">
          <p className="label">SYSTEM STATUS</p>
          <h3>Protection pipeline</h3>

          <div className="integrity-list">
            <div>
              <span>Anchored batches</span>
              <strong>
                {overview?.anchoredBatches ?? "—"}
              </strong>
            </div>

            <div>
              <span>Pending batches</span>
              <strong>
                {overview?.pendingBatches ?? "—"}
              </strong>
            </div>

            <div>
              <span>Failed batches</span>
              <strong>
                {overview?.failedBatches ?? "—"}
              </strong>
            </div>
          </div>
        </article>

        <article className="card product-card">
          <div className="section-heading">
            <div>
              <p className="label">RECENT RECORDS</p>
              <h3>Latest activity</h3>
            </div>

            <span className="count-badge">
              {overview?.recentResources.length ?? 0}
            </span>
          </div>

          {overview?.recentResources.length ? (
            <div className="dashboard-list">
              {overview.recentResources.map((resource) => (
                <div
                  className="dashboard-list-row"
                  key={resource.id}
                >
                  <div>
                    <strong>{resource.externalId}</strong>
                    <span>{resource.resourceType}</span>
                  </div>

                  <small>
                    {formatDate(resource.createdAt)}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">
              {loading
                ? "Loading records..."
                : "No records yet."}
            </p>
          )}
        </article>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="label">SECURITY</p>
            <h3>Recent audit activity</h3>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={onAudit}
          >
            Open audit
          </button>
        </div>

        {overview?.recentAudit.length ? (
          <div className="dashboard-list">
            {overview.recentAudit.map((event) => (
              <div
                className="dashboard-list-row"
                key={event.id}
              >
                <div>
                  <strong>{event.action}</strong>

                  <span>
                    {event.userId ?? "System"}
                  </span>
                </div>

                <div className="dashboard-list-status">
                  <StatusBadge
                    tone={outcomeTone(event.outcome)}
                  >
                    {event.outcome.toUpperCase()}
                  </StatusBadge>

                  <small>
                    {formatDate(event.occurredAt)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            {loading
              ? "Loading activity..."
              : "No audit activity yet."}
          </p>
        )}
      </section>
    </div>
  );
}
