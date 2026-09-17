# Generador de macros

Macro Builder es el editor de pasos para las macros de usuario, al que se accede desde el Editor de distribución del teclado.

## Úselo

1. Presione <kbd>Alt</kbd>+<kbd>C</kbd> para abrir el Editor de diseño.
2. Abra **Macros de usuario**.
3. **Cree** una macro y asígnele un nombre claro o duplique una existente.
4. Agregar pasos:
   - Seleccione una función en la biblioteca de acciones y agréguela a la macro
   - Agregue chips **lógicos**: esperar, bloquear, detener, ejecutar macro
   - Agregue **Obtener rango de texto** para capturar la selección actual para el siguiente paso
   - Agregue **Mostrar ventana emergente** para mostrar el resultado del paso anterior (o el texto alternativo)
   - Agregue **Ejecutar JS** para ejecutar un script pegado
5. Reordenar o eliminar pasos; abra un paso para configurar parámetros y retardo opcional.
6. **Guarde**, luego coloque la macro en una tecla de la lista de biblioteca/macros.
7. Pruebe en una página normal; refinar a Gates si el flujo se recupera antes de tiempo.

## Referencia

### chips lógicos

| viruta | Rol |
| --- | --- |
| **Espera** | Pausa antes del siguiente paso |
| **Puerta** | Resultado previo de la prueba; en caso de error, omita los siguientes pasos configurados |
| **Detener** | Terminar la macro |
| **Ejecutar macro** | Llamar a otra macro (anidada; protegida por ciclos) |
| **Ejecutar JS** | Ejecute un script pegado; el valor de retorno alimenta la siguiente puerta |
| **Obtener rango de texto** | Capture el resaltado/selección actual para el siguiente paso. No es una acción clave (use Copiar). |
| **Mostrar ventana emergente** | Muestra el resultado de la función anterior (o el texto alternativo configurado) en una ventana emergente. No es una acción clave. |

### Pruebas de puerta

Comparaciones típicas con el resultado de la función anterior:

- Tiene valor/vacío
- Igual/no igual
- Mayor que/menor que

Las puertas fallidas saltan según lo configurado para que pueda realizar bifurcaciones sin secuencias de comandos completas.

### Teclas de macro como pasos

Las primitivas de pulsación de teclas configuradas (tecla de acceso rápido, ráfaga, operación por turnos, continua, mouse sintético, reasignación normal) se pueden ejecutar como pasos de funciones macro, así como como acciones de teclas independientes.

### Consejos

- Mantenga las macros breves y nombre los pasos según su intención.
- Prefiera Gates a largas cadenas incondicionales cuando un paso podría no producir nada.
- Los valores de retorno de Ejecutar JS alimentan la siguiente puerta a través de `kpPriorResult` (consulte *Ejecutar JS*).
