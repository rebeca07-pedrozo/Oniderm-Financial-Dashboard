/**
 * InventarioMigracion.gs
 * Pasa las 6 hojas del Excel original a la hoja única INVENTARIO.
 * Se corre UNA vez a mano desde el editor: migrarInventario().
 * Se puede repetir: borra INVENTARIO y la vuelve a generar. Las hojas origen nunca se tocan.
 */

const HOJAS_ORIGEN = [
  { hoja: 'MEDICAMENTOS_',              tipo: 'M',  ubicacion: 'Almacén' },
  { hoja: 'BOTIQUÍN (MEDICAMENTOS)',    tipo: 'M',  ubicacion: 'Botiquín' },
  { hoja: 'KITDERRAMES (MEDICAMENTOS)', tipo: 'M',  ubicacion: 'Kit derrames' },
  { hoja: 'DISPOSITIVOS',               tipo: 'DM', ubicacion: 'Almacén' },
  { hoja: 'BOTIQUÍN (DISPOSITIVOS)',    tipo: 'DM', ubicacion: 'Botiquín' },
  { hoja: 'KIT DERRAME (DISPOSITIVOS)', tipo: 'DM', ubicacion: 'Kit derrames' }
];

// Encabezados de las hojas origen (fila 7). Se buscan por texto: si una hoja no tiene
// la columna (p. ej. CANTIDAD en DISPOSITIVOS), el campo queda vacío.
const COLS_ORIGEN = {
  ingreso:       ['FECHA DE INGRESO'],
  cantidad:      ['CANTIDAD'],
  producto:      ['DESCRIPCI'],
  principio:     ['PRINCIPIO ACTIVO'],
  presentacion:  ['PRESENTACI'],
  forma:         ['FORMA FARMAC'],
  concentracion: ['CONCENTRACI'],
  unidad:        ['UNIDAD DE MEDIDA'],
  marca:         ['MARCA'],
  serie:         ['SERIE'],
  invima:        ['REGISTRO SANITARIO'],
  riesgo:        ['CLASIFICACI'],
  laboratorio:   ['LABORATORIO'],
  lote:          ['NO LOTE'],
  vence:         ['FECHA DE VENCIMIENTO'],   // DD; MM y AAAA están en las dos columnas siguientes
  vidaUtil:      ['VIDA'],
  condiciones:   ['CONDICIONES'],
  responsable:   ['RESPONSABLE'],
  observaciones: ['OBSERVACIONES']
};

const INVIMA_VACIO = ['X', 'NO REQUIERE'];

function migrarInventario() {
  const libro = getLibroInventario();
  const zona = Session.getScriptTimeZone();
  const hoy = hoyISO();
  const salida = [];
  const reporte = { porHoja: {}, conFecha: 0, sinFecha: 0, sinCantidad: 0, sinLote: 0, ingresoIlegible: [] };

  HOJAS_ORIGEN.forEach(function (origen) {
    const hoja = getHoja(origen.hoja, libro);
    const cols = getColumnas(hoja, COLS_ORIGEN);
    if (!cols.producto || !cols.vence) throw new Error('No reconozco el encabezado de ' + origen.hoja);
    const datos = hoja.getDataRange().getValues();
    const dato = function (fila, campo) {
      return cols[campo] ? fila[cols[campo] - 1] : '';
    };
    const texto = function (fila, campo) { return textoCelda(dato(fila, campo)); };

    let n = 0;
    // la fila siguiente al encabezado es el subencabezado DD/MM/AAAA; no tiene producto y se salta sola
    for (let i = cols.filaEncabezado; i < datos.length; i++) {
      const fila = datos[i];
      if (!texto(fila, 'producto')) continue;
      n++;

      const vence = fusionarVencimiento(fila[cols.vence - 1], fila[cols.vence], fila[cols.vence + 1]);
      if (vence) reporte.conFecha++; else reporte.sinFecha++;

      const ingreso = fechaDeIngreso(dato(fila, 'ingreso'));
      if (!ingreso && texto(fila, 'ingreso')) reporte.ingresoIlegible.push(origen.hoja + ' fila ' + (i + 1));

      let cantidad = 0;
      if (cols.cantidad && texto(fila, 'cantidad') !== '') cantidad = aNumero(dato(fila, 'cantidad'));
      if (!cantidad) reporte.sinCantidad++;

      let lote = texto(fila, 'lote');
      if (!lote) { lote = 'SIN LOTE'; reporte.sinLote++; }

      let invima = texto(fila, 'invima');
      if (INVIMA_VACIO.indexOf(sinTildes(invima)) >= 0) invima = '';

      let observaciones = texto(fila, 'observaciones');
      if (texto(fila, 'vidaUtil')) observaciones = (observaciones ? observaciones + '\n' : '') + 'Vida útil: ' + texto(fila, 'vidaUtil');

      const esM = origen.tipo === 'M';
      const estado = calcularEstado(vence ? fechaISO(vence, zona) : null, false, hoy).estado;
      const registro = {
        ID: salida.length + 1, FECHA_REGISTRO: new Date(), FECHA_INGRESO: ingreso || '',
        TIPO: origen.tipo, UBICACION: origen.ubicacion, PRODUCTO: texto(fila, 'producto'), LOTE: lote,
        CANTIDAD: cantidad, UNIDAD: texto(fila, 'unidad') || 'unidades', FECHA_VENCIMIENTO: vence || '',
        NO_VENCE: '', REGISTRO_INVIMA: invima, LABORATORIO: texto(fila, 'laboratorio'),
        PRESENTACION: texto(fila, 'presentacion'),
        PRINCIPIO_ACTIVO: esM ? texto(fila, 'principio') : '', CONCENTRACION: esM ? texto(fila, 'concentracion') : '',
        FORMA_FARMACEUTICA: esM ? texto(fila, 'forma') : '',
        MARCA: esM ? '' : texto(fila, 'marca'), SERIE: esM ? '' : texto(fila, 'serie'),
        CLASIF_RIESGO: esM ? '' : texto(fila, 'riesgo'),
        CONDICIONES_ALMACEN: texto(fila, 'condiciones'), RESPONSABLE: texto(fila, 'responsable'),
        OBSERVACIONES: observaciones, ESTADO_REGISTRO: 'ACTIVO', FECHA_BAJA: '', ULTIMO_ESTADO: estado
      };
      salida.push(COLS_INVENTARIO.map(function (nombre) { return registro[nombre]; }));
    }
    reporte.porHoja[origen.hoja] = n;
  });

  // hoja destino: se crea si no existe; si existe, se vacía (idempotente)
  let destino;
  try { destino = getHoja(CONFIG_INV.hoja, libro); } catch (e) { destino = libro.insertSheet(CONFIG_INV.hoja); }
  destino.clear();
  destino.getRange(1, 1, 1, COLS_INVENTARIO.length).setValues([COLS_INVENTARIO]).setFontWeight('bold');
  destino.setFrozenRows(1);
  if (salida.length) {
    const cols = getColumnasExactas(destino, COLS_INVENTARIO);
    // texto plano antes de escribir: si no, Sheets vuelve número el lote 0199060 o fecha el 09/10/2025
    COLS_TEXTO_INVENTARIO.forEach(function (n) { destino.getRange(2, cols[n], destino.getMaxRows() - 1, 1).setNumberFormat('@'); });
    destino.getRange(2, 1, salida.length, COLS_INVENTARIO.length).setValues(salida);
    formatearFechas(destino, cols, 2, salida.length);
  }
  invalidarCacheInventario();

  Logger.log('===== Migración de inventario =====');
  Logger.log('Total migrado: ' + salida.length + ' (esperado: 262)');
  Object.keys(reporte.porHoja).forEach(function (h) { Logger.log('  ' + h + ': ' + reporte.porHoja[h]); });
  Logger.log('Con fecha de vencimiento válida: ' + reporte.conFecha + ' (esperado: 117)');
  Logger.log('Sin fecha de vencimiento: ' + reporte.sinFecha);
  Logger.log('Sin cantidad (quedan en 0): ' + reporte.sinCantidad);
  Logger.log('Sin lote (quedan como SIN LOTE): ' + reporte.sinLote);
  Logger.log('Fecha de ingreso ilegible: ' + reporte.ingresoIlegible.length +
             (reporte.ingresoIlegible.length ? ' → ' + reporte.ingresoIlegible.join(', ') : ''));
  return reporte;
}

/** DD + MM + AAAA en una sola fecha. null si falta algo, si el año es 'X' o si la fecha no existe. */
function fusionarVencimiento(dd, mm, aa) {
  const d = Number(String(dd).trim()), m = Number(String(mm).trim());
  let a = Number(String(aa).trim());
  if (!d || !m || !a) return null;          // alguna vacía o 'X'
  if (a < 100) a += 2000;                   // 25 -> 2025
  const fecha = new Date(a, m - 1, d, 12, 0, 0);
  // rechaza combinaciones imposibles como 30 de febrero o mes 19
  if (fecha.getMonth() !== m - 1 || fecha.getDate() !== d) return null;
  return fecha;
}

/** Acepta fecha real y textos como 10-04-24, 10 04 2024, 2-04-25 o 10/04/2024. */
function fechaDeIngreso(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const p = String(valor === null || valor === undefined ? '' : valor).trim().split(/[-\/\s.]+/);
  if (p.length !== 3) return null;
  return fusionarVencimiento(p[0], p[1], p[2]);
}
