# Selección

Seleccione texto o elementos HTML debajo del cursor, luego copie o actúe sobre el resultado.

## Úselo

### Selección de texto

1. Mueva el cursor al lugar donde debe comenzar la selección.
2. Presione <kbd>H</kbd> para comenzar la selección de texto a nivel de carácter.
3. Vaya al final del rango y presione <kbd>H</kbd> nuevamente para finalizar y copiar.
4. Presione <kbd>Esc</kbd> para cancelar sin copiar.

La selección de texto es de intercalación a intercalación (como hacer clic y arrastrar), no un clip del rectángulo discontinuo. El rectángulo es una guía de arrastre: el rango copiado es todo lo que está en el orden del documento entre los signos de intercalación inicial y final.

El formato de copia (texto enriquecido o sin formato) se puede configurar en la instancia de acción de la función de selección de texto.

### Selección de elementos

1. Presione <kbd>Y</kbd> para iniciar la selección rectangular de elementos HTML que se cruzan.
2. Arrastre/ajuste el rectángulo sobre los elementos que desee.
3. Complete la selección según las indicaciones en pantalla (o use el modo de selección acumulativa si está configurado).
4. Presione <kbd>Esc</kbd> para cancelar.

La granularidad predeterminada es una unidad característica del artículo: un párrafo o encabezado, una tabla completa (no celdas individuales), una figura o imagen completa (no la imagen interior), una lista completa. Al presionar un enlace dentro de un párrafo, se selecciona ese párrafo inmediatamente. La superposición utiliza los cuadros de línea de cada elemento, no un cuadro delimitador.

## Referencia

### Teclas predeterminadas (navegación, diestros)

| Clave | Acción |
| --- | --- |
| <kbd>H</kbd> | Seleccionar texto (iniciar/finalizar + copiar) |
| <kbd>Y</kbd> | Elementos de selección rectangulares (o modo de selección acumulativa) |
| <kbd>Esc</kbd> | Cancelar modos de selección |

### Modos para <kbd>Y</kbd>

- **Rectángulo**: seleccione las unidades de características del artículo cuyos cuadros de línea se cruzan con un rectángulo dibujado (párrafo, tabla, figura, lista). Un enlace dentro de un párrafo selecciona el párrafo.
- **Selección acumulativa**: agregue elementos uno por uno y finalice con <kbd>Enter</kbd> (configurado en la Función).

### Herramientas relacionadas

- <kbd>I</kbd> / <kbd>U</kbd> copiar la imagen/URL colocada sobre el cursor (consulte *Copiar bajo el cursor*).
- <kbd>O</kbd> abre Page Media para todo lo que se encuentra en la página.
- Los destinos del Portapapeles y la Biblioteca multimedia aparecen en muchas funciones Obtener/Copiar en el Editor de diseño.

## Seleccionar unidad (Portapapeles)

Coloque **Seleccionar palabra**, **Seleccionar oración**, **Seleccionar párrafo** o **Seleccionar imagen** en la sección Portapapeles de la Biblioteca de acciones. Estos se seleccionan bajo el cursor de KeyPilot sin copiar.

1. Pase el cursor sobre la palabra, oración, párrafo o imagen.
2. Presione la tecla enlazada para seleccionarlo. Presione nuevamente sobre la misma unidad para deseleccionarla.
3. Utilice **Copiar** (o Cortar) para enviar la selección de KeyPilot al portapapeles.
4. Presione <kbd>Esc</kbd> para borrar la selección.

Cada función muestra exclusiva/acumulativa en su ventana emergente de información de tecla de referencia de teclado (compartida para esa función, no una instancia de acción por tecla).

- **Exclusivo** (predeterminado): la prensa reemplaza la selección actual.
- **Acumulativo**: agregar o eliminar unidades; los rangos disjuntos permanecen resaltados.

KeyPilot pinta su propio resaltado para que las selecciones con espacios permanezcan visibles. Esto es independiente de la selección de arrastre <kbd>H</kbd> / <kbd>Y</kbd>.
