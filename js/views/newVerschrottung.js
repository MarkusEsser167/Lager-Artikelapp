import { MeldungStore, newId, getMelderName, setMelderName } from '../db.js';
import { scanField } from '../formFields.js';
import { pickPhoto } from '../camera.js';

const GRUENDE = ['Beschädigt', 'Abgelaufen/verdorben', 'Falschlieferung', 'Retoure defekt', 'Sonstiges'];

export async function renderNewVerschrottung(container, router) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `<h1>Verschrottung melden</h1>`;
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

  const platz = scanField({ id: 'lagerplatz', label: 'Lagerplatz', placeholder: 'Lagerplatz scannen oder eingeben' });
  section.appendChild(platz.wrap);

  // Grund
  const grundWrap = document.createElement('div');
  grundWrap.className = 'field';
  grundWrap.innerHTML = `<label class="field-label">Grund</label><div class="chip-row"></div>`;
  const chipRow = grundWrap.querySelector('.chip-row');
  let selectedGrund = '';
  GRUENDE.forEach((g) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = g;
    chip.addEventListener('click', () => {
      selectedGrund = g;
      chipRow.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      sonstigesWrap.style.display = g === 'Sonstiges' ? 'block' : 'none';
    });
    chipRow.appendChild(chip);
  });
  section.appendChild(grundWrap);

  const sonstiges = simpleField({ id: 'grund-sonstiges', label: 'Grund (Freitext)' });
  const sonstigesWrap = sonstiges.wrap;
  sonstigesWrap.style.display = 'none';
  section.appendChild(sonstigesWrap);

  const bemerkung = simpleField({ id: 'bemerkung', label: 'Bemerkung (optional)', textarea: true });
  section.appendChild(bemerkung.wrap);

  // Foto
  const photoWrap = document.createElement('div');
  photoWrap.className = 'field photo-field';
  photoWrap.innerHTML = `<label class="field-label">Foto (optional)</label>`;
  const photoBtn = document.createElement('button');
  photoBtn.type = 'button';
  photoBtn.className = 'btn btn-ghost';
  photoBtn.textContent = '📷 Foto aufnehmen';
  const photoPreview = document.createElement('div');
  photoPreview.className = 'photo-preview';
  let photoDataUrl = null;
  photoBtn.addEventListener('click', async () => {
    const dataUrl = await pickPhoto();
    if (dataUrl) {
      photoDataUrl = dataUrl;
      photoPreview.innerHTML = `<img src="${dataUrl}" alt="Foto" />`;
    }
  });
  photoWrap.appendChild(photoBtn);
  photoWrap.appendChild(photoPreview);
  section.appendChild(photoWrap);

  const melder = simpleField({ id: 'melder', label: 'Gemeldet von' });
  melder.input.value = getMelderName();
  section.appendChild(melder.wrap);

  const actionBar = document.createElement('div');
  actionBar.className = 'action-bar';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-danger btn-block';
  saveBtn.textContent = 'Meldung speichern';
  saveBtn.addEventListener('click', async () => {
    if (!artikel.input.value.trim()) {
      alert('Bitte eine Artikelnummer angeben.');
      artikel.input.focus();
      return;
    }
    if (!selectedGrund) {
      alert('Bitte einen Grund auswählen.');
      return;
    }
    if (selectedGrund === 'Sonstiges' && !sonstiges.input.value.trim()) {
      alert('Bitte den Grund im Freitext angeben.');
      sonstiges.input.focus();
      return;
    }
    setMelderName(melder.input.value.trim());
    const now = new Date().toISOString();
    await MeldungStore.saveMeldung({
      id: newId(),
      type: 'verschrottung',
      status: 'offen',
      createdAt: now,
      artikelnummer: artikel.input.value.trim(),
      artikelbezeichnung: bezeichnung.input.value.trim(),
      menge: menge.input.value.trim(),
      lagerplatz: platz.input.value.trim(),
      grund: selectedGrund,
      grundSonstiges: sonstiges.input.value.trim(),
      bemerkung: bemerkung.input.value.trim(),
      foto: photoDataUrl,
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
