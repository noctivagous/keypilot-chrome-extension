# macros

Una macro es una secuencia ordenada de pasos de función y lógica vinculados a una sola tecla.

## Úselo

1. Abra el **Editor de distribución de teclado** (<kbd>Alt</kbd>+<kbd>C</kbd>) y vaya a **Macros de usuario** (consulte *Macro Builder* para editar).
2. Elija una macro de valores para probar o cree la suya propia.
3. Coloque la macro en una tecla de referencia del teclado como cualquier otra acción.
4. Presione esa tecla en una página: los pasos se ejecutan en orden y Gates decide si continúa.

Los ejemplos de acciones incluyen flujos como **AI Assist**, **Quick Nav** y **Clip & Search**. La edición de una macro de acciones la convierte en una copia de usuario que puede personalizar libremente.

## Referencia

### Conceptos

- **Pasos** — Funciones (incluido Ejecutar JS) y chips lógicos
- **Puerta** — inspecciona el resultado anterior; puede omitir los siguientes pasos
- **Retraso**: espera opcional entre pasos
- **Ejecutar macro**: anida otra macro (los ciclos están protegidos)

### Macros de acciones

Plantillas de solo lectura. Guardar/editar bifurca una macro de usuario que puedes personalizar y colocar libremente.

### Comparado con una sola función

| Utilice una función cuando... | Utilice una macro cuando... |
| --- | --- |
| Una operación es suficiente | Necesitas una tubería |
| Los parámetros siguen siendo simples | Necesita puertas/esperas/ejecuciones anidadas |

### Siguiente

Abra *Macro Builder* para crear/editar/colocar detalles y *Ejecutar JS* para ver los pasos de guión dentro de las macros.
