# Modi

KeyPilot verwendet modale Zustände für Vorgänge, die eine kontinuierliche Eingabe erfordern. Die meisten Browsing-Tasten werden gesperrt, während ein Modus aktiv ist; <kbd>Esc</kbd> bricht fast immer ab.

## Benutze es

1. **Normales Surfen** – Verknüpfungen aktiv; Fokusrechtecke zeigen anklickbare Ziele.
2. **Textmodus** – drücken Sie <kbd>F</kbd> in einem Textfeld. Geben Sie normal ein. Drücken Sie <kbd>Esc</kbd> (oder das Exit-Steuerelement in der Tastaturreferenz), wenn Sie fertig sind.
3. **Bildlaufzeile** – drücken Sie <kbd>N</kbd>; Bewegen Sie sich vom Ursprung weg, um zu scrollen. <kbd>N</kbd>, klicken Sie, oder <kbd>Esc</kbd> wird beendet.
4. **Auswahl** – <kbd>H</kbd> oder <kbd>Y</kbd>; <kbd>Esc</kbd> bricht ab.
5. **Löschmodus** – drücken Sie <kbd>Backspace</kbd>, zielen Sie auf ein Element und bestätigen Sie, um es von der Seite zu entfernen; <kbd>Esc</kbd> bricht ab.
6. **Popovers / Omnibox / Layout-Editor** – ihre eigenen Öffnungszustände; <kbd>Esc</kbd> oder die Schließtaste des Tools verwerfen sie.

Wenn Tasten „tot“ erscheinen, befinden Sie sich wahrscheinlich im Textmodus oder einem anderen Modalmodus – drücken Sie einmal <kbd>Esc</kbd> und versuchen Sie es erneut.

## Referenz

### Details zum Textmodus

- Die meisten Tasten zum Durchsuchen des Layouts sind gesperrt, sodass das Tippen sicher ist.
- Ein kurzes Hover-<kbd>F</kbd>-Fenster kann immer noch ein anderes anklickbares Ziel aktivieren, ohne den Textfokus vollständig zu verlassen (Countdown-bewusste Aktivierung).
- Das Erscheinungsbild (T-Quadrat vs. Fadenkreuz, orangefarbener Rand, Beschriftungen) finden Sie unter **Einstellungen → Textmodus**.

### Löschmodus

- Eingegeben mit <kbd>Backspace</kbd> im Standardlayout.
- Sie wählen ein Element visuell aus; Durch die Bestätigung wird dieser DOM-Knoten von der Live-Seite gelöscht (seitenlokal – kein Rückgängigmachen des Browserverlaufs).

### Andere modale Oberflächen

| Oberfläche | Typisch offen | Ausstieg |
| --- | --- | --- |
| Linkvorschau | <kbd>E</kbd> | <kbd>Esc</kbd>, Titelleiste schließen oder erneute Aktion |
| Popover | <kbd>P</kbd> | <kbd>Esc</kbd> / umschalten <kbd>P</kbd> |
| Omnibox | <kbd>L</kbd> / <kbd>Alt</kbd>+<kbd>L</kbd> | <kbd>Esc</kbd> |
| Tastaturlayout-Editor | <kbd>Alt</kbd>+<kbd>C</kbd> | <kbd>Alt</kbd>+<kbd>C</kbd> / schließen |
| Einstellungen / Dokumente / Anleitung | <kbd>'</kbd> / <kbd>Alt</kbd>+<kbd>H</kbd> / Leitfadeneintrag | <kbd>Esc</kbd> |

### Immer verfügbar

<kbd>Alt</kbd>+<kbd>K</kbd> still toggles KeyPilot even when browsing keys are suspended by Text Mode or when the extension was turned off.
