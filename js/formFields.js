import { scanBarcode, isScanSupported } from './barcode.js';

// Baut ein Textfeld mit optionalem Scan-Button (Barcode/QR über Kamera).
export function scanField({ id, label, placeholder = '' }) {
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
