CREATE TABLE IF NOT EXISTS monthly_charges (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  month TEXT NOT NULL,
  fee INTEGER NOT NULL CHECK(fee >= 0),
  UNIQUE(student_id, group_id, month)
);
CREATE INDEX IF NOT EXISTS monthly_charges_period ON monthly_charges(month, group_id);
CREATE TABLE IF NOT EXISTS charge_payments (
  payment_id INTEGER PRIMARY KEY REFERENCES payments(id),
  charge_id INTEGER NOT NULL REFERENCES monthly_charges(id)
);
CREATE INDEX IF NOT EXISTS charge_payments_charge ON charge_payments(charge_id);
CREATE TABLE IF NOT EXISTS billing_requests (
  request_key TEXT PRIMARY KEY NOT NULL,
  charge_id INTEGER NOT NULL REFERENCES monthly_charges(id),
  amount INTEGER NOT NULL CHECK(amount > 0),
  paid_at TEXT NOT NULL,
  note TEXT NOT NULL
);
-- A single statement creates the income record and links it to its charge.
CREATE TRIGGER IF NOT EXISTS billing_request_received AFTER INSERT ON billing_requests
BEGIN
  INSERT INTO payments(student_id, amount, paid_at, note)
  SELECT student_id, NEW.amount, NEW.paid_at, NEW.note
  FROM monthly_charges WHERE id = NEW.charge_id;
  INSERT INTO charge_payments(payment_id, charge_id) VALUES(last_insert_rowid(), NEW.charge_id);
END;
