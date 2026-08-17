import { downloadBlob, openMailto } from './share.js';
import { buildVerschrottungPdf } from './pdf.js';
import { formatDate } from './format.js';

const LAGERPLATZ_RECIPIENT = 'muenster@wego-vti.de';
const VERSCHROTTUNG_RECIPIENT = 'Martin.Jochheim@wego-vti.de';

// Google-Apps-Script-Webhook (siehe apps-script/Code.gs), der den Anhang automatisch per
// GmailApp verschickt – analog zur bestehenden WeGo-VTI-Unfallaufnahme-App. Leer lassen,
// bis das Script deployt ist: der Versand fällt dann direkt auf den Download+mailto-Weg
// zurück, ohne einen sinnlosen Netzwerk-Request zu versuchen.
const MAIL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx-EdJoRy19EtO7Wqoha6qeC5iJ_Qb5JbxIykuyzskSg5qJ4BxeQOz-z82rk2ubhr9Yvg/exec';

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
// text/plain statt application/json vermeidet einen CORS-Preflight. Apps-Script-Webapps
// leiten die Antwort zusätzlich auf script.googleusercontent.com um, das keine
// Access-Control-Allow-Origin-Header setzt – die Antwort ist deshalb für JS nicht lesbar
// (mode: 'no-cors', "opaque" response). Der Request selbst kommt trotzdem an und wird von
// GmailApp verarbeitet; wir können nur erkennen, ob das Senden des Requests geklappt hat,
// nicht ob GmailApp serverseitig einen Fehler geworfen hat.
async function sendViaScript({ to, subject, message, filename, mimeType, arrayBuffer }) {
  await fetch(MAIL_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      to,
      subject,
      message,
      filename,
      mime_type: mimeType,
      file_base64: arrayBufferToBase64(arrayBuffer),
    }),
  });
}

// Fallback, falls das Script nicht erreichbar ist: Datei herunterladen + E-Mail-Entwurf mit
// vorausgefülltem Empfänger öffnen. Der Anhang muss der Nutzer im Mail-Programm einmal
// manuell hinzufügen (mailto erlaubt keine Anhänge, Web-Share kein Vorbelegen des Empfängers).
function fallbackDownloadAndMail({ blob, filename, to, subject, message }) {
  downloadBlob(blob, filename);
  openMailto({
    to,
    subject,
    body: `${message}\n\nBitte die heruntergeladene Datei "${filename}" an diese Mail anhängen.`,
  });
}

export async function sendLagerplatzMeldung(m) {
  const wb = window.XLSX.utils.book_new();
  const row = {
    Datum: formatDate(m.createdAt),
    Artikelnummer: m.artikelnummer || '',
    Artikelbezeichnung: m.artikelbezeichnung || '',
    'Bisheriger Lagerplatz': m.altLagerplatz || '',
    'Neuer Lagerplatz': m.neuLagerplatz || '',
    Bemerkung: m.bemerkung || '',
    'Gemeldet von': m.melder || '',
  };
  const ws = window.XLSX.utils.json_to_sheet([row]);
  window.XLSX.utils.book_append_sheet(wb, ws, 'Lagerplatzänderung');
  const arrayBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const safeArtikel = (m.artikelnummer || 'artikel').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = `Lagerplatzaenderung_${safeArtikel}_${m.id}.xlsx`;
  const subject = `Lagerplatzänderung – ${m.artikelnummer || 'ohne Artikelnummer'}`;
  const message = `Lagerplatzänderung gemeldet von ${m.melder || '–'}.\nArtikel: ${m.artikelnummer || '–'}\n${m.altLagerplatz || '–'} → ${m.neuLagerplatz || '–'}`;

  if (MAIL_SCRIPT_URL) {
    try {
      await sendViaScript({ to: LAGERPLATZ_RECIPIENT, subject, message, filename, mimeType: blob.type, arrayBuffer });
      return { method: 'auto' };
    } catch (err) {
      console.warn('Automatischer Mailversand fehlgeschlagen, Fallback auf Download+mailto:', err.message);
    }
  }
  fallbackDownloadAndMail({ blob, filename, to: LAGERPLATZ_RECIPIENT, subject, message });
  return { method: 'download' };
}

export async function sendVerschrottungMeldung(m) {
  const { doc, filename } = await buildVerschrottungPdf(m);
  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });

  const subject = `Verschrottung – ${m.artikelnummer || 'ohne Artikelnummer'}`;
  const message = `Verschrottung gemeldet von ${m.melder || '–'}.\nArtikel: ${m.artikelnummer || '–'}\nGrund: ${m.grund || '–'}`;

  if (MAIL_SCRIPT_URL) {
    try {
      await sendViaScript({ to: VERSCHROTTUNG_RECIPIENT, subject, message, filename, mimeType: 'application/pdf', arrayBuffer });
      return { method: 'auto' };
    } catch (err) {
      console.warn('Automatischer Mailversand fehlgeschlagen, Fallback auf Download+mailto:', err.message);
    }
  }
  fallbackDownloadAndMail({ blob, filename, to: VERSCHROTTUNG_RECIPIENT, subject, message });
  return { method: 'download' };
}
