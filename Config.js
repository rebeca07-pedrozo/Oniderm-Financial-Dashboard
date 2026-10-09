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

/* ===================== LOGÍSTICA ===================== */

const CONFIG_INV = {
  hoja: 'INVENTARIO',
  zona: 'America/Bogota',
  mesesRojo: 6,           // menos de 6 meses para vencer: rojo
  mesesAmarillo: 12,      // entre 6 y 12: amarillo; más: verde
  maxFilas: 150,          // filas que se mandan al navegador de una vez
  cacheSegundos: 600,     // 10 minutos
  horaRevision: 7,        // hora del correo diario
  ubicaciones: ['Almacén', 'Botiquín', 'Kit derrames'],
  unidades: ['unidades', 'ml', 'g', 'mg', 'pares', 'cajas', 'frascos', 'sobres', 'rollos', 'paquetes'],
  clasifRiesgo: ['I', 'IIA', 'IIB', 'III']
};

// Encabezados de la hoja INVENTARIO, en orden. La hoja se lee por nombre de encabezado.
const COLS_INVENTARIO = [
  'ID', 'FECHA_REGISTRO', 'FECHA_INGRESO', 'TIPO', 'UBICACION', 'PRODUCTO', 'LOTE',
  'CANTIDAD', 'UNIDAD', 'FECHA_VENCIMIENTO', 'NO_VENCE', 'REGISTRO_INVIMA', 'LABORATORIO',
  'PRESENTACION', 'PRINCIPIO_ACTIVO', 'CONCENTRACION', 'FORMA_FARMACEUTICA', 'MARCA', 'SERIE',
  'CLASIF_RIESGO', 'CONDICIONES_ALMACEN', 'RESPONSABLE', 'OBSERVACIONES', 'ESTADO_REGISTRO',
  'FECHA_BAJA', 'ULTIMO_ESTADO'
];

// Estados del semáforo, de más grave a menos. El orden define la prioridad en la tabla.
const ESTADOS_SEMAFORO = ['VENCIDO', 'ROJO', 'AMARILLO', 'VERDE', 'SIN_FECHA', 'NO_APLICA'];

/**
 * Libro de inventario (distinto al de finanzas). Su ID va en Script Properties: ID_LIBRO_INVENTARIO.
 */
function getLibroInventario() {
  const id = PropertiesService.getScriptProperties().getProperty('ID_LIBRO_INVENTARIO');
  if (!id) throw new Error('Falta la propiedad ID_LIBRO_INVENTARIO en la configuración del proyecto.');
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    let tipo = '';
    try { tipo = DriveApp.getFileById(id).getMimeType(); } catch (e2) { /* sin acceso al archivo */ }
    if (/excel|spreadsheetml/i.test(tipo)) {
      throw new Error('El ID apunta a un archivo Excel, no a un Google Sheet. Conviértelo con ' +
                      'Archivo → Guardar como Hojas de cálculo de Google y guarda el ID nuevo.');
    }
    throw new Error('No pude abrir el libro de inventario (ID ' + id + '): ' + e.message);
  }
}

/**
 * Columnas de una hoja con encabezados exactos en la fila 1 (como INVENTARIO).
 * Devuelve { NOMBRE: númeroDeColumna }. Ignora mayúsculas, tildes y espacios.
 */
function getColumnasExactas(hoja, nombres) {
  const encabezado = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0];
  const cols = {};
  encabezado.forEach(function (texto, i) {
    const limpio = sinTildes(texto).replace(/ /g, '_');
    nombres.forEach(function (n) { if (limpio === n && !cols[n]) cols[n] = i + 1; });
  });
  const faltan = nombres.filter(function (n) { return !cols[n]; });
  if (faltan.length) throw new Error('A la hoja ' + hoja.getName() + ' le faltan las columnas: ' + faltan.join(', '));
  return cols;
}

/** Columnas de INVENTARIO que son texto aunque parezcan número o fecha (lote 0199060, 09-10-2025). */
const COLS_TEXTO_INVENTARIO = ['LOTE', 'REGISTRO_INVIMA', 'SERIE'];

/** Valor de celda como texto. Si Sheets/Excel lo convirtió en fecha, se muestra dd/mm/aaaa. */
function textoCelda(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return isNaN(valor.getTime()) ? '' : Utilities.formatDate(valor, CONFIG_INV.zona, 'dd/MM/yyyy');
  return String(valor).trim();
}

/** Fecha como 'yyyy-MM-dd' en una zona horaria (por defecto la de Bogotá). */
function fechaISO(fecha, zona) {
  return Utilities.formatDate(fecha, zona || CONFIG_INV.zona, 'yyyy-MM-dd');
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
               'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Si existe la propiedad ID_LIBRO usa ese libro (sirve para tener uno de pruebas). */
function getLibro() {
  const id = PropertiesService.getScriptProperties().getProperty('ID_LIBRO');
  if (id) return SpreadsheetApp.openById(id);
  const libro = SpreadsheetApp.getActive();
  if (!libro) throw new Error('El script no está dentro de la hoja de cálculo. Ábrelo desde Extensiones > Apps Script de la hoja, o guarda el ID de la hoja en la propiedad ID_LIBRO.');
  return libro;
}

/**
 * Busca la hoja ignorando mayúsculas y espacios de más (la del II semestre tiene un espacio al inicio).
 * Sin `libro` busca en el de ingresos y egresos; para inventario se pasa getLibroInventario().
 */
function getHoja(nombre, libro) {
  const buscado = normalizar(nombre);
  const hojas = (libro || getLibro()).getSheets();
  for (let i = 0; i < hojas.length; i++) {
    if (normalizar(hojas[i].getName()) === buscado) return hojas[i];
  }
  throw new Error('No encuentro la hoja: ' + nombre);
}

function normalizar(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Igual que normalizar pero sin tildes (DÉBITO -> DEBITO). */
function sinTildes(texto) {
  return normalizar(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convierte a fecha lo que venga: fecha real de la hoja, "2025-09-22" (formulario)
 * o "22/09/2025" (texto en la hoja). Devuelve null si no se entiende.
 * Ojo: Apps Script comparte un solo espacio de nombres entre archivos,
 * así que esta función debe existir una sola vez en todo el proyecto.
 */
function aFecha(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const t = String(valor === null || valor === undefined ? '' : valor).trim();
  let p = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (p) return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]), 12, 0, 0);
  p = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (p) return new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]), 12, 0, 0);
  return null;
}

/**
 * Ubica las columnas por el texto del encabezado, no por posición fija.
 * Toma como encabezado la fila (de las primeras 15) que más campos del mapa reconoce,
 * así sirve tanto para las hojas de movimientos como para CUENTAS CONTABLES.
 */
function getColumnas(hoja, mapa) {
  const ancho = hoja.getLastColumn();
  const alto = Math.min(15, hoja.getLastRow());
  if (ancho < 1 || alto < 1) throw new Error('La hoja ' + hoja.getName() + ' está vacía');
  const filas = hoja.getRange(1, 1, alto, ancho).getValues();

  let mejor = {};
  let puntaje = 0;
  let filaEncabezado = 0;
  for (let i = 0; i < filas.length; i++) {
    const cols = buscarColumnas(filas[i], mapa);
    const n = Object.keys(cols).length;
    if (n > puntaje) { mejor = cols; puntaje = n; filaEncabezado = i + 1; }
  }
  if (!puntaje) throw new Error('No encuentro el encabezado en ' + hoja.getName());
  // número de la fila de encabezado, sin que cuente como campo
  Object.defineProperty(mejor, 'filaEncabezado', { value: filaEncabezado, enumerable: false });
  return mejor;
}

function buscarColumnas(encabezado, mapa) {
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
