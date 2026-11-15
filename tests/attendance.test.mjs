import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleMarks } from '../marks.js';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
db.exec(`INSERT INTO users VALUES (1,'t','hashed','teacher','Teacher',1),(2,'other','hashed','teacher','Other',1);
  INSERT INTO groups VALUES (1,'group','math',1,0);
  INSERT INTO students VALUES (1,'s1','',1),(2,'s2','',1),(3,'s3','',0);
  INSERT INTO enrollments VALUES (1,1),(2,1),(3,1);
  INSERT INTO lessons VALUES (1,1,'2026-01-15','2026-01-15','room');`);
const adapter = {
  prepare(sql) { return { bind(...args) { const statement = db.prepare(sql); return {
    first: () => statement.get(...args),
    execute: () => /^SELECT/i.test(sql) ? {results:statement.all(...args)} : {meta:statement.run(...args)},
  }; } }; },
  batch(stmts) { db.exec('BEGIN'); try {const results=stmts.map(s=>s.execute());db.exec('COMMIT');return results;} catch(e) {db.exec('ROLLBACK');throw e;} },
};
const call = (id, action, body) => handleMarks(adapter, { role:'teacher', id }, action, {lesson_id:1, ...body});
assert.equal((await call(2,'mark-present',{})).status,403);
assert.equal((await call(1,'mark',{ student_id:1,status:'absent',grade:92 })).status,200);
assert.equal((await call(1,'mark',{ student_id:1,status:'late' })).status,200);
assert.equal((await call(1,'mark',{ student_id:1,status:'absent',grade:102 })).status,400);
assert.equal((await call(1,'mark',{ student_id:4,status:'present' })).status,403);
assert.equal((await call(1,'mark',{ student_id:3,status:'present' })).status,403);
assert.equal((await (await call(1,'mark-present',{})).json()).changed,1);
assert.equal((await (await call(1,'mark-present',{})).json()).changed,0);
assert.equal(db.prepare('SELECT status FROM attendance WHERE student_id=1').get().status,'late');
assert.equal(db.prepare('SELECT grade FROM grades WHERE student_id=1').get().grade,92);
assert.equal(db.prepare('SELECT count(*) AS n FROM attendance').get().n,2);
assert.equal((await call(1,'mark',{student_id:1,status:'late',grade:''})).status,200);
assert.equal(db.prepare('SELECT count(*) AS n FROM grades').get().n,0);
console.log('Attendance workflow passed');
