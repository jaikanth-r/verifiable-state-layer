ALTER TABLE evidence_events
ADD COLUMN anchor_batch_id UUID
REFERENCES anchor_batches(id)
ON DELETE RESTRICT;

CREATE INDEX idx_evidence_events_anchor_batch
ON evidence_events(anchor_batch_id);
