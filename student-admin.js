export async function handleStudentAdmin(db, path, body, json) {
  const studentId = Number(body?.student_id);
  if (!Number.isSafeInteger(studentId) || studentId < 1) {
    return json({ error: 'Invalid student' }, 400);
  }

  let statement;
  if (path === 'student-edit') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    if (!name || name.length > 200 || phone === null || phone.length > 64) {
      return json({ error: 'Invalid student details' }, 400);
    }
    statement = db.prepare('UPDATE students SET name = ?, phone = ? WHERE id = ?')
      .bind(name, phone, studentId);
  } else if (path === 'student-status' && [true, false].includes(body.active)) {
    statement = db.prepare('UPDATE students SET active = ? WHERE id = ?')
      .bind(Number(body.active), studentId);
  } else {
    return json({ error: 'Invalid student status' }, 400);
  }

  const updated = await statement.run();
  if (!updated.meta.changes) return json({ error: 'Student not found' }, 404);
  return json({ ok: true });
}
