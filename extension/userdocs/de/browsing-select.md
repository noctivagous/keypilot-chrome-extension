# Auswahl

Wählen Sie Text- oder HTML-Elemente unter dem Cursor aus und kopieren Sie das Ergebnis oder bearbeiten Sie es.

## Benutze es

### Textauswahl

1. Bewegen Sie den Cursor an die Stelle, an der die Auswahl beginnen soll.
2. Drücken Sie <kbd>H</kbd>, um mit der Textauswahl auf Zeichenebene zu beginnen.
3. Gehen Sie zum Ende des Bereichs und drücken Sie erneut <kbd>H</kbd>, um den Vorgang abzuschließen und zu kopieren.
4. Drücken Sie <kbd>Esc</kbd>, um den Vorgang ohne Kopieren abzubrechen.

Bei der Textauswahl handelt es sich um eine Cursor-zu-Caret-Bewegung (wie Klicken und Ziehen), nicht um einen Ausschnitt des gestrichelten Rechtecks. Das Rechteck ist eine Ziehhilfe: Der kopierte Bereich umfasst alles in der Dokumentreihenfolge zwischen dem Start- und End-Caret.

Das Kopierformat (Rich- oder Nur-Text) kann in der Aktionsinstanz der Textauswahlfunktion konfiguriert werden.

### Elementauswahl

1. Drücken Sie <kbd>Y</kbd>, um mit der Rechteckauswahl sich überschneidender HTML-Elemente zu beginnen.
2. Ziehen Sie das Rechteck über die gewünschten Elemente und passen Sie es an.
3. Schließen Sie die Auswahl gemäß den Anweisungen auf dem Bildschirm ab (oder verwenden Sie den kumulativen Auswahlmodus, falls konfiguriert).
4. Drücken Sie <kbd>Esc</kbd>, um abzubrechen.

Die Standardgranularität ist eine Artikelmerkmalseinheit: ein Absatz oder eine Überschrift, eine ganze Tabelle (nicht einzelne Zellen), eine ganze Abbildung oder ein ganzes Bild (nicht das innere Bild), eine ganze Liste. Durch Klicken auf einen Link innerhalb eines Absatzes wird dieser Absatz sofort ausgewählt. Überlappung verwendet die Linienrahmen jedes Elements, nicht einen Begrenzungsrahmen.

## Referenz

### Standardtasten (Browsen, Rechtshänder)

| Schlüssel | Aktion |
| --- | --- |
| <kbd>H</kbd> | Textauswahl (Start/Ende + Kopieren) |
| <kbd>Y</kbd> | Rechteck-Elemente auswählen (oder kumulativer Auswahlmodus) |
| <kbd>Esc</kbd> | Auswahlmodi abbrechen |

### Modi für <kbd>Y</kbd>

- **Rechteck** – Wählen Sie Artikelmerkmalseinheiten aus, deren Linienkästen ein gezeichnetes Rechteck (Absatz, Tabelle, Abbildung, Liste) schneiden. Ein Link innerhalb eines Absatzes wählt den Absatz aus.
- **Kumulative Auswahl** – Elemente einzeln hinzufügen und mit <kbd>Enter</kbd> abschließen (in der Funktion konfiguriert).

### Verwandte Tools

- <kbd>I</kbd> / <kbd>U</kbd> schwebendes Bild/URL kopieren (siehe *Unter Cursor kopieren*).
- <kbd>O</kbd> öffnet Seitenmedien für alles, was auf der Seite gefunden wird.
- Ziele in der Zwischenablage und in der Medienbibliothek werden in vielen Funktionen zum Abrufen/Kopieren im Layout-Editor angezeigt.

## Einheitenauswahl (Zwischenablage)

Platzieren Sie **Wort auswählen**, **Satz auswählen**, **Absatz auswählen** oder **Bild auswählen** aus dem Abschnitt „Zwischenablage“ der Aktionsbibliothek. Diese selektieren ohne Kopieren unter dem KeyPilot-Cursor.

1. Bewegen Sie den Mauszeiger über das Wort, den Satz, den Absatz oder das Bild.
2. Drücken Sie die gebundene Taste, um es auszuwählen. Drücken Sie erneut auf dieselbe Einheit, um sie abzuwählen.
3. Verwenden Sie **Kopieren** (oder Ausschneiden), um die KeyPilot-Auswahl in die Zwischenablage zu senden.
4. Drücken Sie <kbd>Esc</kbd>, um die Auswahl zu löschen.

Jede Funktion zeigt „Exklusiv“/„Kumulativ“ in ihrem Tastaturreferenz-Tasteninformations-Popover an (gemeinsam für diese Funktion, nicht für eine Aktionsinstanz pro Taste).

- **Exklusiv** (Standard) – die Drucktaste ersetzt die aktuelle Auswahl.
- **Kumulativ** – Einheiten hinzufügen oder entfernen; Disjunkte Bereiche bleiben hervorgehoben.

KeyPilot malt seine eigene Hervorhebung, sodass Lücken in der Auswahl sichtbar bleiben. Dies ist unabhängig von der Drag-Auswahl <kbd>H</kbd> / <kbd>Y</kbd>.
