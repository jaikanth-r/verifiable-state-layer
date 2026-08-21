CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL,
    external_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT resources_external_id_unique
        UNIQUE (resource_type, external_id)
);

CREATE TABLE resource_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    resource_id UUID NOT NULL
        REFERENCES resources(id)
        ON DELETE RESTRICT,

    version INTEGER NOT NULL,
    state JSONB NOT NULL,

    state_hash TEXT NOT NULL,
    previous_state_hash TEXT,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT resource_versions_version_positive
        CHECK (version > 0),

    CONSTRAINT resource_versions_unique_version
        UNIQUE (resource_id, version),

    CONSTRAINT resource_versions_hash_length
        CHECK (length(state_hash) = 64)
);

CREATE INDEX idx_resource_versions_resource
    ON resource_versions(resource_id);

CREATE INDEX idx_resource_versions_previous_hash
    ON resource_versions(previous_state_hash);

CREATE TABLE evidence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL
        UNIQUE,

    resource_id UUID NOT NULL
        REFERENCES resources(id)
        ON DELETE RESTRICT,

    version_id UUID NOT NULL
        REFERENCES resource_versions(id)
        ON DELETE RESTRICT,

    event_type TEXT NOT NULL,

    actor_id TEXT NOT NULL,

    occurred_at TIMESTAMPTZ NOT NULL,

    state_hash TEXT NOT NULL,

    previous_state_hash TEXT,

    signature TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evidence_events_resource
    ON evidence_events(resource_id);

CREATE INDEX idx_evidence_events_version
    ON evidence_events(version_id);

CREATE TABLE anchor_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    merkle_root TEXT NOT NULL,

    protocol_version TEXT NOT NULL,

    status TEXT NOT NULL,

    blockchain_reference TEXT,

    event_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    anchored_at TIMESTAMPTZ,

    CONSTRAINT anchor_batches_event_count_nonnegative
        CHECK (event_count >= 0),

    CONSTRAINT anchor_batches_status_valid
        CHECK (
            status IN (
                'pending',
                'submitted',
                'anchored',
                'failed'
            )
        )
);

CREATE INDEX idx_anchor_batches_status
    ON anchor_batches(status);
