# Actualización: pacientes, búsqueda y factura pendiente

Qué agrega:

- En **Ingreso**, el campo "Paciente" se reemplaza por **Cédula**, **Nombres** y **Apellidos**, obligatorios
  desde ahora. Se normalizan solos ("LINA marcela" → "Lina Marcela"; "1.023.456" → "1023456").
- Si la cédula ya existe, el formulario completa nombres y apellidos con el registro anterior.
- Debajo del formulario: **Buscar paciente** (por nombre en cualquier orden o por cédula) y
  **Pendientes de número de factura**, donde se escribe el número y se guarda sin abrir el Sheets.
- Al tocar un resultado se despliega el detalle, con un botón **Editar datos**.
- Los registros viejos no cambian. Las columnas `NOMBRES`, `APELLIDOS` y `CEDULA` se crean solas al final
  del encabezado de las hojas de ingresos la primera vez que se guarda un paciente.

En el código, todo lo nuevo está marcado con `NUEVO (pacientes)`.

## Pasos en el editor de Apps Script

### 1. Dos archivos nuevos (copiar completos)

| Crear | Tipo | Contenido |
| --- | --- | --- |
| `Pacientes` | Secuencia de comandos (+ → Secuencia de comandos) | todo `Pacientes.js` |
| `LogicaPacientes` | HTML (+ → HTML) | todo `LogicaPacientes.html` |

### 2. `Config` · 3 líneas

En `COLS_INGRESO`, después de `anio: ['AÑO']`, poner una coma y agregar:

```javascript
  nombres:       ['NOMBRES'],
  apellidos:     ['APELLIDOS'],
  cedula:        ['CEDULA', 'CÉDULA']
```

### 3. `Movimiento` · una función

Reemplazar **toda** la función `guardarIngreso` por la que está entre las marcas
`NUEVO (pacientes) · REEMPLAZAR` y `FIN NUEVO (pacientes)`.

### 4. `Index` · cuatro cambios

1. Reemplazar el bloque del campo **Paciente** (el `<label>` que contiene `id="i_paciente"`) por los tres
   campos marcados (cédula, nombres, apellidos).
2. Opcional: en `id="i_numFactura"` agregar `placeholder="Opcional: luego"`.
3. Justo después del `</section>` que cierra el formulario de ingreso (después del botón
   "Guardar ingreso"), pegar la sección `<section id="pacientesIngreso" …>` completa.
4. Al final, debajo de `<?!= incluir('LogicaLogistica'); ?>`, agregar:
   `<?!= incluir('LogicaPacientes'); ?>`

### 5. `Logica` · cinco cambios pequeños

1. En `cambiarTab`, al final, las 2 líneas marcadas (`pacientesIngreso` y `cargarPendientes`).
2. En `guardar`, cambiar `paciente: valor('i_paciente'),` por las 3 líneas de `cedula`, `nombres` y `apellidos`.
3. En `guardar`, después de `resumen = null;`, la línea `if (tipo === 'ingreso') cargarPendientes();`.
4. En `limpiar`, la lista de campos (`'paciente'` → `'cedula', 'nombres', 'apellidos'`) y el
   `focus` (`'i_paciente'` → `'i_cedula'`), más la línea que limpia la pista de la cédula.
5. En `agregarReciente`, el bloque marcado que arma el texto con nombres y apellidos.

### 6. `Estilos` · un bloque

Pegar el bloque marcado `NUEVO (pacientes)` al final, justo antes de la etiqueta que cierra el `style`.

### 7. Probar y publicar

1. Guardar todo y abrir el enlace de pruebas (`/dev`).
2. Registrar un ingreso de prueba con cédula, nombres y apellidos, y "¿Factura?" en **SI** sin número:
   debe aparecer en "Pendientes de número de factura".
3. Escribir el número y tocar **Guardar**: sale de la lista y queda en la hoja.
4. *Implementar → Administrar implementaciones → Nueva versión* (por ejemplo `v1.1.0 · Pacientes y factura pendiente`).

## Ajustes opcionales (en `Pacientes`, arriba)

| Ajuste | Por defecto | Qué cambia |
| --- | --- | --- |
| `diasPendientes` | `45` | Cuántos días hacia atrás mira la lista de pendientes |
| `soloSiSolicita` | `true` | `true`: pendiente = "¿Factura?" en SI y sin número. `false`: todo ingreso sin número |
| `maxResultados` | `40` | Máximo de resultados por búsqueda |
