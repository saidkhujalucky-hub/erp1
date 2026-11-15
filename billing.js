const collected = `COALESCE((SELECT SUM(p.amount) FROM charge_payments cp
  JOIN payments p ON p.id = cp.payment_id WHERE cp.charge_id = c.id), 0)`;

function currentMonth() {
  // The center operates on Tashkent time.
  return new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 7);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const positiveInt = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export async function handleBilling({p, method, body, db, user, url, json}) {
  if (user.role !== 'admin') return json({error:'Forbidden'}, 403);
  if (p === 'billing' && method === 'GET') {
    const month = url.searchParams.get('month') || currentMonth();
    if (!validMonth(month)) return json({error:'Invalid month'}, 400);
    const {results: charges} = await db.prepare(`SELECT c.*, s.name student, g.name group_name,
      ${collected} paid FROM monthly_charges c JOIN students s ON s.id = c.student_id
      JOIN groups g ON g.id = c.group_id WHERE c.month = ? ORDER BY g.name, s.name, s.id`).bind(month).all();
    return json({charges, month, currentMonth: currentMonth()});
  }
  if (method !== 'POST') return json({error:'Not found'}, 404);
  if (p === 'billing/open') {
    if (body.month !== currentMonth() || !positiveInt(body.group_id)) return json({error:'Select the current month and a group'}, 400);
    // Snapshot only the roster and tariff that the administrator has reviewed.
    const result = await db.prepare(`INSERT INTO monthly_charges(student_id, group_id, month, fee)
      SELECT e.student_id, e.group_id, ?, g.monthly_fee FROM enrollments e
      JOIN students s ON s.id = e.student_id JOIN groups g ON g.id = e.group_id
      WHERE e.group_id = ? AND s.active = 1 AND g.monthly_fee >= 0
      ON CONFLICT(student_id, group_id, month) DO NOTHING`).bind(body.month, body.group_id).run();
    return json({ok:true, added:result.meta.changes});
  }
  if (!positiveInt(body.charge_id)) return json({error:'Invalid charge'}, 400);
  if (p === 'billing/unallocated') {
    const {results: payments} = await db.prepare(`SELECT p.id, p.paid_at, p.amount, p.note
      FROM payments p JOIN monthly_charges c ON c.student_id = p.student_id
      WHERE c.id = ? AND NOT EXISTS (SELECT 1 FROM charge_payments cp WHERE cp.payment_id = p.id)
      ORDER BY p.paid_at DESC, p.id DESC`).bind(body.charge_id).all();
    return json({payments});
  }
  if (p === 'billing/allocate') {
    if (!positiveInt(body.payment_id)) return json({error:'Invalid payment'}, 400);
    const result = await db.prepare(`INSERT INTO charge_payments(payment_id, charge_id)
      SELECT p.id, c.id FROM payments p JOIN monthly_charges c ON c.student_id = p.student_id
      WHERE p.id = ? AND c.id = ? AND p.amount <= c.fee - ${collected}
      ON CONFLICT(payment_id) DO NOTHING`).bind(body.payment_id, body.charge_id).run();
    if (!result.meta.changes) {
      const existing = await db.prepare('SELECT charge_id FROM charge_payments WHERE payment_id = ?').bind(body.payment_id).first();
      if (existing?.charge_id !== Number(body.charge_id)) return json({error:'Payment unavailable or exceeds the remaining balance'}, 409);
    }
    return json({ok:true});
  }
  if (p === 'billing/payment') {
    const {request_key: key, paid_at: date} = body;
    const charge = Number(body.charge_id), amount = Number(body.amount), note = String(body.note ?? '');
    if (!positiveInt(amount) || !validDate(date) || note.length > 500 || typeof key !== 'string' ||
        !/^[a-zA-Z0-9-]{16,80}$/.test(key)) return json({error:'Invalid payment details'}, 400);
    const result = await db.prepare(`INSERT INTO billing_requests(request_key, charge_id, amount, paid_at, note)
      SELECT ?, c.id, ?, ?, ? FROM monthly_charges c WHERE c.id = ? AND ? <= c.fee - ${collected}
      ON CONFLICT(request_key) DO NOTHING`).bind(key, amount, date, note, charge, amount).run();
    if (!result.meta.changes) {
      const prior = await db.prepare('SELECT * FROM billing_requests WHERE request_key = ?').bind(key).first();
      if (!prior || prior.charge_id !== charge || prior.amount !== amount || prior.paid_at !== date || prior.note !== note)
        return json({error:'Payment conflicts with the remaining balance or a previous request'}, 409);
    }
    return json({ok:true});
  }
  return json({error:'Not found'}, 404);
}
