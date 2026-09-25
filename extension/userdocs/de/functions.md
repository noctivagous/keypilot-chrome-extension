# Funktionen und Aktionen

Funktionen sind die Bausteine, die Sie an Tasten binden. Eine **Aktionsinstanz** ist eine Funktion plus gespeicherte Parameterwerte.

## Benutze es

1. Öffnen Sie den **Tastaturlayout-Editor** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Durchsuchen oder durchsuchen Sie die **Aktionsbibliothek** (Karten- oder Tabellenansicht).
3. Wählen Sie eine Funktion aus. Wenn es Parameter hat, erstellen oder bearbeiten Sie eine **Aktionsinstanz** (benennen Sie sie klar).
4. Klicken Sie auf eine Tastaturreferenz-Tastenkappe, um diese Instanz zu platzieren.
5. Drücken Sie die Taste auf einer normalen Seite, um sie auszuführen.

Um das Verhalten später zu ändern, bearbeiten Sie die Parameter der Instanz in Config – jeder Schlüssel, der diese Instanz verwendet, übernimmt die Änderung.

## Referenz

### Konzepte

| Begriff | Bedeutung |
| --- | --- |
| **Funktion** | Wiederverwendbare Operationsdefinition |
| **Aktionsinstanz** | Funktion + gespeicherte Parameter |
| **Schlüsselaktion** | Was einen Slot belegt – Funktion/Instanz oder Makro |
| **Ergebnisziel** | Zwischenablage, Popover, Seitenwechsel, Medienbibliothek usw. |

### Bibliothekskategorien (Übersicht)

Navigation · Tab-Steuerung · Start-URL · Seitendaten abrufen · Karten · Scrollen · Auswählen · Zwischenablage · Geben · Tastenanschläge · Daten · Nachschlagen · Übersetzen · Skript · Medienbibliothek · KI · KeyPilot · Tools · System

### Bemerkenswerte Funktionen

<h3 id="type-characters">Type Characters</h3>

Fügen Sie gespeicherten Text in das fokussierte Feld ein. Binden Sie es mit einem Modifikatorakkord, damit es beim Tippen ausgeführt werden kann. Erstellen Sie eine Aktionsinstanz pro Snippet.

<h3 id="open-urls">URLs öffnen</h3>

Öffnet eine gespeicherte Liste von Websites in Hintergrund-Tabs. Legen Sie pro Seitengruppe eine Aktionsinstanz an und bearbeiten Sie die URL-Liste im Inspektor des Tastaturlayout-Editors. Siehe [Tabs & Verlauf](kp://docs/browsing-tabs#open-urls).

<h3 id="font-info">Font Info</h3>

Popover mit Familie, Größe, Dateityp und Download-URL für den gestalteten Text unter dem Cursor sowie einer Gliederung dieses Textverlaufs.

<h3 id="lookup-word">Lookup Word</h3>

Kostenlose Wörterbuch-API-Definition für das Wort unter dem Cursor. Optional AI-Quelle auf der Aktionsinstanz fragen, wann dieser Pfad verfügbar ist.

<h3 id="translate">Translate</h3>

Übersetzen Sie die Hervorhebung oder das Wort/den Satz/den Absatz unter dem Cursor. Ziel kann Seitentext ersetzen oder ein Popover öffnen.

<h3 id="send-text-to-ai">Send selection to AI</h3>

Sendet ausgewählten Text mit einer konfigurierbaren Anweisung. Leiten Sie das Ergebnis an die Zwischenablage, ein Popover oder beides weiter.

<h3 id="get-text-at-cursor">Get text / media under cursor</h3>

**Text am Cursor abrufen** kopiert Wort-, Satz-, Absatz- oder Hyperlinktext. **Medien am Cursor abrufen** kopiert Bilder, Videos oder Audiodaten unter dem Cursor. **Textbereich abrufen** ist ein Makroschritt, der die aktuelle Markierung an den nächsten Schritt übergibt.

<h3 id="show-popover">Show Popover</h3>

Makroschritt, der das Ergebnis (oder den Fallback-Text) des vorherigen Schritts in einem Ergebnis-Popover anzeigt.

<h3 id="poi">Map place (POI)</h3>

Wenn sich eine Kartennadel unter dem Cursor befindet: **Website platzieren** öffnet die Ortsseite in der Linkvorschau; **Ortsadresse** kopiert die Straßenadresse (txt oder vCard).

<h3 id="media-library-functions">Add / Fetch URL for Media Library</h3>

**URL hinzufügen** speichert die hover-href, ohne sie herunterzuladen. **URL abrufen** lädt die verknüpfte Datei (PDF, Audio, Video, Bild) in die Medienbibliothek herunter.

<h3 id="execute-js">Execute JS</h3>

Benutzerdefinierte Skriptfunktion. Vollständige Bindungen, Rückrufe und eine KI-Eingabeaufforderung: [JS](kp://docs/execute-js) ausführen.

<h3 id="keystrokes">Macro Keys (keystrokes)</h3>

Hotkey, Burst, Round-Robin, Dauertaste, synthetische Maus und Remaps – instanziierbare Tastenanschlagfunktionen in der Aktionsbibliothek. Siehe [Tastaturlayout-Editor](kp://docs/layout-config).

### Bestand vs. Benutzer

Integrierte Layouts sind schreibgeschützte Quellen; Durch die Bearbeitung entsteht eine Benutzerkopie, die Sie besitzen.
