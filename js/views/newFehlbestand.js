import { MeldungStore, newId, getMelderName, setMelderName } from '../db.js';
import { scanField, selectField } from '../formFields.js';
import { loadArtikelListe, loadMitarbeiterListe } from '../refData.js';
import { sendFehlbestandMeldung } from '../export.js';

export async function renderNewFehlbestand(container, router) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <h1>Fehlbestand melden</h1>
    <p class="view-subtitle">Artikel per Mail an muenster@wego-vti.de melden, ohne Lagerplatz oder Menge.</p>
  `;
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.textContent = '← Zurück';
  backBtn.addEventListener('click', () => router.navigate(''));
  container.appendChild(backBtn);
  container.appendChild(header);

  const loading = document.createElement('div');
  loading.className = 'empty-state';
  loading.textContent = 'Lade Artikel- und Mitarbeiterliste…';
  container.appendChild(loading);

  const [artikelListe, mitarbeiterListe] = await Promise.all([loadArtikelListe(), loadMitarbeiterListe()]);
  loading.remove();

  const section = document.createElement('div');
  section.className = 'section';
  container.appendChild(section);

  const bezeichnung = simpleField({ id: 'artikelbezeichnung', label: 'Artikelbezeichnung (optional)' });

  const artikel = scanField({
    id: 'artikelnummer',
    label: 'Artikelnummer',
    placeholder: 'Artikelnummer scannen, eingeben oder suchen',
    items: artikelListe,
    valueKey: 'nummer',
    labelKey: 'bezeichnung',
    onSelect: (m) => { bezeichnung.input.value = m.bezeichnung; },
  });
  section.appendChild(artikel.wrap);
  section.appendChild(bezeichnung.wrap);

  const bemerkung = simpleField({ id: 'bemerkung', label: 'Bemerkung (optional)', textarea: true });
  section.appendChild(bemerkung.wrap);

  const melder = selectField({ id: 'melder', label: 'Gemeldet von *', options: mitarbeiterListe, value: getMelderName() });
  section.appendChild(melder.wrap);

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-secondary btn-block';
  saveBtn.textContent = 'Meldung senden';
  saveBtn.addEventListener('click', async () => {
    if (!artikel.input.value.trim()) {
      alert('Bitte eine Artikelnummer angeben.');
      artikel.input.focus();
      return;
    }
    if (!melder.input.value) {
      alert('Bitte deinen Namen auswählen.');
      melder.input.focus();
      return;
    }
    setMelderName(melder.input.value);
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird gesendet…';
    const meldung = {
      id: newId(),
      type: 'fehlbestand',
      status: 'offen',
      createdAt: new Date().toISOString(),
      artikelnummer: artikel.input.value.trim(),
      artikelbezeichnung: bezeichnung.input.value.trim(),
      bemerkung: bemerkung.input.value.trim(),
      melder: melder.input.value,
    };
    await MeldungStore.saveMeldung(meldung);
    try {
      const result = await sendFehlbestandMeldung(meldung);
      await MeldungStore.updateStatus(meldung.id, result.method === 'auto' ? 'gesendet' : 'manuell');
    } catch (err) {
      alert('Versand fehlgeschlagen: ' + err.message);
    }
    router.navigate('');
  });
  actionBar.appendChild(saveBtn);
  container.appendChild(actionBar);

  artikel.input.focus();
}

function simpleField({ id, label, type = 'text', textarea = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const control = textarea
    ? `<textarea id="${id}" rows="3"></textarea>`
    : `<input id="${id}" type="${type}" autocomplete="off" />`;
  wrap.innerHTML = `<label class="field-label" for="${id}">${label}</label>${control}`;
  const input = wrap.querySelector(textarea ? 'textarea' : 'input');
  return { wrap, input };
}
