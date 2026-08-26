-- Illustrative local-development records. They are not part of the research dataset.
INSERT INTO company (name)
VALUES
  ('Example Technology Company'),
  ('Example Manufacturing Company')
ON CONFLICT (name) DO NOTHING;
