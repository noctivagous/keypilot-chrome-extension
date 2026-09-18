# Systemtasten und Alt-Chrome

Einige Tasten gehören immer zum KeyPilot Chrome. Sie bleiben in integrierten und benutzerdefinierten Layouts verfügbar.

## Benutze es

### Always-on-Systemschicht

Diese Zeichentasten funktionieren auch dann, wenn Ihr benutzerdefiniertes Layout sie leer lässt:

1. Drücken Sie <kbd>Esc</kbd>, um den aktuellen Modus abzubrechen (Textmodus, Auswahl, Bildlaufzeile, viele Popovers).
2. Drücken Sie <kbd>K</kbd> (Rechtshänder) oder <kbd>D</kbd> (Linkshänder), um die **Tastaturreferenz** anzuzeigen oder auszublenden.
3. Drücken Sie <kbd>'</kbd> (Zitat), um **Einstellungen** zu öffnen.

### Alte Chrome-Hotkeys

Halten Sie <kbd>Alt</kbd> gedrückt und drücken Sie:

| Akkord | Aktion |
| --- | --- |
| <kbd>Alt</kbd>+<kbd>K</kbd> | KeyPilot ein-/ausschalten (funktioniert auch, wenn deaktiviert) |
| <kbd>Alt</kbd>+<kbd>J</kbd> | Kontrollstreifen ein-/ausblenden (funktioniert auch bei Deaktivierung) |
| <kbd>Alt</kbd>+<kbd>L</kbd> | Öffnen Sie Omnibox |
| <kbd>Alt</kbd>+<kbd>;</kbd> oder <kbd>Alt</kbd>+<kbd>A</kbd> | Öffnen Sie den Launcher mit fokussierter Suche |
| <kbd>Alt</kbd>+<kbd>[</kbd> / <kbd>Alt</kbd>+<kbd>]</kbd> | Vorherige / nächste Layoutfamilie |
| <kbd>Alt</kbd>+<kbd>C</kbd> | Tastaturlayout-Editor umschalten |
| <kbd>Alt</kbd>+<kbd>H</kbd> | Öffnen Sie diese Dokumentation |
| <kbd>Alt</kbd>+<kbd>I</kbd> | Onboarding-Komplettlösung ein-/ausblenden |

Merken Sie sich <kbd>Alt</kbd>+<kbd>K</kbd>, <kbd>Esc</kbd>, <kbd>K</kbd>, <kbd>'</kbd> und <kbd>Alt</kbd>+<kbd>H</kbd> zuerst – sie entsperren alles andere.

## Referenz

### Systemebene vs. Layoutschlüssel

- **Systemschicht** – <kbd>Esc</kbd>, Tastaturreferenz, Einstellungen. Getrennt von Layoutfamilien definiert.
- **Layout-Tasten** – <kbd>F</kbd>, <kbd>D</kbd>, Bildlauf, Werkzeuge usw. Kommen aus dem aktiven integrierten oder benutzerdefinierten Layout.
- **Alt chrome** – wird vor der normalen Tastenweiterleitung behandelt; werden nicht als gewöhnliche Buchstabenzuweisungen angezeigt.

### Hinweis zur Händigkeit

Bei linkshändigen Layouts wird die Tastaturreferenz nach <kbd>D</kbd> verschoben, damit sie nicht mit dem gespiegelten Activate-Cluster kollidiert. Die Einstellungen bleiben <kbd>'</kbd>.

### Nicht für den täglichen Gebrauch

<kbd>Alt</kbd>+<kbd>D</kbd> toggles a developer shadow-root debug HUD. Skip it unless you are diagnosing rendering.
