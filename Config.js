/**
 * Catalogo.gs
 * Lee las listas de la hoja CUENTAS CONTABLES y las entrega al formulario.
 */

function getCatalogo() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('catalogo');
  if (guardado) return JSON.parse(guardado);

  const hoja = getHoja(CONFIG.catalogo);
  const datos = hoja.getDataRange().getValues();

  const cols = getColumnas(hoja, {
    codigo:        ['CODIGO'],
    procedimiento: ['PROCEDIMIENTO'],
    formasPago:    ['FORMA DE PAGO'],
    facturas:      ['FACTURA ELECTRONICA'],
    conceptos:     ['CUENTAS DE GASTO'],
    profesionales: ['PROFESIONAL'],
    soportes:      ['SOPORTE DE EGRESO']
  });

  const servicios = [];
  const vistos = {};
  const listas = { formasPago: [], facturas: [], conceptos: [], profesionales: [], soportes: [] };

  for (let f = 0; f < datos.length; f++) {
    const fila = datos[f];

    const codigo = String(fila[cols.codigo - 1] || '').trim();
    const nombre = String(fila[cols.procedimiento - 1] || '').trim();
    if (codigo && nombre && normalizar(codigo) !== 'CODIGO' && !vistos[normalizar(codigo)]) {
      vistos[normalizar(codigo)] = true;
      servicios.push({ codigo: codigo, nombre: nombre });
    }

    Object.keys(listas).forEach(function (lista) {
      const valor = String(fila[cols[lista] - 1] || '').trim();
      if (!valor) return;
      if (listas[lista].indexOf(valor) >= 0) return;
      if (normalizar(valor).indexOf('FORMA DE PAGO') >= 0) return;
      if (normalizar(valor).indexOf('CUENTAS DE GASTO') >= 0) return;
      if (normalizar(valor).indexOf('PROFESIONAL QUE') >= 0) return;
      if (normalizar(valor).indexOf('SOPORTE DE EGRESO') >= 0) return;
      if (normalizar(valor).indexOf('FACTURA ELECTRONICA') >= 0) return;
      listas[lista].push(valor);
    });
  }

  const resultado = {
    servicios: servicios,
    formasPago: listas.formasPago,
    facturas: listas.facturas,
    conceptos: listas.conceptos,
    profesionales: listas.profesionales,
    soportes: listas.soportes
  };

  cache.put('catalogo', JSON.stringify(resultado), 21600); // 6 horas
  return resultado;
}

/** Córrela a mano si editas la hoja CUENTAS CONTABLES y quieres ver el cambio ya. */
function limpiarCache() {
  CacheService.getScriptCache().remove('catalogo');
}