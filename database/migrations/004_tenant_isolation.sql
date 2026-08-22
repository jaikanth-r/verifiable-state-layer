CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_memberships (
  tenant_id UUID NOT NULL
    REFERENCES tenants(id)
    ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, user_id),

  CONSTRAINT tenant_memberships_role_valid
    CHECK (role IN ('owner', 'admin', 'member'))
);

ALTER TABLE resources
ADD COLUMN tenant_id UUID;

ALTER TABLE anchor_batches
ADD COLUMN tenant_id UUID;

INSERT INTO tenants (name, slug)
VALUES ('Development Tenant', 'development')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (external_subject, email)
VALUES ('dev-admin', 'admin@vsl.local')
ON CONFLICT (external_subject) DO NOTHING;

INSERT INTO tenant_memberships (tenant_id, user_id, role)
SELECT
  t.id,
  u.id,
  'owner'
FROM tenants t
CROSS JOIN users u
WHERE t.slug = 'development'
  AND u.external_subject = 'dev-admin'
ON CONFLICT (tenant_id, user_id) DO NOTHING;

UPDATE resources
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'development'
  AND resources.tenant_id IS NULL;

UPDATE anchor_batches
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'development'
  AND anchor_batches.tenant_id IS NULL;

ALTER TABLE resources
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE anchor_batches
ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE resources
DROP CONSTRAINT resources_external_id_unique;

ALTER TABLE resources
ADD CONSTRAINT resources_tenant_external_id_unique
UNIQUE (tenant_id, resource_type, external_id);

ALTER TABLE resources
ADD CONSTRAINT resources_tenant_fk
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT;

ALTER TABLE anchor_batches
ADD CONSTRAINT anchor_batches_tenant_fk
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT;

CREATE INDEX idx_resources_tenant
ON resources(tenant_id);

CREATE INDEX idx_anchor_batches_tenant
ON anchor_batches(tenant_id);
