# Actualización: interfaz pulida

Qué cambia para el equipo:

- **Un solo marco.** El encabezado, las pestañas y el contenido comparten el mismo ancho y el mismo borde izquierdo.
- **Pestañas en una sola fila**, subrayadas, también en el celular (antes ocupaban tres filas).
- **Ingreso en dos columnas** en computador: el formulario a la izquierda y, a la derecha, buscar paciente y las
  facturas pendientes. Así se ve lo pendiente sin bajar.
- **Facturas pendientes**: se muestran las 3 más recientes y un botón **Ver las N** para el resto.
- **Se lee mejor**:
  - El verde de la marca se queda en los gráficos y barras.
  - Botones, enlaces y comparaciones usan un verde más oscuro que cumple el contraste mínimo de lectura (4,5:1).
  - Los grises de las etiquetas también se oscurecieron.
- **Formularios**:
  - Etiquetas en letra normal, no en mayúsculas pequeñas.
  - Campos alineados en filas completas, sin huecos.
- **Logística**:
  - La tabla cabe en la pantalla, con los botones completos.
  - En tableta y celular cada producto es una ficha de dos líneas con su estado, vencimiento y acciones.
  - El gráfico de vencimientos ya no gira los meses.
- **Detalles**:
  - Sin sombras decorativas.
  - El foco del teclado se ve.
  - El texto "9 servicios cargados" ya no aparece si todo está bien; ese espacio queda para avisos y errores.
  - El contador de Logística explica qué cuenta al pasar el mouse.

No cambia ningún dato, ninguna hoja ni ninguna función del servidor. En el código, los cambios están marcados con
`NUEVO (pulido)`.

## Pasos en el editor de Apps Script

### 1. `Estilos` · reemplazar todo

Borrar todo el contenido de `Estilos` y pegar el archivo `Estilos.html` completo.

### 2. `Index` · una línea

En la barra de pestañas, el botón de Logística lleva ahora un `title` en el contador:

```html
<button id="tabLog" class="tab" onclick="cambiarTab('log')">Logística <span id="contadorLog" class="contador oculto" title="Vencidos o por vencer en menos de 6 meses"></span></button>
```

### 3. `Logica` · tres cambios

1. Las constantes de color de los gráficos: `GRIS = '#66665F'` y `GRIS_FUERTE = '#3F403C'`.
2. En `pintarListas`, cambiar `estado(datos.servicios.length + ' servicios cargados');` por `estado('');`.
3. En la tabla del dashboard, el color de `· en curso` pasa de `#858581` a `#66665F`.

### 4. `LogicaLogistica` · dos cambios

1. En `graficoVenceMes`, la línea de `x:` agrega `maxRotation: 0, autoSkip: true, autoSkipPadding: 10` a `ticks`.
2. En `pintarTablaInventario`, las celdas de cada fila llevan clases (`l-estado`, `l-tipo`, `l-vence`,
   `l-restante`, `l-ubicacion`, `l-acciones`). Lo más fácil es reemplazar ese bloque completo de `html += '<tr …`.

### 5. `LogicaPacientes` · tres cambios

1. En `cargarPendientes`, las dos frases nuevas del estado.
2. Reemplazar `pintarListaP` por el bloque marcado, con `PENDIENTES_VISIBLES` y `verTodosPend`.
3. `pesosP` usa un espacio que no se parte: `'$ '`.

### 6. Probar y publicar

1. Guardar todo y abrir el enlace de pruebas (`/dev`), en computador y en el celular.
2. Registrar un ingreso, buscar un paciente y guardar un número de factura pendiente.
3. En Logística, abrir **Agotado** en una fila y cancelarlo. En Cierre, tocar **Cierre de caja**.
4. *Implementar → Administrar implementaciones → Nueva versión* (por ejemplo `v1.3.0 · Interfaz pulida`).

## Navegadores

El acomodo en dos columnas usa el selector `:has()`, que funciona en Chrome, Edge y Safari actuales y en
Firefox 121 o posterior. En un navegador más viejo la página funciona igual, solo que con el formulario y los
paneles uno debajo del otro.
