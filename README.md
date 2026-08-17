# Lagermeldungen

Progressive Web App für Lagertablets: Meldung von Lagerplatzänderungen und Verschrottungen.

## Funktionen

- **Lagerplatzänderung melden** – Artikelnummer, bisheriger/neuer Lagerplatz, Menge, Bemerkung
- **Verschrottung melden** – Artikelnummer, Lagerplatz, Grund, Foto, Bemerkung
- Artikelnummer & Lagerplatz per Barcode-/QR-Scan über die Tablet-Kamera erfassbar, mit Suche/Vorschlagsliste aus hinterlegten Listen (Fallback: manuelle Eingabe)
- Meldungen werden lokal auf dem Tablet gespeichert (IndexedDB) und sind offline nutzbar
- Sammel-Export offener Meldungen als Excel-Datei, per E-Mail-Entwurf an eine feste Adresse

## Artikel- und Lagerplatzliste aktualisieren

Die Vorschlagslisten für die Formulare liegen als Excel-Dateien im Repo:

- `data/artikelliste.xlsx` – SAP-Exportformat, Spalten `Material` (Artikelnummer) + beliebig viele
  Text-Spalten (`Materialkurztext`, `Artikelkurztext 2`, `Materialkurztext 3`, …), die automatisch zu
  einer Bezeichnung zusammengefügt werden. Aktuell ca. 153.000 Artikel.
- `data/lagerplatzliste.xlsx` – Spalte `Lagerplatz` (eine `Bezeichnung`-Spalte ist optional, wird aber
  aktuell nicht mitgeführt). Aktuell 234 Plätze.

Erkannt werden außerdem die gängigen deutschen Varianten (`Artikelnummer`, `Bezeichnung`, `Beschreibung`
usw.) – siehe `js/refData.js`. Nur die erste Spalte (Nummer/Platz) muss über einen dieser Namen erkennbar
sein, weitere Spalten sind optional.

Um eine Liste zu aktualisieren: auf GitHub in den Ordner `data/` gehen, die jeweilige Datei öffnen und über
„Upload file“ durch eine neue Version mit denselben (oder erkennbaren) Spaltenüberschriften ersetzen
(Commit direkt im Browser). Es ist **keine Code-Änderung** nötig – die App liest beim nächsten Laden
automatisch die aktuelle Version. Tablets, die offline sind, nutzen bis zur nächsten Online-Verbindung
weiterhin die zuletzt geladene Version.

## Installation auf einem Tablet

1. Diese App über GitHub Pages öffnen (Chrome auf Android)
2. Menü → „Zum Startbildschirm hinzufügen“
3. Die App läuft danach wie eine installierte App, auch offline

## Entwicklung

Kein Build-Prozess nötig – reines HTML/CSS/JS. Lokal starten:

```
python -m http.server 8421
```

Danach `http://localhost:8421` öffnen.
