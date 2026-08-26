CREATE TABLE resource_participants (
  resource_id UUID NOT NULL
    REFERENCES resources(id)
    ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(id)
    ON DELETE RESTRICT,

  role TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (resource_id, tenant_id),

  CONSTRAINT resource_participants_role_valid
    CHECK (
      role IN (
        'owner',
        'counterparty',
        'carrier',
        'inspector',
        'other'
      )
    )
);

CREATE INDEX idx_resource_participants_tenant
  ON resource_participants(tenant_id);

CREATE INDEX idx_resource_participants_resource
  ON resource_participants(resource_id);
