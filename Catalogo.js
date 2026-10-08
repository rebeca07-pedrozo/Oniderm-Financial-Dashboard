/**
 * Config.gs
 * Lo único que se toca cuando algo cambia. El resto del código no se modifica.
 */

const CONFIG = {
  logo: '', //url del logo
  catalogo: 'CUENTAS CONTABLES',
  ingresos: { 1: 'INGRESOS I SEMESTRE', 2: 'INGRESOS II SEMESTRE' },
  egresos:  { 1: 'EGRESOS I SEMESTRE',  2: 'EGRESOS II SEMESTRE' },
  comision: 0.05,
  pagosConComision: ['TARJETA DEBITO', 'TARJETA DE CREDITO'],
  titulo: 'Oniderm · Ingresos y egresos'
};

// campo del formulario -> texto que debe contener el encabezado en la hoja
const COLS_INGRESO = {
  fecha:         ['FECHA'],
  codigo:        ['CODIGO'],
  procedimiento: ['PROCEDIMIENTO'],
  paciente:      ['NOMBRE Y APELLIDO'],
  profesional:   ['PROFESIONAL'],
  cantidad:      ['CANTIDAD'],
  valor:         ['VALOR'],
  formaPago:     ['FORMA DE PAGO'],
  comision:      ['BOLD'],
  total:         ['TOTAL', 'INGRESO -5'],
  observaciones: ['OBSERVACIONES'],
  factura:       ['SOLICITA FACTURA'],
  numFactura:    ['No FACTURA'],
  mes:           ['MES'],
  anio:          ['AÑO']
};

const COLS_EGRESO = {
  fecha:         ['FECHA'],
  concepto:      ['CONCEPTO'],
  descripcion:   ['DESCRIPCI'],
  cantidad:      ['CANTIDAD'],
  valor:         ['VALOR'],
  soporte:       ['SOPORTE DE EGRESO'],
  numSoporte:    ['NO. SOPORTE', 'NO SOPORTE'],
  observaciones: ['OBSERVACIONES'],
  mes:           ['MES'],
  anio:          ['AÑO']
};

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
               'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Si existe la propiedad ID_LIBRO usa ese libro (sirve para tener uno de pruebas). */
function getLibro() {
  const id = PropertiesService.getScriptProperties().getProperty('ID_LIBRO');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

/** Busca la hoja ignorando mayúsculas y espacios de más (la del II semestre tiene un espacio al inicio). */
function getHoja(nombre) {
  const buscado = normalizar(nombre);
  const hojas = getLibro().getSheets();
  for (let i = 0; i < hojas.length; i++) {
    if (normalizar(hojas[i].getName()) === buscado) return hojas[i];
  }
  throw new Error('No encuentro la hoja: ' + nombre);
}

function normalizar(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Ubica las columnas por el texto del encabezado, no por posición fija. */
function getColumnas(hoja, mapa) {
  const filas = hoja.getRange(1, 1, 10, hoja.getLastColumn()).getValues();
  let encabezado = null;
  for (let i = 0; i < filas.length; i++) {
    for (let j = 0; j < filas[i].length; j++) {
      if (normalizar(filas[i][j]) === 'FECHA') { encabezado = filas[i]; break; }
    }
  }
  if (!encabezado) throw new Error('No encuentro el encabezado en ' + hoja.getName());

  const cols = {};
  const usadas = {};
  Object.keys(mapa).forEach(function (campo) {
    for (let i = 0; i < encabezado.length; i++) {
      if (usadas[i]) continue;
      const texto = normalizar(encabezado[i]);
      if (!texto) continue;
      const claves = mapa[campo];
      for (let k = 0; k < claves.length; k++) {
        if (texto.indexOf(normalizar(claves[k])) >= 0) {
          cols[campo] = i + 1;
          usadas[i] = true;
          return;
        }
      }
    }
  });
  return cols;
}

/**
 * Logo.gs
 * Convierte una imagen de Drive a base64 para incrustarla en la página.
 * Corre convertirLogo('ID_DE_DRIVE') una sola vez desde el editor.
 */


function ejecutarConversion() {
  convertirLogo('1J3DCwFvJFr3c0-OaZguhNcm9TJ0fi2cf');
}
function convertirLogo(idDrive) {
  const blob = DriveApp.getFileById(idDrive).getBlob();
  const base64 = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  const peso = Math.round(base64.length / 1024);

  // Si cabe en las propiedades del script, queda guardado y no tienes que pegar nada.
  if (base64.length < 9000) {
    PropertiesService.getScriptProperties().setProperty('LOGO', base64);
    Logger.log('Listo, logo guardado (' + peso + ' KB). No tienes que pegar nada.');
    return;
  }

  // Si pesa más, lo deja en un .txt en Drive para que copies y pegues.
  const archivo = DriveApp.createFile('logo-base64.txt', base64, MimeType.PLAIN_TEXT);
  Logger.log('El logo pesa ' + peso + ' KB. Copia el texto de: ' + archivo.getUrl());
}

/** Lo que usa la página: primero lo guardado, si no lo que esté en CONFIG.logo */
function getLogo() {
  return PropertiesService.getScriptProperties().getProperty('LOGO') || CONFIG.logo;
}

function revisarLogo() {
  const b64 = getLogo();
  Logger.log('Largo: ' + b64.length + ' caracteres');
  Logger.log('Inicio: ' + b64.substring(0, 60));
}