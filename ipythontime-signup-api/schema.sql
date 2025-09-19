CREATE TABLE IF NOT EXISTS signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  who_is_learning TEXT,
  student_name TEXT,
  student_dob TEXT,
  parent_name TEXT,
  email TEXT,
  phone TEXT,
  phone_country_iso TEXT,
  phone_dial_code TEXT,
  country_iso TEXT,
  country_label TEXT,
  message TEXT
);
