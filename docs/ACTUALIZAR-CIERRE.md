# Actualización: cierre de caja

Qué agrega:

- Una pestaña **Cierre** con un botón **Cierre de caja**. Al tocarlo muestra lo que entró en el día:
  - el total, con lo que llega después de la comisión BOLD;
  - una tarjeta por forma de pago (efectivo, tarjeta débito, tarjeta de crédito, transferencia…), con
    cuántas atenciones hubo y qué parte del día fue;
  - cuánto efectivo debe haber en la caja;
  - un aviso si alguna atención pidió factura y todavía no tiene número;
  - la lista de las atenciones del día.
- Se puede elegir otro día (por ejemplo, si el cierre de ayer quedó pendiente). No deja elegir días futuros.
- Las formas de pago que no tuvieron movimiento salen en $0, para que el cierre muestre que por ahí no entró nada.
- **Solo lee** la hoja de ingresos: no escribe nada.
- Tiene un enlace **Imprimir cierre** que imprime solo el resumen.

En el código, todo lo nuevo está marcado con `NUEVO (cierre)`.

## Pasos en el editor de Apps Script

### 1. Dos archivos nuevos (copiar completos)

| Crear | Tipo | Contenido |
| --- | --- | --- |
| `Cierre` | Secuencia de comandos (+ → Secuencia de comandos) | todo `Cierre.js` |
| `LogicaCierre` | HTML (+ → HTML) | todo `LogicaCierre.html` |

### 2. `Index` · tres cambios

1. En la barra de pestañas, debajo del botón de **Logística**, agregar el botón marcado:
   `<button id="tabCierre" class="tab" onclick="cambiarTab('cierre')">Cierre</button>`
2. Justo antes del `</div>` que cierra la app (después del `</section>` de Logística), pegar la sección
   `<section id="formCierre" …>` completa, entre las marcas `NUEVO (cierre)` y `FIN NUEVO (cierre)`.
3. Al final, debajo de `<?!= incluir('LogicaPacientes'); ?>`, agregar:
   `<?!= incluir('LogicaCierre'); ?>`

### 3. `Logica` · tres líneas en `cambiarTab`

1. En la lista de pestañas, agregar `'Cierre'` al final:
   `['Ingreso', 'Egreso', 'Dash', 'Log', 'Cierre'].forEach(...)`
2. En la línea de `recientes`, agregar `tab === 'cierre' ||` junto a `tab === 'log' ||`.
3. Al final de la función, la línea `if (tab === 'cierre') abrirCierre();`.

### 4. `Estilos` · un bloque y un número

1. Pegar el bloque marcado `NUEVO (cierre)` al final, justo antes de la etiqueta que cierra el `style`.
2. Opcional: en el bloque `@media (max-width: 620px)` cambiar `.app { padding: 20px 14px 48px; }` por
   `.app { padding: 20px 16px 48px; }` (margen del celular un poco más amplio).

### 5. Probar y publicar

1. Guardar todo y abrir el enlace de pruebas (`/dev`).
2. Ir a **Cierre** y tocar **Cierre de caja**: el total debe coincidir con la suma de los ingresos de hoy en la hoja.
3. Elegir un día anterior en la fecha: el cierre se recalcula solo.
4. *Implementar → Administrar implementaciones → Nueva versión* (por ejemplo `v1.2.0 · Cierre de caja`).

## Cómo calcula

- Toma las filas de la hoja de ingresos del semestre de ese día cuya fecha es el día elegido y cuyo valor es mayor que cero.
- **Valor** es lo que pagó el paciente. **Llegan** es el valor menos la comisión BOLD, con el mismo criterio
  del tablero: si la columna `TOTAL` no es creíble, se calcula como valor menos comisión.
- El total de arriba es la suma de las tarjetas, y las tarjetas son la suma de las atenciones de la lista.
- Las tarjetas salen en el orden de la lista `FORMA DE PAGO` de la hoja. Una forma de pago escrita a mano que
  no está en la lista aparece al final con su propio nombre.
