// Both routes run after session authentication.
export async function handleMarks(db, user, action, body) {
  const reply = (data, status = 200) => Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
  const lessonId = Number(body.lesson_id);
  if (!Number.isSafeInteger(lessonId) || lessonId < 1) return reply({ error: 'Invalid lesson' }, 400);
  const lesson = await db.prepare(
    'SELECT l.group_id, g.teacher_id FROM lessons l JOIN groups g ON g.id=l.group_id WHERE l.id=?'
  ).bind(lessonId).first();
  if (!lesson || (user.role !== 'admin' && lesson.teacher_id !== user.id)) {
    return reply({ error: 'Forbidden' }, 403);
  }

  if (action === 'mark-present') {
    // An existing absence, late arrival or grade must survive bulk marking, including retries.
    const [insert, attendance] = await db.batch([
      db.prepare(`INSERT INTO attendance (lesson_id, student_id, status)
        SELECT ?, e.student_id, 'present' FROM enrollments e
        JOIN students s ON s.id=e.student_id
        WHERE e.group_id=? AND s.active=1
        ON CONFLICT(lesson_id, student_id) DO NOTHING`).bind(lessonId, lesson.group_id),
      db.prepare('SELECT * FROM attendance WHERE lesson_id=?').bind(lessonId),
    ]);
    return reply({ changed: insert.meta.changes, attendance: attendance.results });
  }

  const studentId = Number(body.student_id);
  if (!Number.isSafeInteger(studentId) || studentId < 1 ||
      !['present', 'absent', 'late'].includes(body.status)) {
    return reply({ error: 'Invalid attendance' }, 400);
  }
  const enrolled = await db.prepare(`SELECT 1 AS found FROM enrollments e
    JOIN students s ON s.id=e.student_id WHERE e.group_id=? AND e.student_id=? AND s.active=1`)
    .bind(lesson.group_id, studentId).first();
  if (!enrolled) return reply({ error: 'Student is not active in this group' }, 403);
  const statements = [db.prepare(`INSERT INTO attendance (lesson_id, student_id, status)
    VALUES (?, ?, ?) ON CONFLICT(lesson_id, student_id) DO UPDATE SET status=excluded.status`)
    .bind(lessonId, studentId, body.status)];
  if ('grade' in body) {
    if (body.grade === '' || body.grade === null) {
      statements.push(db.prepare('DELETE FROM grades WHERE lesson_id=? AND student_id=?').bind(lessonId, studentId));
    } else {
      const grade = Number(body.grade);
      if (!['number','string'].includes(typeof body.grade) || !String(body.grade).trim() ||
          !Number.isFinite(grade) || grade < 0 || grade > 100) return reply({ error: 'Invalid grade' }, 400);
      statements.push(db.prepare(`INSERT INTO grades (lesson_id, student_id, grade)
        VALUES (?, ?, ?) ON CONFLICT(lesson_id, student_id) DO UPDATE SET grade=excluded.grade`)
        .bind(lessonId, studentId, grade));
    }
  }
  await db.batch(statements);
  return reply({ ok: true });
}
