# Tastaturlayout-Editor

Der Layout-Editor dient für benutzerdefinierte Tastaturbelegungen: Platzieren Sie Funktionen auf Tasten, erstellen Sie Layouts und verwalten Sie Aktionsinstanzen.

## Benutze es

![Keyboard Layout Editor](images/layout-config.png)

1. Drücken Sie <kbd>Alt</kbd>+<kbd>C</kbd> oder wählen Sie **Tastaturlayout bearbeiten…** aus der Dropdown-Liste „Tastaturreferenz“.
2. Die Tastaturreferenz wird zur Platzierungsoberfläche; Das Konfigurationsfenster enthält die Aktionsbibliothek und Layout-Tools.
3. **Layout erstellen oder auswählen** – Durch das Bearbeiten eines integrierten Elements wird eine Benutzerkopie erstellt (integrierte Elemente bleiben schreibgeschützt).
4. Suchen Sie eine Aktion (durchsuchen Sie die Bibliothek), wählen Sie sie aus und **klicken Sie dann auf eine Tastenkappe** in der Tastaturreferenz, um sie zu platzieren.
5. Ersetzen oder löschen Sie vorhandene benutzerdefinierte Steckplätze nach Bedarf.
6. Legen Sie das Layout als aktuell fest, wenn Sie damit browsen möchten.
7. Drücken Sie erneut <kbd>Alt</kbd>+<kbd>C</kbd> oder schließen Sie das Bedienfeld, wenn Sie fertig sind.

Ebenfalls im Dropdown-Menü verfügbar: **Neues leeres Tastaturlayout** und **Neues doppeltes Tastaturlayout**.

## Referenz

### Layoutverwaltung

- Benutzerlayouts umbenennen, löschen und duplizieren
- Benutzerdefinierte Layouts als JSON importieren/exportieren
- Wechseln Sie, welches Layout bearbeitet wird und welches aktuell ist

### Platzierungsregeln

- Benutzerdefinierte Layouts sind **exklusiv**: nur zugewiesene Tasten plus die ständige Ausführung der Systemebene.
- Parametrisierte Funktionen werden zu **Aktionsinstanzen** mit gespeicherten Einstellungen (Beschriftung, Ziele, Skripttext usw.).
- Einige Funktionen (z. B. Typzeichen) binden möglicherweise nur an **Modifikatorakkorde**, nicht an bloße Buchstabentasten, sodass sie während der Eingabe ausgeführt werden können.

### Tipps

- Lassen Sie die Tastaturreferenz beim Platzieren sichtbar – bewegen Sie zur Bestätigung den Mauszeiger über die Tastenkappen.
- Beginnen Sie mit „Duplicate of Browsing“, wenn Sie nur wenige Änderungen wünschen.
- Was Sie platzieren können, finden Sie unter *Funktionen & Aktionen* und *JS ausführen*.
