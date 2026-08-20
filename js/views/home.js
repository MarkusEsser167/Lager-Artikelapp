import { MeldungStore, getMelderName, setMelderName } from '../db.js';
import { sendLagerplatzMeldung, sendVerschrottungMeldung, sendLagerplatzkorrekturBatch } from '../export.js';
import { loadArtikelListe, loadLagerplatzListe, loadArtikelLagerplatzListe } from '../refData.js';

const TYPE_LABEL = {
  lagerplatz: { text: 'Lagerplatzänderung', cls: 'badge-lager', icon: '📦' },
  verschrottung: { text: 'Verschrottung', cls: 'badge-verschrottung', icon: '🗑️' },
  lagerplatzkorrektur: { text: 'Lagerplatzkorrektur', cls: 'badge-lager', icon: '🔍' },
};

export async function renderHome(container, router) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `<h1>Lagermeldungen</h1><p class="view-subtitle">Lagerplatzänderungen &amp; Verschrottungen erfassen</p>`;
  container.appendChild(header);

  container.appendChild(melderBox());
  container.appendChild(refDataStatus());

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

  const korrekturBtn = document.createElement('button');
  korrekturBtn.className = 'btn btn-secondary btn-tile';
  korrekturBtn.innerHTML = '🔍<br>Massen-Lagerplatzkorrektur';
  korrekturBtn.addEventListener('click', () => router.navigate('massen-lagerplatzkorrektur'));

  actions.appendChild(lagerBtn);
  actions.appendChild(verschrottungBtn);
  actions.appendChild(korrekturBtn);
  container.appendChild(actions);

  const meldungen = await MeldungStore.listMeldungen();

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
    <label class="field-label" for="melder-input">Gemeldet von *</label>
    <input id="melder-input" type="text" placeholder="Name eingeben" value="${escapeAttr(current)}" />
  `;
  const input = box.querySelector('#melder-input');
  input.addEventListener('change', () => setMelderName(input.value.trim()));
  return box;
}

// Lädt (bzw. liest aus dem Cache) im Hintergrund – blockiert den Seitenaufbau nicht,
// da das Parsen der Artikelliste (aktuell ~150.000 Zeilen) einige Sekunden dauern kann.
function refDataStatus() {
  const box = document.createElement('div');
  box.className = 'ref-data-status';
  box.innerHTML = `<span>⏳ Lade Artikel- und Lagerplatzliste…</span>`;
  Promise.all([loadArtikelListe(), loadLagerplatzListe()]).then(([artikel, lagerplaetze]) => {
    box.innerHTML = `
      <span>${artikel.length ? `📋 Artikelliste: ${artikel.length} Artikel` : '⚠️ Artikelliste nicht gefunden (data/artikelliste.xlsx)'}</span>
      <span>${lagerplaetze.length ? `📋 Lagerplatzliste: ${lagerplaetze.length} Plätze` : '⚠️ Lagerplatzliste nicht gefunden (data/lagerplatzliste.xlsx)'}</span>
    `;
  });
  return box;
}

const STATUS_LABEL = {
  gesendet: { text: 'Automatisch gesendet', cls: 'badge-fertig' },
  manuell: { text: 'Manueller Versand nötig', cls: 'badge-verschrottung' },
  offen: { text: 'Nicht gesendet', cls: 'badge-verschrottung' },
};

function meldungCard(m, container, router) {
  const type = TYPE_LABEL[m.type] || { text: m.type, cls: '', icon: '' };
  const status = STATUS_LABEL[m.status] || STATUS_LABEL.offen;
  const card = document.createElement('div');
  card.className = 'protocol-card';
  const title = m.artikelnummer || '(keine Artikelnummer)';
  const sub =
    m.type === 'lagerplatz'
      ? `${m.altLagerplatz || '–'} → ${m.neuLagerplatz || '–'}`
      : m.type === 'lagerplatzkorrektur'
        ? `${m.bisherigerLagerplatz || '–'} → ${m.neuerLagerplatz || '–'}`
        : `${m.grund || '–'}${m.menge ? ' · ' + m.menge + ' Stk.' : ''}`;
  card.innerHTML = `
    <div class="protocol-card-top">
      <span class="badge ${status.cls}">${status.text}</span>
      <span class="protocol-type">${type.icon} ${type.text}</span>
    </div>
    <div class="protocol-card-title">${escapeHtml(title)}</div>
    <div class="protocol-card-sub">${escapeHtml(sub)} · ${formatDate(m.createdAt)} · ${escapeHtml(m.melder || '–')}</div>
  `;
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  if (m.status !== 'gesendet') {
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-ghost btn-sm';
    retryBtn.textContent = 'Erneut senden';
    retryBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      retryBtn.disabled = true;
      retryBtn.textContent = 'Wird gesendet…';
      try {
        const result =
          m.type === 'lagerplatz' ? await sendLagerplatzMeldung(m)
          : m.type === 'lagerplatzkorrektur' ? await sendLagerplatzkorrekturBatch([m])
          : await sendVerschrottungMeldung(m);
        await MeldungStore.updateStatus(m.id, result.method === 'auto' ? 'gesendet' : 'manuell');
      } catch (err) {
        alert('Versand fehlgeschlagen: ' + err.message);
      }
      await renderHome(container, router);
    });
    actions.appendChild(retryBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-ghost btn-sm';
  delBtn.textContent = 'Löschen';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Diese Meldung wirklich löschen?')) {
      await MeldungStore.deleteMeldung(m.id);
      await renderHome(container, router);
    }
  });
  actions.appendChild(delBtn);
  card.appendChild(actions);
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
