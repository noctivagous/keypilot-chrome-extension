# Funciones y acciones

Las funciones son los bloques de construcción que vinculas a las claves. Una **Instancia de acción** es una función más valores de parámetros guardados.

## Úselo

1. Abra el **Editor de distribución del teclado** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. Explore o busque en la **Biblioteca de acciones** (vista de tarjeta o tabla).
3. Seleccione una función. Si tiene parámetros, cree o edite una **Instancia de acción** (nómbrela claramente).
4. Haga clic en una tecla de Referencia de teclado para colocar esa instancia.
5. Presione la tecla en una página normal para ejecutarla.

Para cambiar el comportamiento más adelante, edite los parámetros de la instancia en Config: cada clave que usa esa instancia recoge el cambio.

## Referencia

### Conceptos

| Término | Significado |
| --- | --- |
| **Función** | Definición operación reutilizable |
| **Instancia de acción** | Función + parámetros guardados |
| **Acción clave** | Qué ocupa un espacio: función/instancia o macro |
| **Destino del resultado** | Portapapeles, ventana emergente, cambio de página, biblioteca multimedia, etc. |

### Categorías de biblioteca (descripción general)

Navegación · Control de pestañas · URL de inicio · Obtener datos de página · Mapas · Desplazamiento · Seleccionar · Portapapeles · Tipo · Pulsaciones de teclas · Datos · Búsqueda · Traducir · Script · Biblioteca multimedia · IA · KeyPilot · Herramientas · Sistema

### Funciones notables

<h3 id="type-characters">Type Characters</h3>

Inserte el texto guardado en el campo enfocado. Vinculado con un acorde modificador para que pueda ejecutarse mientras se escribe. Cree una instancia de acción por fragmento.

<h3 id="font-info">Font Info</h3>

Ventana emergente con familia, tamaño, tipo de archivo y URL de descarga para el texto con estilo debajo del cursor, además de un resumen de esa ejecución de texto.

<h3 id="lookup-word">Lookup Word</h3>

Definición de API de diccionario gratuito para la palabra debajo del cursor. Opcional: Preguntar a la fuente de IA en la instancia de acción cuando esa ruta esté disponible.

<h3 id="translate">Translate</h3>

Traduce el resaltado o la palabra/frase/párrafo debajo del cursor. El destino puede reemplazar el texto de la página o abrir una ventana emergente.

<h3 id="send-text-to-ai">Send selection to AI</h3>

Envía texto seleccionado con una instrucción configurable. Enrute el resultado al portapapeles, a una ventana emergente o a ambos.

<h3 id="get-text-at-cursor">Get text / media under cursor</h3>

**Obtener texto en el cursor** copia texto de palabra, oración, párrafo o hipervínculo. **Obtener medios en el cursor** copia imágenes, videos o audio debajo del cursor. **Obtener rango de texto** es un paso macro que pasa el resaltado actual al siguiente paso.

<h3 id="show-popover">Show Popover</h3>

Paso macro que muestra el resultado del paso anterior (o el texto alternativo) en una ventana emergente de resultados.

<h3 id="poi">Map place (POI)</h3>

Cuando un marcador de mapa está debajo del cursor: **Lugar sitio web** abre la página del lugar en Vista previa del enlace; **Dirección del lugar** copia la dirección postal (txt o vCard).

<h3 id="media-library-functions">Add / Fetch URL for Media Library</h3>

**Agregar URL** almacena el href flotante sin descargarlo. **Obtener URL** descarga el archivo vinculado (PDF, audio, video, imagen) a la biblioteca multimedia.

<h3 id="execute-js">Execute JS</h3>

Función de script personalizada. Enlaces completos, devoluciones de llamadas y un mensaje de IA: [Ejecutar JS](kp://docs/execute-js).

<h3 id="keystrokes">Macro Keys (keystrokes)</h3>

Teclas de acceso rápido, ráfagas, turnos por turnos, teclas continuas, mouse sintético y reasignaciones: funciones de pulsación de teclas instanciables en la biblioteca de acciones. Consulte [Editor de distribución de teclado](kp://docs/layout-config).

### Stock vs usuario

Los diseños integrados son fuentes de sólo lectura; la edición bifurca una copia de usuario de su propiedad.
