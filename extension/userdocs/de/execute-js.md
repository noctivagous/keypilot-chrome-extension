# JS ausführen

Execute JS ist eine Skriptfunktion, die Sie an eine Taste binden, wenn eine integrierte Funktion nicht ausreicht. Sie fügen ein JavaScript-Snippet ein; KeyPilot führt es aus, wenn diese Taste gedrückt wird.

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">Prompt for an AI chat — paste this, then finish the first sentence with what you want the script to do.</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">I would like JavaScript code for KeyPilot, a Chrome extension, and I want it to …

Hier erfahren Sie, wie KeyPilot funktioniert und was es ist.

KeyPilot ist eine Chrome-Erweiterung für tastaturgesteuertes Surfen: Sie zeigen mit der Maus und lösen Aktionen mit Tasten aus. Funktionen (wiederverwendbare Vorgänge) sind im Tastaturlayout-Editor (Alt+C) an Tasten gebunden. Execute JS ist eine Funktion, deren Aktionsinstanz ein eingefügtes Skript enthält. Wenn die Taste gedrückt wird, führt KeyPilot dieses Skript aus.

Schreiben Sie ein vollständiges Skript, das ich in das Feld „JS-Skript ausführen“ einfügen kann. Schließen Sie es nicht in eine Funktionsdeklaration ein – das Snippet ist bereits der Hauptteil einer asynchronen Funktion.

Laufzeitregeln:
- Isolierte Welt (Inhaltsskript): DOM-APIs funktionieren (Dokument, querySelector, Element). Die eigenen JavaScript-Globals der Seite (React-, jQuery-, App-`window`-Eigenschaften) sind nicht sichtbar.
- Keine chrome.*-APIs, keine KeyPilot-Instanz, keine Speicher-APIs.
- Sie können „await“ verwenden. Das harte Timeout beträgt 8 Sekunden.
- Geben Sie einen Wert zurück, wenn es sich um einen Makroschritt handelt (der nächste Schritt sieht ihn als kpPriorResult).

Bindungen werden immer injiziert (möglicherweise null/undefiniert):
- kpHoveredClickable – Element, das KeyPilot derzeit als schwebendes anklickbares Element (Link/Schaltfläche) oder als Null behandelt
- kpHoverLeaf – tiefstes Element unter dem Cursor oder null
- kpFocusedTextField – fokussiertes Textfeld / contenteditable oder null
- kpMode – String-Modus: „none“ | „Inspektor“ | „text_focus“ | „hervorheben“ | "scroll_line" | „Popover“ | „Omnibox“
- kpPageUrl – URL-String der aktuellen Seite
- kpSelection – window.getSelection() (Auswahl-API) oder null
- kpPriorResult – Ergebnis des vorherigen Makroschritts (nur wenn dieses Skript als Makroschritt ausgeführt wird)

Rückrufe sind nur vorhanden, wenn das entsprechende Kontrollkästchen in der Aktionsinstanz aktiviert ist. andernfalls sind sie undefiniert. Bewachen Sie mit `if (typeof showPopover === "function")`.
- wait showPopover(content, title?) – Ergebnis-Popover; Inhalt ist stringifiziert (Objekte → JSON)
- wait copyToClipboard(content) – kopiert stringifizierten Text; gibt einen booleschen Wert zurück
- notify(message) – kurze Flash-Benachrichtigung

Bitte geben Sie nur den Skripttext aus.</pre>
<p class="muted">Copy the prompt, then finish the first sentence in the AI chat after you paste.</p>
</div>

## Benutze es

1. Öffnen Sie den **Tastaturlayout-Editor** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Erstellen Sie eine neue Aktionsinstanz **Execute JS** in der Aktionsbibliothek.
3. Fügen Sie Ihr Skript in **Script** ein.
4. Aktivieren Sie alle **Rückrufe**, die Sie aufrufen (`showPopover`, `copyToClipboard`, `notify`).
5. Platzieren Sie die Instanz auf einem Schlüssel.
6. Drücken Sie die Taste auf einer Seite, um sie auszuführen.

Skripte werden in der **inhaltsskriptisolierten Welt** ausgeführt. Es gibt eine Zeitüberschreitung von **8 Sekunden**.

## Bindungen immer vorhanden

Bei jedem Lauf werden diese Namen als Parameter der asynchronen Funktion eingefügt, die Ihr Snippet umschließt. Es handelt sich um **keine** globalen Werte, die Sie deklarieren müssen.

| Bindung | Geben Sie | ein Bedeutung |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | Der anklickbare KeyPilot wird unter dem Cursor hervorgehoben (dasselbe Ziel-Klickelement würde aktiviert). `null`, wenn nichts Anklickbares angezeigt wird. |
| `kpHoverLeaf` | `Element \| null` | Der tiefste DOM-Knoten unter dem Cursor (Text, Bild oder verschachteltes Element), auch wenn es sich nicht um einen anklickbaren KeyPilot handelt. |
| `kpFocusedTextField` | `Element \| null` | Die fokussierte Texteingabe, Textbereich oder `contenteditable`, wenn KeyPilot Sie bei der Texteingabe berücksichtigt. `null`, wenn kein Feld fokussiert ist. |
| `kpMode` | `string \| null` | Aktueller KeyPilot-Modus. Typische Werte: `none` (normales Durchsuchen), `inspector` (Löschmodus/Spaltenauswahl), `text_focus`, `highlight` (Zeichenauswahl), `scroll_line`, `popover`, `omnibox`. |
| `kpPageUrl` | `string` | `location.href` der Seite, auf der sich das Inhaltsskript befindet. |
| `kpSelection` | `Selection \| null` | Das Browserobjekt `window.getSelection()` (Anker/Fokus, `toString()`, Bereiche). Nicht die benutzerdefinierten Einheitenauswahl-Highlights von KeyPilot. |
| `kpPriorResult` | `any` | Der Rückgabewert des vorherigen Makroschritts, wenn dieses Skript **innerhalb eines Makros** verwendet wird. `undefined`, wenn Sie die Taste als eigenständige Aktion drücken. |

Verwenden Sie `kpHoveredClickable` für „den Link/die Schaltfläche, auf die ich zeige“. Verwenden Sie `kpHoverLeaf` für „jedes Pixel, das sich unter dem Cursor befindet“. Verwenden Sie `kpFocusedTextField`, um das aktive Feld zu lesen oder zu schreiben.

## Rückrufe (nur wenn aktiviert)

Diese Namen sind **Funktionen nur, wenn das entsprechende Kontrollkästchen für diese Aktionsinstanz aktiviert ist**. Wenn das Kästchen ausgeschaltet ist, lautet die Bindung `undefined` – der Aufruf löst einen Wurf aus.

| Rückruf | Unterschrift | Rolle |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | Öffnet das Ergebnis-Popover von KeyPilot. `content` wird in Text umgewandelt (Strings wie sie sind; Objekte über `JSON.stringify`). Der Standardtitel ist `Execute JS`. |
| `copyToClipboard` | `async (content) => boolean` | Kopiert den stringifizierten Wert in die Zwischenablage. Gibt `false` zurück, wenn der Text leer ist. |
| `notify` | `(message) => void` | Zeigt eine kurze Flash-Benachrichtigung an. Nicht-Strings werden stringifiziert. |

Beispiel:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## Rückgabewert

- Das Snippet ist der **Körper einer `async`-Funktion**. Sie können einen beliebigen Wert `return` verwenden und `await` verwenden.
- Bei einem **Tastendruck** bleibt der Rückgabewert ungenutzt, außer dass der Handler noch auf das Versprechen wartet.
- Als **Makroschritt** wird der Rückgabewert für den nächsten Schritt zu `kpPriorResult`. Ein ausgegebener Fehler oder eine Zeitüberschreitung stoppt das Makro in diesem Schritt.

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## Beispiele

Kopieren Sie den sichtbaren Text des Mausklicks:

```js
const el = kpHoveredClickable;
if (!el) {
  if (typeof notify === 'function') notify('Nothing clickable under the cursor');
  return '';
}
const text = (el.innerText || el.textContent || '').trim();
if (typeof copyToClipboard === 'function') await copyToClipboard(text);
return text;
```

Lesen Sie das fokussierte Feld:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## Sicherheitshinweise

- Isolierte Welt ≠ Seitenwelt: Site-definierte `window` APIs werden nicht geteilt.
- Fügen Sie keine nicht vertrauenswürdigen Skripte ein. Das Snippet kann das DOM der aktuellen Seite lesen.
- Bei fehlgeschlagenen oder abgelaufenen Skripten wird dieser Schritt gestoppt. Gates kann leere Ergebnisse erkennen.
- Aktivieren Sie lieber nur die von Ihnen aufgerufenen Rückrufe, damit nicht verwendete Namen `undefined` bleiben.
