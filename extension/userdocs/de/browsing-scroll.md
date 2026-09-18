# Scrollen

Scrollen Sie mit festen Schritten, Sprüngen oder kontinuierlicher Bildlaufliniensteuerung durch die Seite oder verschachtelte Scroller unter dem Cursor.

## Benutze es

1. Zeigen Sie auf die Seite (oder in einen scrollbaren Bereich).
2. Drücken Sie <kbd>C</kbd>, um nach oben zu scrollen, und <kbd>V</kbd>, um um den konfigurierten Abstand nach unten zu scrollen.
3. Drücken Sie <kbd>Z</kbd>, um zum oberen Rand des Bildlaufziels zu springen. <kbd>X</kbd> für die Unterseite.
4. Für eine kontinuierliche Steuerung drücken Sie <kbd>N</kbd>, um **Scroll Line** zu starten:
   - Unter dem Cursor erscheint eine Ursprungsmarkierung.
   - Bewegen Sie die Maus vom Ursprung weg – weiter bedeutet schnelleres Scrollen.
   - Drücken Sie erneut <kbd>N</kbd>, klicken Sie oder drücken Sie <kbd>Esc</kbd>, um den Vorgang zu beenden.
5. Aktivieren Sie optional **Mittelklick auf leeren Seitenbereich** in Einstellungen → Scrollen, um die Bildlaufzeile ohne <kbd>N</kbd> zu starten.

Passen Sie Schrittgröße und Animation unter **Einstellungen → Scrollen** an.

## Referenz

### Standardtasten (Browsen, Rechtshänder)

| Schlüssel | Aktion |
| --- | --- |
| <kbd>C</kbd> | Nach oben scrollen (sofortiger Abstand) |
| <kbd>V</kbd> | Nach unten scrollen (sofortiger Abstand) |
| <kbd>Z</kbd> | Zum Anfang des Bildlaufziels springen |
| <kbd>X</kbd> | Zum Ende des Bildlaufziels springen |
| <kbd>N</kbd> | Scrollzeilenmodus umschalten |

### Einstellungen, die wichtig sind

- **Scrolldistanz** für <kbd>C</kbd> / <kbd>V</kbd>
- **Glatte vs. sofortige** Animation für Sprünge
- **Überspringen Sie breite karussellartige Scroller** in Scroll Line
- **Klicken Sie mit der mittleren Maustaste**, um die Bildlauflinie im leeren Seitenbereich zu starten

### Scrollziel

KeyPilot scrollt die Seite oder den verschachtelten Scroller unter dem Cursor. Wenn Scroll Line den falschen Bereich erfasst, beenden Sie den Vorgang, positionieren Sie den Zeiger neu und drücken Sie dann erneut <kbd>N</kbd>.
