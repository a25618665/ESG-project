CREATE TABLE IF NOT EXISTS research_company (
  id BIGSERIAL PRIMARY KEY,
  source_code VARCHAR(6) NOT NULL UNIQUE
    CHECK (source_code ~ '^[0-9]{6}$'),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_category (
  id BIGSERIAL PRIMARY KEY,
  major_class TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  UNIQUE (major_class, subcategory)
);

CREATE TABLE IF NOT EXISTS risk_event (
  id BIGSERIAL PRIMARY KEY,
  source_row INTEGER NOT NULL UNIQUE CHECK (source_row > 1),
  company_id BIGINT NOT NULL
    REFERENCES research_company (id) ON DELETE RESTRICT,
  event_date DATE NOT NULL,
  event_code VARCHAR(8) NOT NULL
    CHECK (event_code ~ '^[A-Z][0-9]{7}$'),
  ccri_grade VARCHAR(1) NOT NULL
    CHECK (ccri_grade IN ('3', '4', '5', '6', '7', '8', '9', 'D')),
  data_period CHAR(7) NOT NULL
    CHECK (data_period ~ '^[0-9]{4}/[0-9]{2}$'),
  category_id BIGINT NOT NULL
    REFERENCES risk_category (id) ON DELETE RESTRICT,
  UNIQUE (company_id, event_code, data_period)
);

CREATE INDEX IF NOT EXISTS risk_event_company_id_idx
  ON risk_event (company_id);

CREATE INDEX IF NOT EXISTS risk_event_category_id_idx
  ON risk_event (category_id);

CREATE INDEX IF NOT EXISTS risk_event_ccri_grade_idx
  ON risk_event (ccri_grade);

CREATE INDEX IF NOT EXISTS risk_event_date_source_row_idx
  ON risk_event (event_date DESC, source_row);

CREATE INDEX IF NOT EXISTS risk_category_major_class_idx
  ON risk_category (major_class);
