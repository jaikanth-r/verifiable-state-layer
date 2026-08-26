CREATE TABLE resource_reference_counters (
  record_type TEXT NOT NULL,
  reference_year INTEGER NOT NULL,
  next_number BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT resource_reference_counters_pk
    PRIMARY KEY (record_type, reference_year),
  CONSTRAINT resource_reference_counters_number_positive
    CHECK (next_number > 0)
);

CREATE INDEX idx_resource_reference_counters_type_year
  ON resource_reference_counters(record_type, reference_year);
