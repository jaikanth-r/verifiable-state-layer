-- Ensure an evidence event can only reference a version
-- belonging to the same resource.

ALTER TABLE resource_versions
  ADD CONSTRAINT resource_versions_id_resource_id_unique
  UNIQUE (id, resource_id);

ALTER TABLE evidence_events
  ADD CONSTRAINT evidence_events_resource_version_match
  FOREIGN KEY (version_id, resource_id)
  REFERENCES resource_versions (id, resource_id)
  ON DELETE RESTRICT;
