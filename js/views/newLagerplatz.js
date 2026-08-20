import { MeldungStore, newId, getMelderName, setMelderName } from '../db.js';
import { scanField } from '../formFields.js';
import { loadArtikelListe, loadLagerplatzListe } from '../refData.js';
import { sendLagerplatzMeldung } from '../export.js';

export async function renderNewLagerplatz(container, router) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `<h1>Lagerplatzänderung melden</h1>`;
  const backBtn = document.createElement('button');
  backBtn.className = 'btn-back';
  backBtn.textContent = '← Zurück';
  backBtn.addEventListener('click', () => router.navigate(''));
  container.appendChild(backBtn);
  container.appendChild(header);

  const loading = document.createElement('div');
  loading.className = 'empty-state';
  loading.textContent = 'Lade Artikel- und Lagerplatzliste…';
  container.appendChild(loading);

  const [artikelListe, lagerplatzListe] = await Promise.all([loadArtikelListe(), loadLagerplatzListe()]);
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

  const altPlatz = scanField({
    id: 'alt-lagerplatz',
    label: 'Bisheriger Lagerplatz',
    placeholder: 'Lagerplatz scannen, eingeben oder suchen',
    items: lagerplatzListe,
    valueKey: 'code',
    labelKey: 'bezeichnung',
  });
  section.appendChild(altPlatz.wrap);

  const neuPlatz = scanField({
    id: 'neu-lagerplatz',
    label: 'Neuer Lagerplatz',
    placeholder: 'Lagerplatz scannen, eingeben oder suchen',
    items: lagerplatzListe,
    valueKey: 'code',
    labelKey: 'bezeichnung',
  });
  section.appendChild(neuPlatz.wrap);

  const bemerkung = simpleField({ id: 'bemerkung', label: 'Bemerkung (optional)', textarea: true });
  section.appendChild(bemerkung.wrap);

  const melder = simpleField({ id: 'melder', label: 'Gemeldet von *' });
  melder.input.value = getMelderName();
  section.appendChild(melder.wrap);

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = 'Meldung senden';
  saveBtn.addEventListener('click', async () => {
    if (!artikel.input.value.trim()) {
      alert('Bitte eine Artikelnummer angeben.');
      artikel.input.focus();
      return;
    }
    if (!altPlatz.input.value.trim() || !neuPlatz.input.value.trim()) {
      alert('Bitte bisherigen und neuen Lagerplatz angeben.');
      return;
    }
    if (!melder.input.value.trim()) {
      alert('Bitte deinen Namen angeben.');
      melder.input.focus();
      return;
    }
    setMelderName(melder.input.value.trim());
    saveBtn.disabled = true;
    saveBtn.textContent = 'Wird gesendet…';
    const meldung = {
      id: newId(),
      type: 'lagerplatz',
      status: 'offen',
      createdAt: new Date().toISOString(),
      artikelnummer: artikel.input.value.trim(),
      artikelbezeichnung: bezeichnung.input.value.trim(),
      altLagerplatz: altPlatz.input.value.trim(),
      neuLagerplatz: neuPlatz.input.value.trim(),
      bemerkung: bemerkung.input.value.trim(),
      melder: melder.input.value.trim(),
    };
    await MeldungStore.saveMeldung(meldung);
    try {
      const result = await sendLagerplatzMeldung(meldung);
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
