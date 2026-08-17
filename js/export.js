import { downloadBlob, openMailto } from './share.js';

const EXPORT_RECIPIENT = 'muenster@wego-vti.de';

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

// Web-Share liefert keine Möglichkeit, den Empfänger vorzubelegen – da die Meldungen
// immer an dieselbe feste Adresse gehen, wird stattdessen deterministisch die Excel-Datei
// heruntergeladen und ein E-Mail-Entwurf mit vorausgefülltem Empfänger geöffnet. Der Anhang
// muss der Nutzer im Mail-Programm einmal manuell hinzufügen (mailto erlaubt keine Anhänge).
export async function exportMeldungen(meldungen) {
  const wb = buildWorkbook(meldungen);
  const arrayBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const filename = `Lagermeldungen_${stamp}.xlsx`;
  downloadBlob(blob, filename);
  openMailto({
    to: EXPORT_RECIPIENT,
    subject: `Lagermeldungen ${stamp}`,
    body: `${meldungen.length} Lagermeldung(en) im Anhang.\n\nBitte die heruntergeladene Datei "${filename}" an diese Mail anhängen.`,
  });
  return { method: 'download' };
}
