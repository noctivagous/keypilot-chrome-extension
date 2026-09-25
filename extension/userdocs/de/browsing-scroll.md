# Scrollen

Scrollen Sie mit festen Schritten, Sprüngen oder kontinuierlicher Bildlaufliniensteuerung durch die Seite oder verschachtelte Scroller unter dem Cursor.

## Benutze es

1. Zeigen Sie auf die Seite (oder in einen scrollbaren Bereich).
2. Verwenden Sie **Seite nach oben** und **Seite nach unten**, um um den konfigurierten Abstand zu scrollen.
3. Verwenden Sie **Nach oben scrollen**, um zum Anfang des Bildlaufziels zu springen; **Scrollen Sie nach unten** für das Ende.
4. Für eine kontinuierliche Steuerung verwenden Sie **Bildlaufzeile**:
   - Unter dem Cursor erscheint eine Ursprungsmarkierung.
   - Bewegen Sie die Maus vom Ursprung weg – weiter bedeutet schnelleres Scrollen.
   - Verwenden Sie **Bildlaufzeile** erneut, klicken Sie oder drücken Sie <kbd>Esc</kbd>, um den Vorgang zu beenden.
5. Aktivieren Sie optional **Mittelklick auf leeren Seitenbereich** in Einstellungen → Scrollen, um die Bildlaufzeile ohne die Bildlaufzeile-Taste zu starten.
6. Verwenden Sie **Verkleinern** (<kbd>[</kbd>) und **Vergrößern** (<kbd>]</kbd>), um den Tab um eine Browser-Zoomstufe zu ändern. Der Punkt unter dem Cursor bleibt fest, wie bei einer Pinch-Geste.

Passen Sie Schrittgröße und Animation unter **Einstellungen → Scrollen** an.

## Referenz

### Funktionen

| Funktion | Wirkung |
| --- | --- |
| **Seite nach oben** | Um den konfigurierten Sofortabstand nach oben scrollen |
| **Seite nach unten** | Um den konfigurierten Sofortabstand nach unten scrollen |
| **Nach oben scrollen** | Zum Anfang des Bildlaufziels springen |
| **Scrollen Sie nach unten** | Zum Ende des Bildlaufziels springen |
| **Bildlaufzeile** | Ursprungsbasiertes kontinuierliches Scrollen umschalten |
| **Verkleinern** | Tab am Cursor um eine Stufe verkleinern |
| **Vergrößern** | Tab am Cursor um eine Stufe vergrößern |

Die Standardtasten für diese Funktionen hängen vom aktiven Tastaturlayout ab.

### Einstellungen, die wichtig sind

- **Scrolldistanz** für Seite nach oben / Seite nach unten
- **Glatte vs. sofortige** Animation für Sprünge
- **Überspringen Sie breite karussellartige Scroller** in der Bildlaufzeile
- **Klicken Sie mit der mittleren Maustaste**, um die Bildlauflinie im leeren Seitenbereich zu starten

### Scrollziel

KeyPilot scrollt die Seite oder den verschachtelten Scroller unter dem Cursor. Wenn Bildlaufzeile den falschen Bereich erfasst, beenden Sie den Vorgang, positionieren Sie den Zeiger neu und verwenden Sie dann **Bildlaufzeile** erneut.
