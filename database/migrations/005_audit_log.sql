CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  tenant_id UUID
    REFERENCES tenants(id)
    ON DELETE RESTRICT,

  user_id UUID
    REFERENCES users(id)
    ON DELETE RESTRICT,

  action TEXT NOT NULL,

  outcome TEXT NOT NULL,

  resource_id UUID,

  request_id TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT audit_events_outcome_valid
    CHECK (outcome IN ('success', 'failure', 'denied'))
);

CREATE INDEX idx_audit_events_tenant_time
  ON audit_events(tenant_id, occurred_at DESC);

CREATE INDEX idx_audit_events_user_time
  ON audit_events(user_id, occurred_at DESC);

CREATE INDEX idx_audit_events_action_time
  ON audit_events(action, occurred_at DESC);

CREATE INDEX idx_audit_events_request_id
  ON audit_events(request_id);
