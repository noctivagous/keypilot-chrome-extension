# Modos

KeyPilot utiliza estados modales para operaciones que necesitan entrada continua. La mayoría de las teclas de navegación se suspenden mientras un modo está activo; <kbd>Esc</kbd> casi siempre se cancela.

## Úselo

1. **Navegación normal**: accesos directos activos; Los rectángulos de enfoque muestran objetivos en los que se puede hacer clic.
2. **Modo de texto**: presione <kbd>F</kbd> en un campo de texto. Escriba normalmente. Presione <kbd>Esc</kbd> (o el control Salir en Referencia del teclado) cuando haya terminado.
3. **Línea de desplazamiento** — presione <kbd>B</kbd>; alejarse del origen para desplazarse; <kbd>B</kbd>, haga clic o <kbd>Esc</kbd> sale.
4. **Selección** — <kbd>H</kbd> o <kbd>Y</kbd>; <kbd>Esc</kbd> cancela.
5. **Modo Eliminar**: presione <kbd>Retroceso</kbd>, apunte a un elemento, confirme para eliminarlo de la página; <kbd>Esc</kbd> cancela.
6. **Popovers/Omnibox/Editor de diseño**: sus propios estados abiertos; <kbd>Esc</kbd> o la tecla de cierre de la herramienta los descarta.

Si las teclas parecen "muertas", probablemente esté en modo texto u otro modo: presione <kbd>Esc</kbd> una vez y vuelva a intentarlo.

## Referencia

### Detalles del modo de texto

- La mayoría de las teclas de navegación de diseño están suspendidas, por lo que escribir es seguro.
- Una ventana corta al pasar el mouse y <kbd>F</kbd> aún puede activar otro objetivo en el que se puede hacer clic sin salir completamente del foco de texto (Activación con cuenta regresiva).
- La apariencia (cuadrado en T frente a cruz, borde naranja, etiquetas) se encuentra en **Configuración → Modo de texto**.

### Modo de eliminación

- Ingresado con <kbd>Retroceso</kbd> en el diseño predeterminado.
- Eliges un elemento visualmente; la confirmación elimina ese nodo DOM de la página en vivo (página local, no deshacer el historial del navegador).

### Otras superficies modales

| Superficie | Abierto típico | Salir |
| --- | --- | --- |
| Vista previa del enlace | <kbd>E</kbd> | <kbd>Esc</kbd>, cierre de la barra de título o acción nuevamente |
| Reader Mode | <kbd>P</kbd> | <kbd>Esc</kbd> / alternar <kbd>P</kbd> |
| Caja multifunción | <kbd>L</kbd> / <kbd>Alt</kbd>+<kbd>L</kbd> | <kbd>Esc</kbd> |
| Editor de distribución de teclado | <kbd>Alt</kbd>+<kbd>C</kbd> | <kbd>Alt</kbd>+<kbd>C</kbd> / cerrar |
| Configuración/Documentos/Guía | <kbd>'</kbd> / <kbd>Alt</kbd>+<kbd>H</kbd> / Entrada de guía | <kbd>Esc</kbd> |

### Siempre disponible

<kbd>Alt</kbd>+<kbd>K</kbd> still toggles KeyPilot even when browsing keys are suspended by Text Mode or when the extension was turned off.
