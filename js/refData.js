// Lädt Artikel- und Lagerplatzliste als Vorschlagsquelle für die Formulare.
// Die Dateien liegen als Excel im Repo (data/artikelliste.xlsx, data/lagerplatzliste.xlsx)
// und können dort ausgetauscht werden, ohne dass sich am App-Code etwas ändert – die App
// liest bei jedem Laden die aktuelle Version (Service Worker cached sie zusätzlich für offline).
const ARTIKEL_URL = './data/artikelliste.xlsx';
const LAGERPLATZ_URL = './data/lagerplatzliste.xlsx';

const ARTIKEL_ALIASES = {
  nummer: ['artikelnummer', 'artikel-nr', 'artikelnr', 'nummer', 'artikel'],
  bezeichnung: ['bezeichnung', 'beschreibung', 'artikelbezeichnung', 'artikeltext'],
};
const LAGERPLATZ_ALIASES = {
  code: ['lagerplatz', 'platz', 'code', 'lagerplatz-code', 'lagerplatzcode'],
  bezeichnung: ['bezeichnung', 'bereich', 'zone', 'beschreibung'],
};

async function fetchWorkbook(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`);
  const buf = await res.arrayBuffer();
  return window.XLSX.read(buf, { type: 'array' });
}

function parseSheet(wb, aliasMap) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  const keys = Object.keys(aliasMap);
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const colIdx = {};
  keys.forEach((key) => {
    colIdx[key] = header.findIndex((h) => aliasMap[key].includes(h));
  });
  const headerRecognized = keys.every((key) => colIdx[key] >= 0);
  // Ohne erkennbare Kopfzeile wird positionell gelesen (1. Spalte = erster Schlüssel usw.)
  const dataRows = headerRecognized ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const item = {};
      keys.forEach((key, i) => {
        const idx = headerRecognized ? colIdx[key] : i;
        item[key] = String(row[idx] ?? '').trim();
      });
      return item;
    })
    .filter((item) => item[keys[0]]);
}

let artikelCache = null;
let lagerplatzCache = null;

export async function loadArtikelListe() {
  if (artikelCache) return artikelCache;
  try {
    const wb = await fetchWorkbook(ARTIKEL_URL);
    artikelCache = parseSheet(wb, ARTIKEL_ALIASES);
  } catch (err) {
    console.warn('Artikelliste konnte nicht geladen werden:', err.message);
    artikelCache = [];
  }
  return artikelCache;
}

export async function loadLagerplatzListe() {
  if (lagerplatzCache) return lagerplatzCache;
  try {
    const wb = await fetchWorkbook(LAGERPLATZ_URL);
    lagerplatzCache = parseSheet(wb, LAGERPLATZ_ALIASES);
  } catch (err) {
    console.warn('Lagerplatzliste konnte nicht geladen werden:', err.message);
    lagerplatzCache = [];
  }
  return lagerplatzCache;
}
