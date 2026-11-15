const copy = {
  uz: {
    all: 'Belgilanmaganlarni «Keldi» deb saqlash', unmarked: 'Belgilanmagan',
    pending: 'Saqlanmagan', saving: 'Saqlanmoqda…', saved: 'Saqlandi',
    complete: 'Davomati belgilangan', archive: 'Arxivda',
  },
  ru: {
    all: 'Отметить остальных присутствующими', unmarked: 'Не отмечено',
    pending: 'Не сохранено', saving: 'Сохранение…', saved: 'Сохранено',
    complete: 'Посещаемость отмечена', archive: 'В архиве',
  },
  en: {
    all: 'Mark remaining students present', unmarked: 'Not marked',
    pending: 'Unsaved', saving: 'Saving…', saved: 'Saved',
    complete: 'Attendance recorded', archive: 'Archived',
  },
};

export function renderAttendance({ id, data, box, lang, t, esc, api }) {
  const lesson = data.lessons.find(item => String(item.id) === id);
  if (!lesson) { box.replaceChildren(); return; }
  const labels = copy[lang] || copy.en;
  const enrolled = new Set(data.enrollments.filter(e => e.group_id === lesson.group_id).map(e => e.student_id));
  const attendance = new Map(data.attendance.filter(a => a.lesson_id === lesson.id).map(a => [a.student_id, a.status]));
  const grades = new Map(data.grades.filter(g => g.lesson_id === lesson.id).map(g => [g.student_id, g.grade]));
  const roster = data.students.filter(s => (s.active !== 0 && enrolled.has(s.id)) || attendance.has(s.id) || grades.has(s.id));
  if (!roster.length) { box.innerHTML = `<p class="muted">${t('empty')}</p>`; return; }
  const active = roster.filter(s => s.active !== 0 && enrolled.has(s.id));
  const state = { saving: false };
  const pending = new Set();
  box.innerHTML = `<div class="row"><span class="grow" data-count></span>
      <button type="button" data-present>${labels.all}</button></div>
    <p class="muted" role="status" data-feedback></p>` + roster.map(s => {
    const current = attendance.get(s.id) || '';
    if (s.active === 0 || !enrolled.has(s.id)) {
      return `<div class="row"><span class="grow">${esc(s.name)} · ${labels.archive}</span>
        <span>${current ? t(current) : labels.unmarked}</span><span>${esc(grades.get(s.id) ?? '—')}</span></div>`;
    }
    return `<form class="row mark" data-student="${s.id}"><span class="grow">${esc(s.name)}</span>
      <select name="status" aria-label="${t('status')}" required><option value="">${labels.unmarked}</option>
      ${['present','absent','late'].map(value => `<option value="${value}" ${value === current ? 'selected' : ''}>${t(value)}</option>`).join('')}</select>
      <input type="number" name="grade" aria-label="${t('grade')}" min="0" max="100" step="any"
        value="${esc(grades.get(s.id) ?? '')}" placeholder="${t('grade')}">
      <button type="submit">${t('save')}</button><small role="status" class="muted"></small></form>`;
  }).join('');

  const bulk = box.querySelector('[data-present]');
  const feedback = box.querySelector('[data-feedback]');
  const forms = [...box.querySelectorAll('form')];
  function update() {
    const recorded = active.filter(s => attendance.has(s.id)).length;
    box.querySelector('[data-count]').textContent = `${labels.complete}: ${recorded} / ${active.length}`;
    bulk.disabled = state.saving || pending.size > 0 || recorded === active.length;
    for (const form of forms) {
      form.elements.status.disabled = form.elements.grade.disabled = state.saving;
      form.querySelector('button').disabled = state.saving || !pending.has(form);
    }
  }
  for (const form of forms) {
    const studentId = Number(form.dataset.student);
    const status = form.elements.status;
    const grade = form.elements.grade;
    const note = form.querySelector('small');
    form.oninput = () => {
      const dirty = status.value !== (attendance.get(studentId) || '') ||
        grade.value !== String(grades.get(studentId) ?? '');
      if (dirty) pending.add(form); else pending.delete(form);
      note.textContent = dirty ? labels.pending : '';
      update();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (state.saving || !pending.has(form)) return;
      const next = { lesson_id: lesson.id, student_id: studentId, status: status.value };
      const gradeChanged = grade.value !== String(grades.get(studentId) ?? '');
      if (gradeChanged) next.grade = grade.value;
      state.saving = true;
      note.textContent = labels.saving;
      update();
      try {
        await api('mark', next);
        attendance.set(studentId, next.status);
        const differentMark = record => record.lesson_id !== lesson.id || record.student_id !== studentId;
        data.attendance = data.attendance.filter(differentMark).concat({
          lesson_id: lesson.id, student_id: studentId, status: next.status,
        });
        if (gradeChanged) {
          grades.delete(studentId);
          data.grades = data.grades.filter(differentMark);
          if (next.grade !== '') {
            const value = Number(next.grade);
            grades.set(studentId, value);
            grade.value = String(value);
            data.grades.push({lesson_id: lesson.id, student_id: studentId, grade: value});
          }
        }
        pending.delete(form);
        note.textContent = labels.saved;
      } catch { note.textContent = t('error'); }
      finally { state.saving = false; update(); }
    };
  }
  bulk.onclick = async () => {
    if (bulk.disabled) return;
    state.saving = true;
    update();
    feedback.textContent = labels.saving;
    try {
      const result = await api('mark-present', { lesson_id: lesson.id });
      data.attendance = data.attendance.filter(a => a.lesson_id !== lesson.id).concat(result.attendance);
      attendance.clear();
      for (const a of result.attendance) attendance.set(a.student_id, a.status);
      for (const form of forms) form.elements.status.value = attendance.get(Number(form.dataset.student)) || '';
      feedback.textContent = `${labels.saved}: ${result.changed}`;
    } catch { feedback.textContent = t('error'); }
    finally { state.saving = false; update(); }
  };
  update();
}
