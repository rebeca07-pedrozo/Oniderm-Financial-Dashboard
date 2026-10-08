/**
 * Movimientos.gs
 * Guarda ingresos y egresos. Aquí vive la regla de negocio (comisión, total, mes, año).
 */

function guardarIngreso(datos) {
  validarBase(datos);
  if (!datos.codigo)      throw new Error('Falta el código del servicio.');
  if (!datos.paciente)    throw new Error('Falta el nombre del paciente.');
  if (!datos.formaPago)   throw new Error('Falta la forma de pago.');

  const fecha = fechaValida(datos.fecha);
  const valor = Number(datos.valor);
  const aplica = CONFIG.pagosConComision.map(sinTildes).indexOf(sinTildes(datos.formaPago)) >= 0;
  const comision = aplica ? Math.round(valor * CONFIG.comision) : '';

  const hoja = getHojaPorFecha(fecha, CONFIG.ingresos);
  const fila = {
    fecha: fecha,
    codigo: datos.codigo,
    procedimiento: datos.procedimiento,
    paciente: datos.paciente,
    profesional: datos.profesional,
    cantidad: Number(datos.cantidad) || 1,
    valor: valor,
    formaPago: datos.formaPago,
    comision: comision,
    total: valor - (comision || 0),
    observaciones: datos.observaciones || '',
    factura: datos.factura || 'NO',
    numFactura: datos.numFactura || '',
    mes: MESES[fecha.getMonth()],
    anio: fecha.getFullYear()
  };
  return escribirFila(hoja, COLS_INGRESO, fila);
}

function guardarEgreso(datos) {
  validarBase(datos);
  if (!datos.concepto)    throw new Error('Falta el concepto del gasto.');
  if (!datos.descripcion) throw new Error('Falta la descripción.');

  const fecha = fechaValida(datos.fecha);
  const hoja = getHojaPorFecha(fecha, CONFIG.egresos);
  const fila = {
    fecha: fecha,
    concepto: datos.concepto,
    descripcion: datos.descripcion,
    cantidad: Number(datos.cantidad) || 1,
    valor: Number(datos.valor),
    soporte: datos.soporte || '',
    numSoporte: datos.numSoporte || '',
    observaciones: datos.observaciones || '',
    mes: MESES[fecha.getMonth()],
    anio: fecha.getFullYear()
  };
  return escribirFila(hoja, COLS_EGRESO, fila);
}

function validarBase(datos) {
  if (!datos || !datos.fecha) throw new Error('Falta la fecha.');
  if (!(Number(datos.valor) > 0)) throw new Error('El valor debe ser mayor a cero.');
}

function fechaValida(texto) {
  const fecha = aFecha(texto);
  if (!fecha) throw new Error('La fecha no es válida.');
  return fecha;
}

function getHojaPorFecha(fecha, hojas) {
  return getHoja(fecha.getMonth() + 1 <= 6 ? hojas[1] : hojas[2]);
}

/**
 * Escribe solo las celdas que tienen dato (no borra fórmulas ni valores por defecto de la fila)
 * y revisa ANTES de escribir que cada valor cumpla la validación de su celda.
 * Así un valor rechazado no deja filas a medias con solo la fecha.
 */
function escribirFila(hoja, mapa, fila) {
  const cols = getColumnas(hoja, mapa);
  const destino = ultimaFilaConDatos(hoja, cols.fecha) + 1;

  const cambios = [];
  Object.keys(fila).forEach(function (campo) {
    const valor = fila[campo];
    if (!cols[campo] || valor === '' || valor === null || valor === undefined) return;
    const celda = hoja.getRange(destino, cols[campo]);
    cambios.push({ celda: celda, valor: ajustarAValidacion(hoja, celda, campo, valor) });
  });

  cambios.forEach(function (c) { c.celda.setValue(c.valor); });
  hoja.getRange(destino, cols.fecha).setNumberFormat('dd/mm/yyyy');

  return { ok: true, mensaje: 'Guardado en ' + hoja.getName().trim() + ' (fila ' + destino + ')' };
}

/**
 * Si la celda tiene una lista desplegable, devuelve la opción tal como está escrita en la lista
 * (ignora mayúsculas, tildes y espacios de más). Si no está en la lista y la celda rechaza
 * valores inválidos, lanza un error claro sin escribir nada.
 */
function ajustarAValidacion(hoja, celda, campo, valor) {
  const opciones = opcionesDeLista(celda);
  if (!opciones) return valor;

  const buscado = sinTildes(valor);
  for (let i = 0; i < opciones.length; i++) {
    if (sinTildes(opciones[i]) === buscado) return opciones[i];
  }
  if (celda.getDataValidation().getAllowInvalid()) return valor;
  throw new Error('"' + valor + '" no está en la lista desplegable de la columna ' + campo.toUpperCase() +
                  ' en ' + hoja.getName().trim() + '. Agrégalo a esa lista o elige otra opción.');
}

/** Opciones de la lista desplegable de una celda, o null si no tiene lista. */
function opcionesDeLista(celda) {
  const regla = celda.getDataValidation();
  if (!regla) return null;
  const tipo = regla.getCriteriaType();
  const criterio = regla.getCriteriaValues();
  const T = SpreadsheetApp.DataValidationCriteria;
  let lista = null;
  if (tipo === T.VALUE_IN_LIST) lista = criterio[0];
  else if (tipo === T.VALUE_IN_RANGE) lista = criterio[0].getValues().map(function (f) { return f[0]; });
  if (!lista) return null;
  // Se devuelven tal cual (con espacios incluidos): Sheets solo acepta el texto exacto de la lista
  return lista.map(String).filter(function (o) { return o.trim(); });
}

function ultimaFilaConDatos(hoja, columna) {
  const valores = hoja.getRange(1, columna, hoja.getMaxRows(), 1).getValues();
  for (let i = valores.length - 1; i >= 0; i--) {
    if (valores[i][0] !== '' && valores[i][0] !== null) return i + 1;
  }
  return 1;
}