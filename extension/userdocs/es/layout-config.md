# Editor de diseño de teclado

El Editor de diseño es para mapas de teclas personalizados: coloque funciones en las teclas, cree diseños y administre instancias de acción.

## Úselo

1. Presione <kbd>Alt</kbd>+<kbd>C</kbd>, o elija **Editar distribución del teclado...** en el menú desplegable Referencia del teclado.
2. La Referencia del Teclado se convierte en la superficie de colocación; el panel de configuración contiene la biblioteca de acciones y las herramientas de diseño.
3. **Crea o selecciona un diseño**: editar un elemento integrado genera una copia del usuario (los elementos integrados permanecen como de solo lectura).
4. Busque una acción (busque en la biblioteca), selecciónela y luego **haga clic en una tecla** en la Referencia del teclado para colocarla.
5. Reemplace o borre las ranuras personalizadas existentes según sea necesario.
6. Establezca el diseño como actual cuando desee navegar con él.
7. Presione <kbd>Alt</kbd>+<kbd>C</kbd> nuevamente o cierre el panel cuando haya terminado.

También disponible en el menú desplegable: **Nueva distribución de teclado en blanco** y **Nueva distribución de teclado duplicado**.

## Referencia

### Gestión de diseño

- Cambiar el nombre, eliminar y duplicar diseños de usuario
- Importar/exportar diseños personalizados como JSON
- Cambiar qué diseño se está editando y cuál es el actual

### Reglas de colocación

- Los diseños personalizados son **exclusivos**: solo se ejecutan las claves asignadas más la capa del sistema siempre activa.
- Las funciones parametrizadas se convierten en **Instancias de acción** con configuraciones guardadas (etiqueta, destinos, cuerpo del script, etc.).
- Algunas funciones (por ejemplo, caracteres tipográficos) solo pueden vincularse a **acordes modificadores**, no a teclas de letras simples, por lo que pueden ejecutarse mientras se escribe.

### Consejos

- Mantenga visible la referencia del teclado mientras coloca las teclas: coloque el cursor sobre las teclas para confirmar.
- Comience desde Duplicado de navegación si solo desea algunos cambios.
- Consulte *Funciones y acciones* y *Ejecutar JS* para saber qué puede colocar.
