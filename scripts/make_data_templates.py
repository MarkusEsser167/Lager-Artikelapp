"""Erzeugt die Vorlage-Excel-Dateien für Artikel- und Lagerplatzliste.

Diese Dateien liegen im Repo unter data/ und werden von der App beim Start geladen
(js/refData.js). Sie können jederzeit direkt in GitHub durch eine aktuelle Version
mit denselben Spaltenüberschriften ersetzt werden (Datei hochladen -> alte ersetzen),
ohne dass am App-Code etwas geändert werden muss.
"""
from openpyxl import Workbook

def make_artikelliste(path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Artikel"
    ws.append(["Artikelnummer", "Bezeichnung"])
    ws.append(["ART-10001", "Sechskantschraube M8x40"])
    ws.append(["ART-10002", "Kabelbinder 200mm schwarz"])
    ws.append(["ART-10003", "Arbeitshandschuhe Gr. L"])
    wb.save(path)

def make_lagerplatzliste(path):
    # Nur zur Referenz – data/lagerplatzliste.xlsx enthält inzwischen die echte
    # Liste (eine Spalte "Lagerplatz", ohne Bezeichnung). Nicht überschreiben.
    wb = Workbook()
    ws = wb.active
    ws.title = "Lagerplaetze"
    ws.append(["Lagerplatz"])
    ws.append(["A-01-01"])
    ws.append(["A-01-02"])
    ws.append(["B-05-01"])
    wb.save(path)

make_artikelliste("data/artikelliste.xlsx")
print("done (lagerplatzliste.xlsx enthält bereits echte Daten und wird hier nicht neu erzeugt)")
