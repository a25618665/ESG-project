DO $$
DECLARE
  event_count INTEGER;
  company_count INTEGER;
  major_class_count INTEGER;
  subcategory_count INTEGER;
  numeric_grade_count INTEGER;
  special_grade_event_count INTEGER;
BEGIN
  SELECT
    COUNT(*)::integer,
    COUNT(DISTINCT risk_event.company_id)::integer,
    COUNT(DISTINCT risk_category.major_class)::integer,
    COUNT(DISTINCT risk_event.category_id)::integer,
    COUNT(DISTINCT CASE
      WHEN risk_event.ccri_grade ~ '^[3-9]$' THEN risk_event.ccri_grade
    END)::integer,
    COUNT(CASE
      WHEN risk_event.ccri_grade = 'D' THEN 1
    END)::integer
  INTO
    event_count,
    company_count,
    major_class_count,
    subcategory_count,
    numeric_grade_count,
    special_grade_event_count
  FROM risk_event
  JOIN risk_category ON risk_category.id = risk_event.category_id;

  IF event_count <> 188
    OR company_count <> 33
    OR major_class_count <> 3
    OR subcategory_count <> 11
    OR numeric_grade_count <> 7
    OR special_grade_event_count <> 26
  THEN
    RAISE EXCEPTION
      'CCRI seed verification failed: events=%, companies=%, classes=%, subcategories=%, numeric grades=%, D-coded events=%',
      event_count,
      company_count,
      major_class_count,
      subcategory_count,
      numeric_grade_count,
      special_grade_event_count;
  END IF;
END
$$;
