import { downloadBlob, openMailto } from './share.js';

const EXPORT_RECIPIENT = 'muenster@wego-vti.de';

// Google-Apps-Script-Webhook (siehe apps-script/Code.gs), der den Anhang automatisch per
// GmailApp verschickt – analog zur bestehenden WeGo-VTI-Unfallaufnahme-App. Leer lassen,
// bis das Script deployt ist: exportMeldungen() fällt dann direkt auf den
// Download+mailto-Weg zurück, ohne einen sinnlosen Netzwerk-Request zu versuchen.
const MAIL_SCRIPT_URL = '';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildLagerplatzRows(list) {
  return list
    .filter((m) => m.type === 'lagerplatz')
    .map((m) => ({
      Datum: formatDate(m.createdAt),
      Artikelnummer: m.artikelnummer || '',
      Artikelbezeichnung: m.artikelbezeichnung || '',
      Menge: m.menge || '',
      'Bisheriger Lagerplatz': m.altLagerplatz || '',
      'Neuer Lagerplatz': m.neuLagerplatz || '',
      Bemerkung: m.bemerkung || '',
      'Gemeldet von': m.melder || '',
    }));
}

function buildVerschrottungRows(list) {
  return list
    .filter((m) => m.type === 'verschrottung')
    .map((m) => ({
      Datum: formatDate(m.createdAt),
      Artikelnummer: m.artikelnummer || '',
      Artikelbezeichnung: m.artikelbezeichnung || '',
      Menge: m.menge || '',
      Lagerplatz: m.lagerplatz || '',
      Grund: m.grund === 'Sonstiges' && m.grundSonstiges ? `Sonstiges – ${m.grundSonstiges}` : m.grund || '',
      Bemerkung: m.bemerkung || '',
      'Gemeldet von': m.melder || '',
      Foto: m.foto ? 'Ja' : 'Nein',
    }));
}

export function buildWorkbook(meldungen) {
  const wb = window.XLSX.utils.book_new();
  const lagerRows = buildLagerplatzRows(meldungen);
  const verschrottungRows = buildVerschrottungRows(meldungen);

  if (lagerRows.length) {
    const ws = window.XLSX.utils.json_to_sheet(lagerRows);
    window.XLSX.utils.book_append_sheet(wb, ws, 'Lagerplatzänderungen');
  }
  if (verschrottungRows.length) {
    const ws = window.XLSX.utils.json_to_sheet(verschrottungRows);
    window.XLSX.utils.book_append_sheet(wb, ws, 'Verschrottungen');
  }
  if (!lagerRows.length && !verschrottungRows.length) {
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([['Keine Meldungen']]), 'Leer');
  }
  return wb;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Automatischer Versand über das Apps-Script-Webhook (kein manuelles Anhängen nötig).
// text/plain statt application/json vermeiden einen CORS-Preflight, den Google Apps
// Script sonst ablehnt (siehe apps-script/Code.gs).
async function sendViaScript({ blob, filename, subject, message }) {
  const arrayBuffer = await blob.arrayBuffer();
  const res = await fetch(MAIL_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      to: EXPORT_RECIPIENT,
      subject,
      message,
      filename,
      mime_type: blob.type,
      file_base64: arrayBufferToBase64(arrayBuffer),
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('Unerwartete Antwort vom Mail-Script');
}

export async function exportMeldungen(meldungen) {
  const wb = buildWorkbook(meldungen);
  const arrayBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const filename = `Lagermeldungen_${stamp}.xlsx`;
  const subject = `Lagermeldungen ${stamp}`;
  const message = `${meldungen.length} Lagermeldung(en) im Anhang.`;

  if (MAIL_SCRIPT_URL) {
    try {
      await sendViaScript({ blob, filename, subject, message });
      return { method: 'auto' };
    } catch (err) {
      console.warn('Automatischer Mailversand fehlgeschlagen, Fallback auf Download+mailto:', err.message);
    }
  }

  // Fallback: Web-Share liefert keine Möglichkeit, den Empfänger vorzubelegen – daher
  // Excel-Datei herunterladen und E-Mail-Entwurf mit vorausgefülltem Empfänger öffnen.
  // Der Anhang muss der Nutzer im Mail-Programm einmal manuell hinzufügen (mailto erlaubt
  // keine Anhänge).
  downloadBlob(blob, filename);
  openMailto({
    to: EXPORT_RECIPIENT,
    subject,
    body: `${message}\n\nBitte die heruntergeladene Datei "${filename}" an diese Mail anhängen.`,
  });
  return { method: 'download' };
}
