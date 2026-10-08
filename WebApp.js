function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function incluir(archivo) {
  return HtmlService.createHtmlOutputFromFile(archivo).getContent();
}

/**
 * Córrela desde el editor (botón Ejecutar) si la página no carga.
 * En "Registro de ejecución" dice qué hojas encuentra y qué falla.
 */
function diagnostico() {
  const libro = getLibro();
  Logger.log('Libro: ' + libro.getName());
  Logger.log('Hojas: ' + libro.getSheets().map(function (h) { return '"' + h.getName() + '"'; }).join(', '));
  limpiarCache();
  const c = getCatalogo();
  Logger.log('Servicios: ' + c.servicios.length + ' · Formas de pago: ' + c.formasPago.length +
             ' · Profesionales: ' + c.profesionales.length + ' · Conceptos: ' + c.conceptos.length);
  const r = getResumen();
  Logger.log('Meses con datos: ' + r.meses.length + ' · Avisos: ' + r.avisos.length);
  Logger.log('Todo bien.');
}
