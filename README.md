# Lagermeldungen

Progressive Web App für Lagertablets: Meldung von Lagerplatzänderungen und Verschrottungen.

## Funktionen

- **Lagerplatzänderung melden** – Artikelnummer, bisheriger/neuer Lagerplatz, Menge, Bemerkung
- **Verschrottung melden** – Artikelnummer, Lagerplatz, Grund, Foto, Bemerkung
- Artikelnummer & Lagerplatz per Barcode-/QR-Scan über die Tablet-Kamera erfassbar (Fallback: manuelle Eingabe)
- Meldungen werden lokal auf dem Tablet gespeichert (IndexedDB) und sind offline nutzbar
- Sammel-Export offener Meldungen als Excel-Datei, per E-Mail-Entwurf an eine feste Adresse

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
