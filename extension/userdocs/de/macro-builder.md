# Makro-Builder

Macro Builder ist der Schritteditor für Benutzermakros, auf den über den Tastaturlayout-Editor zugegriffen werden kann.

## Benutze es

1. Drücken Sie <kbd>Alt</kbd>+<kbd>C</kbd>, um den Layout-Editor zu öffnen.
2. Öffnen Sie **Benutzermakros**.
3. **Erstellen** Sie ein Makro und geben Sie ihm einen eindeutigen Namen – oder duplizieren Sie ein vorhandenes.
4. Schritte hinzufügen:
   - Wählen Sie eine Funktion in der Aktionsbibliothek aus und fügen Sie sie dem Makro hinzu
   - Fügen Sie **Logik**-Chips hinzu: Warten, Tor, Stopp, Makro ausführen
   - Fügen Sie **Textbereich abrufen** hinzu, um die aktuelle Auswahl für den nächsten Schritt zu erfassen
   - Fügen Sie **Popover anzeigen** hinzu, um das Ergebnis des vorherigen Schritts (oder Ersatztext) anzuzeigen.
   - Fügen Sie **Execute JS** hinzu, um ein eingefügtes Skript auszuführen
5. Schritte neu anordnen oder entfernen; Öffnen Sie einen Schritt zum Festlegen von Parametern und optionaler Verzögerung.
6. **Speichern** und platzieren Sie dann das Makro auf einer Taste aus der Bibliothek/Makroliste.
7. Testen Sie auf einer normalen Seite. Verfeinern Sie Gates, wenn der Strom frühzeitig aussteigen sollte.

## Referenz

### Logikchips

| Chip | Rolle |
| --- | --- |
| **Warte** | Pause vor dem nächsten Schritt |
| **Tor** | Vorheriges Ergebnis testen; Bei Fehler überspringen Sie die folgenden Schritte |
| **Stopp** | Beenden Sie das Makro |
| **Makro ausführen** | Rufen Sie ein anderes Makro auf (verschachtelt; zyklusgeschützt) |
| **JS ausführen** | Führen Sie ein eingefügtes Skript aus. Rückgabewert speist das nächste Gate |
| **Textbereich abrufen** | Erfassen Sie die aktuelle Markierung/Auswahl für den nächsten Schritt. Keine Schlüsselaktion (Kopieren verwenden). |
| **Popover anzeigen** | Zeigt das vorherige Funktionsergebnis (oder den konfigurierten Fallback-Text) in einem Popover an. Keine Schlüsselaktion. |

### Tortests

Typische Vergleiche mit dem vorherigen Funktionsergebnis:

- Hat Wert/leer
- Gleich / ungleich
- Größer als / kleiner als

Fehlgeschlagene Gates springen wie konfiguriert weiter, sodass Sie ohne vollständige Skripterstellung verzweigen können.

### Makrotasten als Schritte

Konfigurierte Tastenanschlagsprimitive (Hotkey, Burst, Round-Robin, kontinuierlich, synthetische Maus, normale Neuzuordnung) können sowohl als Makrofunktionsschritte als auch als eigenständige Tastenaktionen ausgeführt werden.

### Tipps

- Halten Sie Makros kurz und benennen Sie die Schritte nach Absicht.
- Bevorzugen Sie Gates gegenüber langen bedingungslosen Ketten, wenn ein Schritt möglicherweise nichts bringt.
- Execute JS-Rückgabewerte speisen das nächste Gate über `kpPriorResult` (siehe *Execute JS*).
