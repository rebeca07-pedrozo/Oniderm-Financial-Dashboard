# Oniderm-Financial-Dashboard

Web app de Google Apps Script para Oniderm: registro de ingresos y egresos, tablero financiero
y pestaña de **Logística** (inventario con semáforo por fecha de vencimiento).

Una sola web app y dos libros de Google Sheets detrás:

| Libro | Cómo se abre | Hojas |
| --- | --- | --- |
| Ingresos y egresos | el libro al que está ligado el script | `INGRESOS I/II SEMESTRE`, `EGRESOS I/II SEMESTRE`, `CUENTAS CONTABLES` |
| Inventario | por ID (`ID_LIBRO_INVENTARIO`) | las 6 hojas originales (respaldo, no se tocan) + `INVENTARIO` |

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `Config.js` | Constantes, mapas de columnas, `getLibro()`, `getLibroInventario()`, `getHoja()`, `getColumnas()` |
| `Catalogo.js` | Listas desplegables de `CUENTAS CONTABLES` (caché 6 h) |
| `Movimiento.js` | `guardarIngreso()`, `guardarEgreso()`, `rehacerListas()` |
| `Dashboard.js` | `getResumen()` para el tablero financiero |
| `Inventario.js` | Leer, registrar, dar de baja y completar fechas en `INVENTARIO` |
| `InventarioTablero.js` | `getTableroInventario()` y el contador de la pestaña |
| `InventarioMigracion.js` | `migrarInventario()`: pasa las 6 hojas del Excel a `INVENTARIO` |
| `InventarioAlertas.js` | Correo diario cuando algo empeora + `instalarRevisionDiaria()` |
| `WebApp.js` | `doGet()` (acepta `?tab=log`), `incluir()`, `diagnostico()` |
| `Index.html`, `Estilos.html`, `Logica.html`, `LogicaLogistica.html` | Interfaz |

## Puesta en marcha de Logística (una sola vez)

1. **Convertir el Excel de inventario a Google Sheets.** Abrir el `.xlsx` en Drive →
   *Archivo → Guardar como Hojas de cálculo de Google*. Copiar el ID del Sheet nuevo
   (lo que va entre `/d/` y `/edit` en la URL; es distinto al del `.xlsx`).
2. **Propiedades del script** (*Configuración del proyecto → Propiedades del script*):
   - `ID_LIBRO_INVENTARIO`: el ID del paso 1.
   - `CORREOS_ALERTA`: correos para la alerta diaria, separados por coma.
   - `RESPONSABLES_INVENTARIO` (opcional): nombres del equipo, separados por coma, para el desplegable de responsable.
3. **Zona horaria del proyecto:** *Configuración del proyecto → Zona horaria* = `America/Bogota`.
4. **Migrar:** en el editor, ejecutar `migrarInventario`. El registro debe decir
   **262 registros** y **117 con fecha de vencimiento válida**. Se puede repetir: rehace la hoja `INVENTARIO`.
5. **Alerta diaria:** ejecutar `instalarRevisionDiaria` (7 a. m. hora de Bogotá; no se duplica si se corre otra vez).
6. **Publicar:** *Implementar → Administrar implementaciones → Editar → Nueva versión*. La implementación debe
   ejecutarse como la dueña (*Ejecutar como: yo*), así el equipo no necesita permisos sobre los libros.

## Reglas del semáforo

| Estado | Criterio |
| --- | --- |
| Vencido | ya pasó la fecha |
| Rojo | vence en menos de 6 meses |
| Amarillo | entre 6 y 12 meses |
| Verde | más de 12 meses |
| Sin fecha | falta la fecha de vencimiento (se completa desde la tabla) |
| No vence | marcado como "no vence" |

Nunca se borra una fila de `INVENTARIO`: los productos consumidos o descartados cambian a `AGOTADO` o
`DESCARTADO` con su `FECHA_BAJA`, y dejan de contar en el tablero.
