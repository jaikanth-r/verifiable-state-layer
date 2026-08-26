import { StatusBadge } from "../components/StatusBadge";

interface DashboardViewProps {
  onCreateRecord: () => void;
  onVerify: () => void;
  onAudit: () => void;
}

export function DashboardView({
  onCreateRecord,
  onVerify,
  onAudit
}: DashboardViewProps) {
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

      <section className="dashboard-grid">
        <article className="metric-card">
          <div className="metric-card-top">
            <span>01</span>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>

          <strong>Evidence history</strong>

          <p>
            Every state change becomes a versioned, hash-linked
            record.
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span>02</span>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>

          <strong>Merkle protection</strong>

          <p>
            Evidence is grouped into cryptographic commitments for
            efficient verification.
          </p>
        </article>

        <article className="metric-card">
          <div className="metric-card-top">
            <span>03</span>
            <StatusBadge tone="success">Connected</StatusBadge>
          </div>

          <strong>Fabric anchoring</strong>

          <p>
            Integrity commitments can be independently checked
            against the blockchain anchor.
          </p>
        </article>
      </section>

      <section className="dashboard-lower">
        <article className="card product-card">
          <p className="label">WORKFLOW</p>
          <h3>From record to proof</h3>

          <div className="workflow">
            <div>
              <span>1</span>
              <strong>Create</strong>
              <small>Generate a protected record.</small>
            </div>

            <div>
              <span>2</span>
              <strong>Record evidence</strong>
              <small>Capture the next state transition.</small>
            </div>

            <div>
              <span>3</span>
              <strong>Anchor</strong>
              <small>Commit the Merkle root to Fabric.</small>
            </div>

            <div>
              <span>4</span>
              <strong>Verify</strong>
              <small>Check the complete integrity chain.</small>
            </div>
          </div>
        </article>

        <article className="card product-card">
          <p className="label">SECURITY</p>
          <h3>Audit activity</h3>

          <p className="muted">
            Authentication, authorization, resource, evidence,
            batching, and security events are recorded by the
            backend audit layer.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={onAudit}
          >
            Open audit activity
          </button>
        </article>
      </section>
    </div>
  );
}
