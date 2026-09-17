# Ejecutar JS

Ejecutar JS es una función de secuencia de comandos que se vincula a una clave cuando una función incorporada no es suficiente. Pegas un fragmento de JavaScript; KeyPilot lo ejecuta cuando se presiona esa tecla.

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">Prompt for an AI chat — paste this, then finish the first sentence with what you want the script to do.</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">I would like JavaScript code for KeyPilot, a Chrome extension, and I want it to …

Así es como funciona KeyPilot y qué es.

KeyPilot es una extensión de Chrome para navegación basada en teclado: apuntas con el mouse y realizas acciones con teclas. Las funciones (operaciones reutilizables) están vinculadas a teclas en el Editor de distribución del teclado (Alt+C). Ejecutar JS es una función cuya instancia de acción contiene un script pegado. Cuando se presiona la tecla, KeyPilot ejecuta ese script.

Escriba un script completo que pueda pegar en el campo "Script" de Ejecutar JS. No lo incluya en una declaración de función: el fragmento ya es el cuerpo de una función asíncrona.

Reglas de tiempo de ejecución:
- Mundo aislado (script de contenido): las API DOM funcionan (documento, querySelector, Element). Los valores globales de JavaScript propios de la página (propiedades de React, jQuery, aplicación `window`) no son visibles.
- Sin API chrome.*, sin instancia de KeyPilot, sin API de almacenamiento.
- Puedes usar esperar. El tiempo de espera difícil es de 8 segundos.
- Devuelve un valor si este será un paso de macro (el siguiente paso lo ve como kpPriorResult).

Enlaces siempre inyectados (pueden ser nulos/indefinidos):
- kpHoveredClickable: el elemento que KeyPilot actualmente trata como elemento en el que se puede hacer clic (enlace/botón) o nulo
- kpHoverLeaf: elemento más profundo debajo del cursor o nulo
- kpFocusedTextField: campo de texto enfocado/contenteditable o nulo
- kpMode — modo de cadena: "ninguno" | "inspector" | "enfoque_texto" | "resaltar" | "línea_desplazamiento" | "popover" | "omnibox"
- kpPageUrl: cadena de URL de la página actual
- kpSelection — window.getSelection() (API de selección), o nulo
- kpPriorResult: resultado del paso de macro anterior (solo cuando este script se ejecuta como un paso de macro)

Las devoluciones de llamada existen solo si la casilla de verificación coincidente está habilitada en la instancia de acción; de lo contrario, no están definidos. Guardia con `if (typeof showPopover === "function")`.
- await showPopover(contenido, título?) — resultado emergente; el contenido está encadenado (objetos → JSON)
- await copyToClipboard(content) — copia texto encadenado; devuelve booleano
- notificar (mensaje): breve notificación flash

Por favor envíe solo el cuerpo del script.</pre>
<p class="muted">Copy the prompt, then finish the first sentence in the AI chat after you paste.</p>
</div>

## Úselo

1. Abra el **Editor de distribución del teclado** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Cree una nueva instancia de acción **Ejecutar JS** en la biblioteca de acciones.
3. Pega tu script en **Script**.
4. Habilite cualquier **Devolución de llamada** a la que llame (`showPopover`, `copyToClipboard`, `notify`).
5. Coloque la instancia en una clave.
6. Presione la tecla en una página para ejecutar.

Los scripts se ejecutan en el **mundo aislado de scripts de contenido**. Hay un tiempo de espera de **8 segundos**.

## Fijaciones siempre proporcionadas.

Cada ejecución inyecta estos nombres como parámetros de la función asíncrona que envuelve su fragmento. **No** son globales que debes declarar.

| Encuadernación | Tipo | Significado |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | El KeyPilot en el que se puede hacer clic se resalta debajo del cursor (se activaría el mismo elemento de clic objetivo). `null` si no se coloca nada en lo que se pueda hacer clic. |
| `kpHoverLeaf` | `Element \| null` | El nodo DOM más profundo debajo del cursor (texto, imagen o elemento anidado), incluso cuando no se puede hacer clic en KeyPilot. |
| `kpFocusedTextField` | `Element \| null` | La entrada de texto enfocada, área de texto o `contenteditable` cuando KeyPilot lo considera en la entrada de texto. `null` si no hay ningún campo enfocado. |
| `kpMode` | `string \| null` | Modo KeyPilot actual. Valores típicos: `none` (navegación normal), `inspector` (modo de eliminación/selección de alternancia de columnas), `text_focus`, `highlight` (selección de carácter), `scroll_line`, `popover`, `omnibox`. |
| `kpPageUrl` | `string` | `location.href` de la página en la que se encuentra el script de contenido. |
| `kpSelection` | `Selection \| null` | El objeto `window.getSelection()` del navegador (ancla/enfoque, `toString()`, rangos). No los aspectos destacados de selección de unidad personalizada de KeyPilot. |
| `kpPriorResult` | `any` | El valor de retorno del paso de macro anterior cuando este script se usa **dentro de una macro**. `undefined` cuando presiona la tecla como acción independiente. |

Utilice `kpHoveredClickable` para "el enlace/botón al que estoy apuntando". Utilice `kpHoverLeaf` para "cualquier píxel que esté debajo del cursor". Utilice `kpFocusedTextField` para leer o escribir el campo activo.

## Devoluciones de llamada (solo si está habilitado)

Estos nombres son **funciones solo cuando la casilla de verificación correspondiente está activada** para esa instancia de acción. Si la casilla está desactivada, el enlace es `undefined`: llamarlo arroja.

| Devolución de llamada | Firma | Rol |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | Abre la ventana emergente de resultados de KeyPilot. `content` se convierte en texto (cadenas tal como están; objetos a través de `JSON.stringify`). El título predeterminado es `Execute JS`. |
| `copyToClipboard` | `async (content) => boolean` | Copia el valor encadenado al portapapeles. Devuelve `false` si el texto está vacío. |
| `notify` | `(message) => void` | Muestra una breve notificación flash. Las no cadenas están encadenadas. |

Ejemplo:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## Valor de retorno

- El fragmento es el **cuerpo de una función `async`**. Puede `return` cualquier valor y utilizar `await`.
- Al **presionar una tecla**, el valor de retorno no se utiliza, excepto que el controlador aún espera la promesa.
- Como **paso de macro**, el valor de retorno se convierte en `kpPriorResult` para el siguiente paso. Un error o un tiempo de espera detiene la macro en este paso.

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## Ejemplos

Copie el texto visible del elemento en el que se puede hacer clic:

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

Lea el campo enfocado:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## Notas de seguridad

- Mundo aislado ≠ mundo de páginas: las API `window` definidas por el sitio no se comparten.
- No pegue scripts que no sean de confianza. El fragmento puede leer el DOM de la página actual.
- Los scripts fallidos o con tiempo de espera agotado detienen ese paso; Gates puede detectar resultados vacíos.
- Prefiere habilitar solo las devoluciones de llamada a las que llamas para que los nombres no utilizados permanezcan `undefined`.
