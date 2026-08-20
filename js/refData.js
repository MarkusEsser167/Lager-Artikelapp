// Lädt Artikel- und Lagerplatzliste als Vorschlagsquelle für die Formulare.
// Die Dateien liegen als Excel im Repo (data/artikelliste.xlsx, data/lagerplatzliste.xlsx)
// und können dort ausgetauscht werden, ohne dass sich am App-Code etwas ändert – die App
// liest bei jedem Laden die aktuelle Version (Service Worker cached sie zusätzlich für offline).
const ARTIKEL_URL = './data/artikelliste.xlsx';
const LAGERPLATZ_URL = './data/lagerplatzliste.xlsx';
const ARTIKEL_LAGERPLATZ_URL = './data/artikel-lagerplatz.xlsx';

const ARTIKEL_ALIASES = {
  nummer: ['artikelnummer', 'artikel-nr', 'artikelnr', 'nummer', 'artikel', 'material', 'materialnummer'],
  // Mehrere Text-Spalten (z.B. SAP-Kurztext über mehrere Zeilen) werden zu einer
  // Bezeichnung zusammengefügt – parseSheet() sammelt dafür ALLE passenden Spalten.
  bezeichnung: [
    'bezeichnung', 'beschreibung', 'artikelbezeichnung', 'artikeltext', 'kurztext',
    'materialkurztext', 'materialkurztext 2', 'materialkurztext 3',
    'artikelkurztext', 'artikelkurztext 2', 'artikelkurztext 3',
  ],
};
const LAGERPLATZ_ALIASES = {
  code: ['lagerplatz', 'platz', 'code', 'lagerplatz-code', 'lagerplatzcode'],
  bezeichnung: ['bezeichnung', 'bereich', 'zone', 'beschreibung'],
};
// Referenzliste für die Massen-Lagerplatzkorrektur: welcher Artikel steht laut System
// aktuell auf welchem Lagerplatz (z.B. SAP-Export mit zusätzlicher Lagerplatz-Spalte).
const ARTIKEL_LAGERPLATZ_ALIASES = {
  nummer: ARTIKEL_ALIASES.nummer,
  bezeichnung: ARTIKEL_ALIASES.bezeichnung,
  lagerplatz: LAGERPLATZ_ALIASES.code,
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
  const primaryKey = keys[0];
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  // Für jeden Schlüssel ALLE passenden Spalten sammeln (nicht nur die erste) – so werden
  // z.B. mehrzeilige SAP-Kurztexte (Materialkurztext, Artikelkurztext 2, …) automatisch
  // zu einer einzigen Bezeichnung zusammengefügt.
  const colIdxByKey = {};
  keys.forEach((key) => {
    colIdxByKey[key] = header.reduce((acc, h, i) => (aliasMap[key].includes(h) ? [...acc, i] : acc), []);
  });
  // Nur die erste Spalte (z.B. Artikelnummer/Lagerplatz) muss erkannt werden – weitere
  // Spalten wie Bezeichnung sind optional und bleiben sonst einfach leer.
  const headerRecognized = colIdxByKey[primaryKey].length > 0;
  // Ohne erkennbare Kopfzeile wird positionell gelesen (1. Spalte = erster Schlüssel usw.)
  const dataRows = headerRecognized ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const item = {};
      keys.forEach((key, i) => {
        const idxs = headerRecognized ? colIdxByKey[key] : [i];
        item[key] = idxs.map((idx) => String(row[idx] ?? '').trim()).filter(Boolean).join(' ');
      });
      return item;
    })
    .filter((item) => item[primaryKey]);
}

// Die Artikelliste kann mehrere zehntausend Zeilen haben und braucht spürbar Zeit zum
// Parsen – der Promise selbst wird gecacht (nicht erst das Ergebnis), damit gleichzeitige
// Aufrufe (z.B. Startseite + direkt geöffnetes Formular) sich einen Ladevorgang teilen.
let artikelPromise = null;
let lagerplatzPromise = null;
let artikelLagerplatzPromise = null;

export function loadArtikelListe() {
  if (!artikelPromise) {
    artikelPromise = fetchWorkbook(ARTIKEL_URL)
      .then((wb) => parseSheet(wb, ARTIKEL_ALIASES))
      .catch((err) => {
        console.warn('Artikelliste konnte nicht geladen werden:', err.message);
        return [];
      });
  }
  return artikelPromise;
}

export function loadLagerplatzListe() {
  if (!lagerplatzPromise) {
    lagerplatzPromise = fetchWorkbook(LAGERPLATZ_URL)
      .then((wb) => parseSheet(wb, LAGERPLATZ_ALIASES))
      .catch((err) => {
        console.warn('Lagerplatzliste konnte nicht geladen werden:', err.message);
        return [];
      });
  }
  return lagerplatzPromise;
}

export function loadArtikelLagerplatzListe() {
  if (!artikelLagerplatzPromise) {
    artikelLagerplatzPromise = fetchWorkbook(ARTIKEL_LAGERPLATZ_URL)
      .then((wb) => parseSheet(wb, ARTIKEL_LAGERPLATZ_ALIASES))
      .catch((err) => {
        console.warn('Artikel-Lagerplatz-Referenzliste konnte nicht geladen werden:', err.message);
        return [];
      });
  }
  return artikelLagerplatzPromise;
}
