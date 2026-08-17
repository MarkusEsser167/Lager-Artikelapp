import { MeldungStore, getMelderName, setMelderName } from '../db.js';
import { exportMeldungen } from '../export.js';

const TYPE_LABEL = {
  lagerplatz: { text: 'Lagerplatzänderung', cls: 'badge-lager', icon: '📦' },
  verschrottung: { text: 'Verschrottung', cls: 'badge-verschrottung', icon: '🗑️' },
};

export async function renderHome(container, router) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `<h1>Lagermeldungen</h1><p class="view-subtitle">Lagerplatzänderungen &amp; Verschrottungen erfassen</p>`;
  container.appendChild(header);

  container.appendChild(melderBox());

  const actions = document.createElement('div');
  actions.className = 'home-actions';
  const lagerBtn = document.createElement('button');
  lagerBtn.className = 'btn btn-primary btn-tile';
  lagerBtn.innerHTML = '📦↔️<br>Lagerplatzänderung melden';
  lagerBtn.addEventListener('click', () => router.navigate('neu-lagerplatz'));

  const verschrottungBtn = document.createElement('button');
  verschrottungBtn.className = 'btn btn-danger btn-tile';
  verschrottungBtn.innerHTML = '🗑️<br>Verschrottung melden';
  verschrottungBtn.addEventListener('click', () => router.navigate('neu-verschrottung'));

  actions.appendChild(lagerBtn);
  actions.appendChild(verschrottungBtn);
  container.appendChild(actions);

  const meldungen = await MeldungStore.listMeldungen();
  const offen = meldungen.filter((m) => m.status !== 'exportiert');

  container.appendChild(exportBar(offen, container, router));

  const list = document.createElement('div');
  list.className = 'protocol-list';
  container.appendChild(list);

  if (!meldungen.length) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = 'Noch keine Meldungen erfasst.';
    list.appendChild(div);
  } else {
    meldungen.forEach((m) => list.appendChild(meldungCard(m, container, router)));
  }
}

function melderBox() {
  const box = document.createElement('div');
  box.className = 'melder-box';
  const current = getMelderName();
  box.innerHTML = `
    <label class="field-label" for="melder-input">Gemeldet von</label>
    <input id="melder-input" type="text" placeholder="Name eingeben" value="${escapeAttr(current)}" />
  `;
  const input = box.querySelector('#melder-input');
  input.addEventListener('change', () => setMelderName(input.value.trim()));
  return box;
}

function exportBar(offen, container, router) {
  const box = document.createElement('div');
  box.className = 'vehicle-list-status';
  const label = document.createElement('span');
  label.textContent = offen.length
    ? `${offen.length} offene Meldung(en) noch nicht exportiert`
    : 'Alle Meldungen exportiert';
  const btn = document.createElement('button');
  btn.className = 'btn btn-secondary btn-sm';
  btn.textContent = '📤 Per Mail exportieren';
  btn.disabled = !offen.length;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Wird erstellt…';
    try {
      await exportMeldungen(offen);
      await MeldungStore.markExported(offen.map((m) => m.id));
      await renderHome(container, router);
    } catch (err) {
      alert('Export fehlgeschlagen: ' + err.message);
      btn.disabled = false;
      btn.textContent = '📤 Per Mail exportieren';
    }
  });
  box.appendChild(label);
  box.appendChild(btn);
  return box;
}

function meldungCard(m, container, router) {
  const type = TYPE_LABEL[m.type] || { text: m.type, cls: '', icon: '' };
  const card = document.createElement('div');
  card.className = 'protocol-card';
  const title = m.artikelnummer || '(keine Artikelnummer)';
  const sub =
    m.type === 'lagerplatz'
      ? `${m.altLagerplatz || '–'} → ${m.neuLagerplatz || '–'}`
      : `${m.lagerplatz || '–'} · ${m.grund || '–'}`;
  card.innerHTML = `
    <div class="protocol-card-top">
      <span class="badge ${m.status === 'exportiert' ? 'badge-fertig' : type.cls}">${m.status === 'exportiert' ? 'Exportiert' : 'Offen'}</span>
      <span class="protocol-type">${type.icon} ${type.text}</span>
    </div>
    <div class="protocol-card-title">${escapeHtml(title)}</div>
    <div class="protocol-card-sub">${escapeHtml(sub)} · ${formatDate(m.createdAt)} · ${escapeHtml(m.melder || '–')}</div>
  `;
  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-ghost btn-sm card-delete';
  delBtn.textContent = 'Löschen';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Diese Meldung wirklich löschen?')) {
      await MeldungStore.deleteMeldung(m.id);
      await renderHome(container, router);
    }
  });
  card.appendChild(delBtn);
  return card;
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s);
}
