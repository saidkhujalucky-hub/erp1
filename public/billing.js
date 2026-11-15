const labels = {
  uz: {
    title:'Oylik to‘lovlar', month:'Hisob oyi', group:'Guruh', all:'Barcha guruhlar', dueOnly:'Faqat qarzdorlar',
    open:'Shu oy uchun hisoblar yaratish', selectGroup:'Hisob yaratish uchun guruhni tanlang.',
    explain:'Guruhning hozirgi faol o‘quvchilari uchun shu tarifda oylik hisob yaratiladi.',
    none:'Bu tanlov bo‘yicha hisoblar yo‘q.', student:'O‘quvchi', fee:'Oylik to‘lov', paid:'To‘langan', due:'Qoldiq',
    collect:'To‘lov kiritish', apply:'Oldingi to‘lovni biriktirish', existing:'Qoldiqqa mos oldingi to‘lovlar', date:'To‘lov sanasi', amount:'Summa', note:'Izoh',
    save:'Saqlash', cancel:'Bekor qilish', empty:'Biriktirish uchun mos to‘lov yo‘q.', added:'Yaratilgan hisoblar', retry:'Qayta urinish'
  },
  ru: {
    title:'Оплата по месяцам', month:'Расчётный месяц', group:'Группа', all:'Все группы', dueOnly:'Только должники',
    open:'Начислить за этот месяц', selectGroup:'Для начисления выберите группу.',
    explain:'Для действующих учеников этой группы будет начислена плата по текущему тарифу.',
    none:'Начислений по этим условиям нет.', student:'Ученик', fee:'Начислено', paid:'Оплачено', due:'Остаток',
    collect:'Принять оплату', apply:'Зачесть прежний платёж', existing:'Прежние платежи в пределах остатка', date:'Дата оплаты', amount:'Сумма', note:'Примечание',
    save:'Сохранить', cancel:'Отмена', empty:'Подходящих платежей нет.', added:'Новых начислений', retry:'Повторить'
  },
  en: {
    title:'Monthly tuition', month:'Billing month', group:'Group', all:'All groups', dueOnly:'Outstanding only',
    open:'Create this month’s charges', selectGroup:'Choose a group to create charges.',
    explain:'Charge each currently active student in this group at the current monthly fee.',
    none:'No charges match these filters.', student:'Student', fee:'Charged', paid:'Paid', due:'Balance',
    collect:'Record payment', apply:'Apply existing payment', existing:'Existing payments within the balance', date:'Payment date', amount:'Amount', note:'Note',
    save:'Save', cancel:'Cancel', empty:'No eligible payments.', added:'New charges', retry:'Retry'
  }
};

const localDate = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const selection = {month:'', group:'', outstanding:false};

export const billingPanel = () => '<section class="panel" id="monthly-billing"></section>';

export async function bindBilling({data, lang, api, esc, money, refresh}) {
  const host = document.querySelector('#monthly-billing');
  if (!host) return;
  const t = labels[lang] || labels.uz;
  selection.month ||= localDate().slice(0, 7);
  let view, revision = 0, notice = '';

  async function load() {
    const ticket = ++revision;
    try {
      const result = await api('billing?month=' + encodeURIComponent(selection.month));
      if (ticket !== revision || !host.isConnected) return;
      view = result;
      draw();
    } catch (error) {
      if (ticket !== revision) return;
      host.innerHTML = '<p role="alert"></p><button type="button"></button>';
      host.querySelector('p').textContent = error.message;
      host.querySelector('button').textContent = t.retry;
      host.querySelector('button').onclick = load;
    }
  }

  function draw() {
    const group = data.groups.find(g => String(g.id) === selection.group);
    const groupOptions = data.groups.map(g => `<option value="${g.id}" ${g === group ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
    const items = view.charges.filter(c => (!group || c.group_id === group.id) && (!selection.outstanding || c.fee > c.paid));
    host.innerHTML = `<h2>${t.title}</h2>
      <div class="form"><label>${t.month} <input type="month" value="${esc(selection.month)}" data-month></label>
      <label>${t.group} <select data-group><option value="">${t.all}</option>${groupOptions}</select></label>
      <label><input type="checkbox" data-outstanding ${selection.outstanding ? 'checked' : ''}> ${t.dueOnly}</label></div>
      ${view.month === view.currentMonth ? (group ? `<p class="muted">${t.explain} <b>${esc(money(group.monthly_fee))}</b></p>
        <button type="button" data-open>${t.open}</button>` : `<p class="muted">${t.selectGroup}</p>`) : ''}
      <p role="status" class="muted">${esc(notice)}</p>
      ${items.length ? `<div class="table-scroll"><table><thead><tr>
        ${[t.student,t.group,t.fee,t.paid,t.due,''].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>
        ${items.map(c => `<tr><td>${esc(c.student)}</td><td>${esc(c.group_name)}</td><td>${esc(money(c.fee))}</td>
          <td>${esc(money(c.paid))}</td><td>${esc(money(c.fee-c.paid))}</td>
          <td>${c.fee > c.paid ? `<button type="button" data-pay="${c.id}">${t.collect}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted">${t.none}</p>`}
      <div data-editor></div>`;
    host.querySelector('[data-month]').onchange = e => {
      if (!e.target.value) return;
      selection.month = e.target.value;
      notice = '';
      load();
    };
    host.querySelector('[data-group]').onchange = e => { selection.group = e.target.value; notice = ''; draw(); };
    host.querySelector('[data-outstanding]').onchange = e => { selection.outstanding = e.target.checked; draw(); };
    const open = host.querySelector('[data-open]');
    if (open) open.onclick = async () => {
      open.disabled = true;
      try {
        const result = await api('billing/open', {month:view.month, group_id:group.id});
        notice = t.added + ': ' + result.added;
        await load();
      } catch (error) {
        host.querySelector('[role=status]').textContent = error.message;
        open.disabled = false;
      }
    };
    host.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => edit(view.charges.find(c=>c.id === Number(b.dataset.pay))));
  }

  function edit(charge) {
    const editor = host.querySelector('[data-editor]');
    const left = charge.fee - charge.paid;
    editor.innerHTML = `<h3 tabindex="-1">${esc(charge.student)} · ${esc(charge.group_name)} · ${esc(charge.month)}</h3>
      <form class="form"><label>${t.amount}<input name="amount" type="number" min="1" max="${left}" step="1" value="${left}" required></label>
      <label>${t.date}<input name="paid_at" type="date" value="${localDate()}" required></label>
      <label>${t.note}<input name="note" maxlength="500"></label><button class="primary">${t.save}</button></form>
      <button type="button" data-previous>${t.apply}</button> <button type="button" data-cancel>${t.cancel}</button>
      <div data-history></div><p role="alert"></p>`;
    editor.querySelector('h3').focus();
    const form = editor.querySelector('form');
    const key = crypto.randomUUID();
    const err = msg => { editor.querySelector('[role=alert]').textContent = msg; };
    form.onsubmit = async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form));
      const submit = form.querySelector('button');
      submit.disabled = true;
      try {
        await api('billing/payment', {...payload, charge_id:charge.id, request_key:key});
        await refresh();
      } catch (error) {err(error.message); submit.disabled = false;}
    };
    editor.querySelector('[data-cancel]').onclick = draw;
    const previous = editor.querySelector('[data-previous]');
    previous.onclick = async () => {
      previous.disabled = true;
      try {
        const {payments} = await api('billing/unallocated', {charge_id:charge.id});
        if (!previous.isConnected) return;
        const history = editor.querySelector('[data-history]');
        const eligible = payments.filter(p => p.amount <= left);
        history.innerHTML = eligible.length ? `<form class="form"><label>${t.existing}<select name="payment_id" required>
          <option value="">—</option>${eligible.map(p=>`<option value="${p.id}">#${p.id} · ${esc(p.paid_at.slice(0,10))} · ${esc(money(p.amount))} · ${esc(p.note)}</option>`).join('')}
          </select></label><button>${t.apply}</button></form>` : `<p>${t.empty}</p>`;
        if (eligible.length) history.querySelector('form').onsubmit = async event => {
          event.preventDefault();
          const submit = history.querySelector('button');
          submit.disabled = true;
          try {
            await api('billing/allocate',{charge_id:charge.id, payment_id:history.querySelector('select').value});
            await refresh();
          } catch (error) {err(error.message); submit.disabled = false;}
        };
      } catch (error) {err(error.message); previous.disabled = false;}
    };
  }
  await load();
}
