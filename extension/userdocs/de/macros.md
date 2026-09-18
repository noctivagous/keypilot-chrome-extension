# Makros

Ein Makro ist eine geordnete Folge von Funktions- und Logikschritten, die an eine einzelne Taste gebunden sind.

## Benutze es

1. Öffnen Sie den **Tastaturlayout-Editor** (<kbd>Alt</kbd>+<kbd>C</kbd>) und gehen Sie zu **Benutzermakros** (siehe *Macro Builder* zur Bearbeitung).
2. Wählen Sie ein Aktienmakro zum Ausprobieren aus oder erstellen Sie Ihr eigenes.
3. Platzieren Sie das Makro wie jede andere Aktion auf einer Tastaturreferenz-Tastenkappe.
4. Drücken Sie diese Taste auf einer Seite – die Schritte werden der Reihe nach ausgeführt, wobei Gates entscheidet, ob er fortfahren möchte.

Zu den Bestandsbeispielen gehören Flows wie **AI Assist**, **Quick Nav** und **Clip & Search**. Wenn Sie ein Standardmakro bearbeiten, wird es in eine Benutzerkopie umgewandelt, die Sie frei anpassen können.

## Referenz

### Konzepte

- **Schritte** – Funktionen (einschließlich Execute JS) und Logikchips
- **Gate** – prüft das vorherige Ergebnis; Sie können die folgenden Schritte überspringen
- **Verzögerung** – optionales Warten zwischen den Schritten
- **Makro ausführen** – ein weiteres Makro verschachteln (Zyklen werden geschützt)

### Aktienmakros

Schreibgeschützte Vorlagen. Speichern/bearbeiten Sie Forks, ein Benutzermakro, das Sie anpassen und frei platzieren können.

### Im Vergleich zu einer einzelnen Funktion

| Verwenden Sie eine Funktion, wenn… | Verwenden Sie ein Makro, wenn… |
| --- | --- |
| Ein Vorgang genügt | Sie benötigen eine Pipeline |
| Parameter bleiben einfach | Sie benötigen Gates/Wartezeiten/verschachtelte Läufe |

### Als nächstes

Öffnen Sie *Macro Builder* zum Erstellen/Bearbeiten/Platzieren von Details und *Execute JS* für Skriptschritte innerhalb von Makros.
