const languages = {
  uz: {
    current: 'Faol o‘quvchilar', archived: 'Arxivdagi o‘quvchilar',
    name: 'Ism', phone: 'Telefon', edit: 'Tahrirlash', save: 'Saqlash',
    archive: 'Arxivlash', restore: 'Faol ro‘yxatga qaytarish', points: 'Ballar',
    empty: 'O‘quvchilar yo‘q', error: 'O‘zgarishni saqlab bo‘lmadi.',
    invalid: 'Ism va telefon raqamini tekshiring.',
  },
  en: {
    current: 'Active students', archived: 'Archived students',
    name: 'Name', phone: 'Phone', edit: 'Edit', save: 'Save',
    archive: 'Archive', restore: 'Restore', points: 'Points',
    empty: 'No students', error: 'Could not save the change.',
    invalid: 'Check the student’s name and phone number.',
  },
  ru: {
    current: 'Активные ученики', archived: 'Архив учеников',
    name: 'Имя', phone: 'Телефон', edit: 'Редактировать', save: 'Сохранить',
    archive: 'В архив', restore: 'Восстановить', points: 'Баллы',
    empty: 'Учеников нет', error: 'Не удалось сохранить изменение.',
    invalid: 'Проверьте имя и телефон ученика.',
  },
};

export function studentDirectory(students, lang, escape) {
  const labels = languages[lang] || languages.uz;
  function profile(student) {
    const name = escape(student.name);
    const phone = escape(student.phone || '');
    const statusLabel = student.active ? labels.archive : labels.restore;
    return `<article class="teacher-card" data-profile-id="${Number(student.id)}">
      <div class="row"><span class="grow"><b>${name}</b>
        <small class="muted">ID ${Number(student.id)} · ${labels.points} ${Number(student.points) || 0}</small>
      </span><span>${phone}</span></div>
      <details><summary>${labels.edit} · ${name}</summary>
        <form data-profile-edit class="form">
          <label>${labels.name}<input name="name" maxlength="200" value="${name}" required></label>
          <label>${labels.phone}<input name="phone" type="tel" maxlength="64" value="${phone}"></label>
          <button class="primary">${labels.save}</button>
        </form>
      </details>
      <button type="button" data-profile-active="${student.active ? '0' : '1'}"
        aria-label="${statusLabel} · ${name}">${statusLabel}</button>
      <small role="alert" class="error" data-profile-error></small>
    </article>`;
  }
  const active = students.filter(student => student.active);
  const archived = students.filter(student => !student.active);
  const renderList = list => list.length ? list.map(profile).join('') : `<p class="muted">${labels.empty}</p>`;
  return `<div id="student-directory"><h2>${labels.current} (${active.length})</h2>
    ${renderList(active)}
    <details><summary>${labels.archived} (${archived.length})</summary>${renderList(archived)}</details></div>`;
}

export function bindStudentDirectory({ api, refresh, lang }) {
  const directory = document.querySelector('#student-directory');
  if (!directory) return;
  const labels = languages[lang] || languages.uz;
  async function save(profile, path, fields) {
    const buttons = profile.querySelectorAll('button');
    if (Array.from(buttons).some(button => button.disabled)) return;
    buttons.forEach(button => { button.disabled = true; });
    const error = profile.querySelector('[data-profile-error]');
    error.textContent = '';
    try {
      await api(path, { student_id: Number(profile.dataset.profileId), ...fields });
      await refresh();
    } catch (cause) {
      error.textContent = cause.message === 'Invalid student details' ? labels.invalid : labels.error;
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }
  directory.addEventListener('submit', event => {
    if (!event.target.matches('[data-profile-edit]')) return;
    event.preventDefault();
    void save(event.target.closest('[data-profile-id]'), 'student-edit', Object.fromEntries(new FormData(event.target)));
  });
  directory.addEventListener('click', event => {
    const button = event.target.closest('[data-profile-active]');
    if (!button) return;
    void save(button.closest('[data-profile-id]'), 'student-status', { active: button.dataset.profileActive === '1' });
  });
}
