/**
 * Oniderm · Gestión financiera y logística
 * Copyright (c) 2026 Rebeca Pedrozo. Todos los derechos reservados.
 * Software propietario y confidencial. Prohibido copiar, modificar, distribuir
 * o usar este archivo, total o parcialmente, sin autorización escrita de la autora.
 * Ver el archivo LICENSE.
 */

function doGet(e) {
  const pagina = HtmlService.createTemplateFromFile('Index');
  // ?tab=log abre directo en Logística (el botón del correo de alertas usa esto)
  pagina.tabInicial = (e && e.parameter && e.parameter.tab) === 'log' ? 'log' : '';
  return pagina
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
