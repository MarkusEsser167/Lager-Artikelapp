import { scanBarcode, isScanSupported } from './barcode.js';

// Baut ein Textfeld mit Scan-Button (Barcode/QR über Kamera) und optional einer
// Trefferliste aus einer hinterlegten Vorgabeliste (Artikel-/Lagerplatzliste), die
// beim Tippen oder nach einem Scan gefiltert wird. onSelect wird bei einem Treffer
// aufgerufen (z.B. um die Artikelbezeichnung automatisch mit einzutragen).
export function scanField({ id, label, placeholder = '', items = null, valueKey, labelKey, onSelect }) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.innerHTML = `
    <label class="field-label" for="${id}">${label}</label>
    <div class="scan-input-row">
      <input id="${id}" type="text" placeholder="${placeholder}" autocomplete="off" />
      ${isScanSupported() ? '<button type="button" class="btn btn-ghost btn-scan">📷 Scannen</button>' : ''}
    </div>
  `;
  const input = wrap.querySelector('input');
  const scanBtn = wrap.querySelector('.btn-scan');

  let resultsBox = null;
  if (items && items.length) {
    resultsBox = document.createElement('div');
    resultsBox.className = 'lookup-results';
    wrap.appendChild(resultsBox);

    const showResults = (query) => {
      resultsBox.innerHTML = '';
      const q = query.trim().toLowerCase();
      // Erst ab 2 Zeichen suchen – bei sehr großen Listen (z.B. 150.000+ Artikeln) wäre
      // ein Treffer auf 1 Zeichen weder aussagekräftig noch beim Tippen flüssig.
      if (q.length < 2) return;
      const matches = items
        .filter((it) => it[valueKey].toLowerCase().includes(q) || (it[labelKey] || '').toLowerCase().includes(q))
        .slice(0, 8);
      matches.forEach((m) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'lookup-result-row';
        row.textContent = m[labelKey] ? `${m[valueKey]} – ${m[labelKey]}` : m[valueKey];
        row.addEventListener('mousedown', (e) => e.preventDefault()); // Klick vor Blur behalten
        row.addEventListener('click', () => {
          input.value = m[valueKey];
          resultsBox.innerHTML = '';
          if (onSelect) onSelect(m);
        });
        resultsBox.appendChild(row);
      });
    };

    // Debounce: bei sehr großen Listen soll nicht bei jedem Tastendruck sofort gefiltert werden.
    let debounceTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => showResults(input.value), 150);
    });
    input.addEventListener('blur', () => setTimeout(() => { resultsBox.innerHTML = ''; }, 150));

    const findExact = (value) => items.find((it) => it[valueKey].toLowerCase() === value.trim().toLowerCase());
    input.addEventListener('change', () => {
      const match = findExact(input.value);
      if (match && onSelect) onSelect(match);
    });
  }

  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      const value = await scanBarcode({ title: label });
      if (value) {
        input.value = value;
        input.dispatchEvent(new Event('change'));
      }
    });
  }

  return { wrap, input };
}
