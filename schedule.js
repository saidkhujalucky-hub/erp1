function validTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return false;
  const parsed = new Date(value + 'Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, value.length) === value;
}

export async function createLesson(db, body, json) {
  const groupId = Number(body.group_id);
  const { starts_at: start, ends_at: end } = body;
  const room = String(body.room || '').trim();
  if (!Number.isSafeInteger(groupId) || groupId < 1 || !validTime(start) || !validTime(end) ||
      Date.parse(start + 'Z') >= Date.parse(end + 'Z')) {
    return json({error: 'Invalid group or lesson time'}, 400);
  }
  // Check and reserve the slot in one statement, including overlapping bookings from other admins.
  const result = await db.prepare(`
    INSERT INTO lessons (group_id, starts_at, ends_at, room)
    SELECT g.id, ?, ?, ? FROM groups g
    WHERE g.id = ? AND NOT EXISTS (
      SELECT 1 FROM lessons l JOIN groups other ON other.id = l.group_id
      WHERE datetime(l.starts_at) < datetime(?) AND datetime(l.ends_at) > datetime(?)
        AND (other.id = g.id OR other.teacher_id = g.teacher_id
          OR (? <> '' AND lower(trim(l.room)) = lower(?)))
    )
  `).bind(start, end, room, groupId, end, start, room, room).run();
  if (!result.meta.changes) return json({error: 'scheduleConflict'}, 409);
  return json({ok: true});
}
