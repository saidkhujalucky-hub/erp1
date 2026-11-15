import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.js';

function center(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  sqlite.exec(`
    INSERT INTO users (id,username,password_hash,role,name) VALUES
      (1,'admin','test','admin','Admin'), (2,'teacher1','test','teacher','Ali'),
      (3,'teacher2','test','teacher','Nodira');
    INSERT INTO groups (id,name,subject,teacher_id) VALUES
      (1,'A','English',2), (2,'B','Math',2), (3,'C','English',3);
  `);
  const tokens = { admin: 'a1', teacher: 'b2' };
  for (const [id, token] of [[1, tokens.admin], [2, tokens.teacher]]) {
    const hash = createHash('sha256').update(token).digest('hex');
    sqlite.prepare("INSERT INTO sessions VALUES (?,?,datetime('now','+1 hour'))").run(hash, id);
  }
  const db = {
    prepare(query) {
      const statement = sqlite.prepare(query);
      return { bind: (...args) => ({
        first: () => statement.get(...args),
        all: () => ({ results: statement.all(...args) }),
        run: () => ({ meta: statement.run(...args) }),
      }) };
    },
  };
  function post(path, body, role = 'admin') {
    return worker.fetch(new Request('https://example.test/api/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=' + tokens[role] },
      body: JSON.stringify(body),
    }), { DB: db });
  }
  return { sqlite, post };
}

test('admin can edit, archive and restore a student without losing history', async t => {
  const { sqlite, post } = center(t);
  sqlite.exec(`
    INSERT INTO students (id,name,phone) VALUES (9,'Former name',NULL);
    INSERT INTO enrollments VALUES (9,1);
    INSERT INTO lessons (id, group_id, starts_at, ends_at) VALUES (6,1,'2026-11-04T09:00','2026-11-04T10:00');
    INSERT INTO attendance VALUES (6,9,'present');
    INSERT INTO grades VALUES (6,9,91);
    INSERT INTO payments (student_id,amount,paid_at) VALUES (9,300000,'2026-11-01');
  `);
  const edit = { student_id: 9, name: '  New name  ', phone: '1234' };
  assert.equal((await post('student-edit', edit, 'teacher')).status, 403);
  assert.equal((await post('student-status', {student_id: 9, active: false}, 'teacher')).status, 403);
  assert.equal((await post('student-edit', edit)).status, 200);
  assert.deepEqual([...Object.values(sqlite.prepare('SELECT name,phone FROM students WHERE id=9').get())], ['New name','1234']);
  assert.equal((await post('student-edit', {...edit, name:'  '})).status, 400);
  assert.equal((await post('student-status', { student_id: 9, active: false })).status, 200);
  assert.equal(sqlite.prepare('SELECT active FROM students WHERE id=9').get().active, 0);
  assert.equal((await post('enroll', {student_id: 9, group_id: 2})).status, 400);
  assert.equal((await post('student-status', { student_id: 9, active: false })).status, 200);
  assert.equal((await post('student-status', { student_id: 9, active: true })).status, 200);
  assert.equal(sqlite.prepare('SELECT active FROM students WHERE id=9').get().active, 1);
  assert.equal(sqlite.prepare('SELECT group_id FROM enrollments WHERE student_id=9').get().group_id, 1);
  assert.equal(sqlite.prepare('SELECT status FROM attendance WHERE student_id=9').get().status, 'present');
  assert.equal(sqlite.prepare('SELECT grade FROM grades WHERE student_id=9').get().grade, 91);
  assert.equal(sqlite.prepare('SELECT amount FROM payments WHERE student_id=9').get().amount, 300000);
});

test('scheduling protects rooms, teachers and groups while allowing adjacent slots', async t => {
  const { sqlite, post } = center(t);
  const lesson = {group_id: 1, starts_at: '2026-11-16T10:00', ends_at: '2026-11-16T11:00', room: 'Aula 1'};
  assert.equal((await post('lesson', lesson, 'teacher')).status, 403);
  assert.equal((await post('lesson', lesson)).status, 200);
  assert.equal((await post('lesson', {...lesson, room: 'Other'})).status, 409);
  assert.equal((await post('lesson', {...lesson, group_id: 2, room: 'Other'})).status, 409);
  assert.equal((await post('lesson', {...lesson, group_id: 3, room: ' aula 1 ', starts_at: '2026-11-16T10:59:59'})).status, 409);
  assert.equal((await post('lesson', {...lesson, group_id: 3, room: 'Other'})).status, 200);
  assert.equal((await post('lesson', {...lesson, starts_at: '2026-11-16T11:00', ends_at: '2026-11-16T12:00'})).status, 200);
  assert.equal((await post('lesson', {...lesson, starts_at: '2026-02-30T10:00'})).status, 400);
  assert.equal((await post('lesson', {...lesson, ends_at: lesson.starts_at})).status, 400);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM lessons').get().n, 3);
});
