// Lädt Artikel- und Lagerplatzliste als Vorschlagsquelle für die Formulare.
// Die Dateien liegen als Excel im Repo (data/artikelliste.xlsx, data/lagerplatzliste.xlsx)
// und können dort ausgetauscht werden, ohne dass sich am App-Code etwas ändert – die App
// liest bei jedem Laden die aktuelle Version (Service Worker cached sie zusätzlich für offline).
const ARTIKEL_URL = './data/artikelliste.xlsx';
const LAGERPLATZ_URL = './data/lagerplatzliste.xlsx';
const ARTIKEL_LAGERPLATZ_URL = './data/artikel-lagerplatz.xlsx';
const MITARBEITER_URL = './data/mitarbeiter.xlsx';

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
// Bewusst kuratierte Teilmenge NUR für den Teilstring-Fallback (siehe parseSheet): erkennt
// Kopfzeilen wie "FIS/wms®  Lagerplatz", die "Lagerplatz" nicht exakt, aber als Wortteil
// enthalten. Absichtlich OHNE die generischen, kurzen Aliase wie "artikel"/"material"/"code" -
// die kollidieren sonst mit Spalten wie "Artikelkurztext 2" oder "Materialart".
const LOOSE_ALIASES = {
  code: ['lagerplatz'],
  lagerplatz: ['lagerplatz'],
};
// Mitarbeiterliste für die "Gemeldet von"-Auswahl (kein Freitext mehr möglich).
const MITARBEITER_ALIASES = {
  name: ['name', 'mitarbeiter', 'melder', 'benutzer'],
};

async function fetchWorkbook(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} nicht gefunden (${res.status})`);
  const buf = await res.arrayBuffer();
  return window.XLSX.read(buf, { type: 'array' });
}

function parseSheet(wb, aliasMap, looseAliasMap = {}) {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) return [];

  const keys = Object.keys(aliasMap);
  const primaryKey = keys[0];
  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  // Für jeden Schlüssel ALLE passenden Spalten sammeln (nicht nur die erste) – so werden
  // z.B. mehrzeilige SAP-Kurztexte (Materialkurztext, Artikelkurztext 2, …) automatisch
  // zu einer einzigen Bezeichnung zusammengefügt.
  //
  // Jede Spalte wird höchstens einem Schlüssel zugeordnet, in zwei Durchgängen: zuerst exakte
  // Treffer gegen aliasMap, erst danach Teilstring-Treffer gegen die viel engere looseAliasMap
  // (z.B. nur "lagerplatz", für Kopfzeilen wie "FIS/wms®  Lagerplatz"). Generische Aliase wie
  // "artikel"/"material"/"code" werden bewusst NIE als Teilstring geprüft – sonst würde z.B.
  // "artikel" fälschlich auch in "Artikelkurztext 2" matchen, obwohl die Spalte exakt zur
  // Bezeichnung gehört, und die Artikelnummer würde die komplette Beschreibung mit enthalten.
  const colIdxByKey = {};
  keys.forEach((key) => { colIdxByKey[key] = []; });
  const claimed = new Array(header.length).fill(false);

  header.forEach((h, i) => {
    if (!h) return;
    const key = keys.find((k) => aliasMap[k].includes(h));
    if (key) {
      colIdxByKey[key].push(i);
      claimed[i] = true;
    }
  });
  header.forEach((h, i) => {
    if (claimed[i] || !h) return;
    const key = keys.find((k) => (looseAliasMap[k] || []).some((alias) => h.includes(alias)));
    if (key) {
      colIdxByKey[key].push(i);
      claimed[i] = true;
    }
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
let mitarbeiterPromise = null;

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
      .then((wb) => parseSheet(wb, LAGERPLATZ_ALIASES, LOOSE_ALIASES))
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
      .then((wb) => parseSheet(wb, ARTIKEL_LAGERPLATZ_ALIASES, LOOSE_ALIASES))
      .catch((err) => {
        console.warn('Artikel-Lagerplatz-Referenzliste konnte nicht geladen werden:', err.message);
        return [];
      });
  }
  return artikelLagerplatzPromise;
}

// Gibt eine einfache Liste von Namen zurück (nicht Objekte wie die anderen Listen), da sie
// direkt als <select>-Optionen für die "Gemeldet von"-Auswahl verwendet wird.
export function loadMitarbeiterListe() {
  if (!mitarbeiterPromise) {
    mitarbeiterPromise = fetchWorkbook(MITARBEITER_URL)
      .then((wb) => parseSheet(wb, MITARBEITER_ALIASES).map((item) => item.name))
      .catch((err) => {
        console.warn('Mitarbeiterliste konnte nicht geladen werden:', err.message);
        return [];
      });
  }
  return mitarbeiterPromise;
}
