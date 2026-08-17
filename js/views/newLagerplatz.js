import { MeldungStore, newId, getMelderName, setMelderName } from '../db.js';
import { scanField } from '../formFields.js';

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

  const section = document.createElement('div');
  section.className = 'section';
  container.appendChild(section);

  const artikel = scanField({ id: 'artikelnummer', label: 'Artikelnummer', placeholder: 'Artikelnummer scannen oder eingeben' });
  section.appendChild(artikel.wrap);

  const bezeichnung = simpleField({ id: 'artikelbezeichnung', label: 'Artikelbezeichnung (optional)' });
  section.appendChild(bezeichnung.wrap);

  const menge = simpleField({ id: 'menge', label: 'Menge (optional)', type: 'number' });
  section.appendChild(menge.wrap);

  const altPlatz = scanField({ id: 'alt-lagerplatz', label: 'Bisheriger Lagerplatz', placeholder: 'Lagerplatz scannen oder eingeben' });
  section.appendChild(altPlatz.wrap);

  const neuPlatz = scanField({ id: 'neu-lagerplatz', label: 'Neuer Lagerplatz', placeholder: 'Lagerplatz scannen oder eingeben' });
  section.appendChild(neuPlatz.wrap);

  const bemerkung = simpleField({ id: 'bemerkung', label: 'Bemerkung (optional)', textarea: true });
  section.appendChild(bemerkung.wrap);

  const melder = simpleField({ id: 'melder', label: 'Gemeldet von' });
  melder.input.value = getMelderName();
  section.appendChild(melder.wrap);

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = 'Meldung speichern';
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
    setMelderName(melder.input.value.trim());
    const now = new Date().toISOString();
    await MeldungStore.saveMeldung({
      id: newId(),
      type: 'lagerplatz',
      status: 'offen',
      createdAt: now,
      artikelnummer: artikel.input.value.trim(),
      artikelbezeichnung: bezeichnung.input.value.trim(),
      menge: menge.input.value.trim(),
      altLagerplatz: altPlatz.input.value.trim(),
      neuLagerplatz: neuPlatz.input.value.trim(),
      bemerkung: bemerkung.input.value.trim(),
      melder: melder.input.value.trim(),
    });
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
