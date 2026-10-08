/**
 * Inventario.gs
 * Lee, escribe y da de baja registros de la hoja INVENTARIO (libro de inventario).
 * El semáforo se calcula al vuelo cada vez que se lee; nunca se guarda en celdas.
 */

/* ===================== LECTURA ===================== */

/** Lee toda la hoja INVENTARIO con un solo getValues y calcula el estado de cada registro. */
function leerInventario() {
  const libro = getLibroInventario();
  let hoja;
  try {
    hoja = getHoja(CONFIG_INV.hoja, libro);
  } catch (e) {
    throw new Error('El libro de inventario no tiene la hoja ' + CONFIG_INV.hoja +
                    '. Corre migrarInventario() una vez desde el editor de Apps Script.');
  }
  const cols = getColumnasExactas(hoja, COLS_INVENTARIO);
  const zonaLibro = libro.getSpreadsheetTimeZone();
  const datos = hoja.getDataRange().getValues();
  const hoy = hoyISO();

  const filas = [];
  const avisos = [];
  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const dato = function (nombre) { return fila[cols[nombre] - 1]; };
    const texto = function (nombre) { return textoCelda(dato(nombre)); };
    if (dato('ID') === '' && texto('PRODUCTO') === '') continue;

    const vence = leerFecha(dato('FECHA_VENCIMIENTO'), zonaLibro);
    if (vence === undefined) avisos.push({ fila: i + 1, hoja: CONFIG_INV.hoja, que: 'fecha de vencimiento ilegible' });
    const noVence = sinTildes(dato('NO_VENCE')) === 'SI';
    const calculo = calcularEstado(vence || null, noVence, hoy);

    filas.push({
      fila: i + 1,
      id: Number(dato('ID')) || 0,
      producto: texto('PRODUCTO'),
      tipo: sinTildes(dato('TIPO')) === 'DM' ? 'DM' : 'M',
      ubicacion: texto('UBICACION'),
      lote: texto('LOTE'),
      cantidad: aNumero(dato('CANTIDAD')),
      unidad: texto('UNIDAD'),
      vence: vence || null,
      noVence: noVence,
      ingreso: leerFecha(dato('FECHA_INGRESO'), zonaLibro) || null,
      estado: calculo.estado,
      dias: calculo.dias,
      meses: calculo.meses,
      invima: texto('REGISTRO_INVIMA'),
      laboratorio: texto('LABORATORIO'),
      presentacion: texto('PRESENTACION'),
      principio: texto('PRINCIPIO_ACTIVO'),
      concentracion: texto('CONCENTRACION'),
      forma: texto('FORMA_FARMACEUTICA'),
      marca: texto('MARCA'),
      responsable: texto('RESPONSABLE'),
      observaciones: texto('OBSERVACIONES'),
      estadoRegistro: sinTildes(dato('ESTADO_REGISTRO')) || 'ACTIVO',
      ultimoEstado: sinTildes(dato('ULTIMO_ESTADO'))
    });
  }
  return { libro: libro, hoja: hoja, cols: cols, filas: filas, avisos: avisos, ultimaFila: datos.length };
}

/** 'yyyy-MM-dd' si es fecha, null si está vacía, undefined si hay algo que no se entiende. */
function leerFecha(valor, zona) {
  if (valor === '' || valor === null || valor === undefined) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? undefined : fechaISO(valor, zona);
  const fecha = aFecha(valor);
  return fecha ? fechaISO(fecha, Session.getScriptTimeZone()) : undefined;
}

function hoyISO() {
  return fechaISO(new Date(), CONFIG_INV.zona);
}

/** Días entre dos fechas 'yyyy-MM-dd', sin que importe la hora ni la zona horaria. */
function diasEntre(desdeISO, hastaISO) {
  const a = desdeISO.split('-'), b = hastaISO.split('-');
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}

/** Estado del semáforo. venceISO: 'yyyy-MM-dd' o null. */
function calcularEstado(venceISO, noVence, hoy) {
  if (noVence) return { estado: 'NO_APLICA', dias: null, meses: null };
  if (!venceISO) return { estado: 'SIN_FECHA', dias: null, meses: null };

  const dias = diasEntre(hoy || hoyISO(), venceISO);
  const meses = dias / 30.44;

  let estado;
  if (dias < 0) estado = 'VENCIDO';
  else if (meses < CONFIG_INV.mesesRojo) estado = 'ROJO';
  else if (meses < CONFIG_INV.mesesAmarillo) estado = 'AMARILLO';
  else estado = 'VERDE';
  return { estado: estado, dias: dias, meses: meses };
}

/** "Venció hace 3 meses", "En 45 días", "En 8 meses". */
function textoRestante(dias) {
  if (dias === null || dias === undefined) return '';
  if (dias === 0) return 'Vence hoy';
  const abs = Math.abs(dias);
  const meses = Math.round(abs / 30.44);
  const anios = Math.floor(abs / 365.25);
  let cuanto;
  if (abs < 60) cuanto = abs + (abs === 1 ? ' día' : ' días');
  else if (meses < 24) cuanto = meses + ' meses';
  else cuanto = anios + ' años';
  return dias < 0 ? 'Venció hace ' + cuanto : 'En ' + cuanto;
}

function ordenPrioridad(a, b) {
  const pa = ESTADOS_SEMAFORO.indexOf(a.estado), pb = ESTADOS_SEMAFORO.indexOf(b.estado);
  if (pa !== pb) return pa - pb;
  if (!a.vence || !b.vence) return 0;
  return a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0;
}

/** Llave anti-duplicados: producto normalizado + lote + vencimiento. */
function llaveInsumo(producto, lote, venceISO) {
  return sinTildes(producto) + '|' + sinTildes(lote) + '|' + (venceISO || '');
}

/* ===================== ESCRITURA ===================== */

/**
 * Guarda un ingreso. Si ya hay uno ACTIVO con el mismo producto, lote y vencimiento,
 * no escribe nada y devuelve { duplicado, existente, mensaje } para que el usuario decida.
 */
function guardarInsumo(datos) {
  const limpio = validarInsumo(datos);
  return conCandado(function () {
    const inv = leerInventario();
    const llave = llaveInsumo(limpio.producto, limpio.lote, limpio.venceISO);
    const igual = inv.filas.filter(function (f) {
      return f.estadoRegistro === 'ACTIVO' && llaveInsumo(f.producto, f.lote, f.vence) === llave;
    })[0];
    if (igual) {
      return {
        duplicado: true,
        existente: { id: igual.id, cantidad: igual.cantidad, unidad: igual.unidad },
        mensaje: 'Ya hay ' + igual.cantidad + ' ' + (igual.unidad || 'unidades') + ' de ' + igual.producto +
                 ' lote ' + igual.lote + (igual.vence ? ' venciendo el ' + fechaCorta(igual.vence) : '') +
                 '. ¿Sumar al existente o crear un registro aparte?'
      };
    }
    return escribirInsumo(inv, limpio);
  });
}

/** Resuelve un duplicado. accion: 'sumar' (suma a datos.idExistente) o 'nuevo' (fila aparte). */
function confirmarInsumo(datos, accion) {
  const limpio = validarInsumo(datos);
  return conCandado(function () {
    const inv = leerInventario();
    if (accion === 'nuevo') return escribirInsumo(inv, limpio);
    if (accion !== 'sumar') throw new Error('Acción desconocida: ' + accion);

    const r = buscarRegistro(inv, datos.idExistente);
    const nueva = r.cantidad + limpio.cantidad;
    inv.hoja.getRange(r.fila, inv.cols.CANTIDAD).setValue(nueva);
    anotar(inv, r, 'Ingresaron ' + limpio.cantidad + ' ' + limpio.unidad + ' más (' + limpio.responsable + ')');
    invalidarCacheInventario();
    return { ok: true, mensaje: 'Sumado: ' + r.producto + ' queda con ' + nueva + ' ' + (r.unidad || 'unidades') + '.' };
  });
}

/** Cambia ESTADO_REGISTRO a AGOTADO o DESCARTADO y escribe FECHA_BAJA. Nunca borra la fila. */
function darDeBaja(id, estado, motivo) {
  if (['AGOTADO', 'DESCARTADO'].indexOf(estado) < 0) throw new Error('Estado no válido: ' + estado);
  return conCandado(function () {
    const inv = leerInventario();
    const r = buscarRegistro(inv, id);
    if (r.estadoRegistro !== 'ACTIVO') throw new Error(r.producto + ' ya estaba ' + r.estadoRegistro.toLowerCase() + '.');
    inv.hoja.getRange(r.fila, inv.cols.ESTADO_REGISTRO).setValue(estado);
    inv.hoja.getRange(r.fila, inv.cols.FECHA_BAJA).setValue(new Date()).setNumberFormat('dd/mm/yyyy');
    anotar(inv, r, (estado === 'AGOTADO' ? 'Agotado' : 'Descartado') + (motivo ? ': ' + motivo : ''));
    invalidarCacheInventario();
    return { ok: true, mensaje: r.producto + ' (lote ' + r.lote + ') quedó ' + estado.toLowerCase() + '.' };
  });
}

/** Completa la fecha de un registro que entró sin ella, o lo marca como "no vence". */
function completarVencimiento(id, fecha, noVence) {
  let venceFecha = null;
  if (!noVence) {
    venceFecha = aFecha(fecha);
    if (!venceFecha) throw new Error('Escribe una fecha de vencimiento válida o marca "No vence".');
  }
  return conCandado(function () {
    const inv = leerInventario();
    const r = buscarRegistro(inv, id);
    const celda = inv.hoja.getRange(r.fila, inv.cols.FECHA_VENCIMIENTO);
    if (venceFecha) celda.setValue(venceFecha).setNumberFormat('dd/mm/yyyy');
    else celda.clearContent();
    inv.hoja.getRange(r.fila, inv.cols.NO_VENCE).setValue(noVence ? 'SI' : '');
    // el estado nuevo queda como punto de partida para la alerta diaria
    const calculo = calcularEstado(venceFecha ? fechaISO(venceFecha, Session.getScriptTimeZone()) : null, !!noVence);
    inv.hoja.getRange(r.fila, inv.cols.ULTIMO_ESTADO).setValue(calculo.estado);
    invalidarCacheInventario();
    return { ok: true, mensaje: r.producto + ': ' + (noVence ? 'marcado como "no vence".' : 'fecha guardada.') };
  });
}

/** Corrige la cantidad (los dispositivos migrados entraron en cero). */
function corregirCantidad(id, cantidad) {
  const n = Number(cantidad);
  if (!(n >= 0)) throw new Error('La cantidad debe ser un número igual o mayor a cero.');
  return conCandado(function () {
    const inv = leerInventario();
    const r = buscarRegistro(inv, id);
    inv.hoja.getRange(r.fila, inv.cols.CANTIDAD).setValue(n);
    anotar(inv, r, 'Cantidad corregida de ' + r.cantidad + ' a ' + n);
    invalidarCacheInventario();
    return { ok: true, mensaje: r.producto + ': cantidad ' + n + '.' };
  });
}

/** Listas para el formulario: productos ya registrados (autocompletado), unidades, ubicaciones, responsables. */
function getCatalogoInventario() {
  const inv = leerInventario();
  const productos = {};
  const unidades = CONFIG_INV.unidades.slice();
  const responsables = [];

  const extra = PropertiesService.getScriptProperties().getProperty('RESPONSABLES_INVENTARIO');
  if (extra) extra.split(',').forEach(function (n) { agregarUnico(responsables, n.trim()); });

  inv.filas.forEach(function (f) {
    const clave = sinTildes(f.producto);
    if (clave && !productos[clave]) {
      productos[clave] = {
        nombre: f.producto, tipo: f.tipo, unidad: f.unidad, laboratorio: f.laboratorio,
        presentacion: f.presentacion, principio: f.principio, concentracion: f.concentracion,
        forma: f.forma, marca: f.marca, invima: f.invima
      };
    }
    agregarUnico(unidades, f.unidad);
    agregarUnico(responsables, f.responsable);
  });

  return {
    productos: Object.keys(productos).sort().map(function (k) { return productos[k]; }),
    unidades: unidades,
    ubicaciones: CONFIG_INV.ubicaciones,
    responsables: responsables,
    clasifRiesgo: CONFIG_INV.clasifRiesgo
  };
}

/* ===================== AYUDANTES ===================== */

function validarInsumo(datos) {
  if (!datos) throw new Error('No llegaron datos.');
  const texto = function (campo) { return String(datos[campo] === undefined || datos[campo] === null ? '' : datos[campo]).trim(); };

  const tipo = texto('tipo').toUpperCase();
  if (tipo !== 'M' && tipo !== 'DM') throw new Error('Elige si es medicamento o dispositivo.');
  if (!texto('producto')) throw new Error('Falta el producto.');
  if (!texto('lote')) throw new Error('Falta el lote. Si de verdad no tiene, escribe SIN LOTE.');
  const cantidad = Number(datos.cantidad);
  if (!(cantidad > 0)) throw new Error('La cantidad debe ser mayor a cero.');
  if (!texto('unidad')) throw new Error('Falta la unidad.');

  const noVence = datos.noVence === true || sinTildes(datos.noVence) === 'SI';
  let vence = null;
  if (!noVence) {
    vence = aFecha(texto('vence'));
    if (!vence) throw new Error('Falta la fecha de vencimiento. Si el producto no vence, marca "No vence".');
  }
  const ingreso = aFecha(texto('ingreso'));
  if (!ingreso) throw new Error('Falta la fecha de ingreso.');

  const ubicacion = CONFIG_INV.ubicaciones.filter(function (u) { return sinTildes(u) === sinTildes(texto('ubicacion')); })[0];
  if (!ubicacion) throw new Error('Elige la ubicación: ' + CONFIG_INV.ubicaciones.join(', ') + '.');
  if (!texto('responsable')) throw new Error('Falta quién registra (responsable).');

  const esM = tipo === 'M';
  return {
    tipo: tipo, producto: texto('producto'), lote: texto('lote'), cantidad: cantidad, unidad: texto('unidad'),
    vence: vence, venceISO: vence ? fechaISO(vence, Session.getScriptTimeZone()) : null, noVence: noVence,
    ingreso: ingreso, ubicacion: ubicacion, responsable: texto('responsable'),
    invima: texto('invima'), laboratorio: texto('laboratorio'), presentacion: texto('presentacion'),
    condiciones: texto('condiciones'), observaciones: texto('observaciones'),
    // solo los campos del tipo elegido
    principio: esM ? texto('principio') : '', concentracion: esM ? texto('concentracion') : '',
    forma: esM ? texto('forma') : '',
    marca: esM ? '' : texto('marca'), serie: esM ? '' : texto('serie'), riesgo: esM ? '' : texto('riesgo')
  };
}

/** Escribe una fila nueva al final de INVENTARIO con un solo setValues. Se llama dentro del candado. */
function escribirInsumo(inv, d) {
  const id = inv.filas.reduce(function (max, f) { return Math.max(max, f.id); }, 0) + 1;
  const estado = calcularEstado(d.venceISO, d.noVence).estado;
  const valores = {
    ID: id, FECHA_REGISTRO: new Date(), FECHA_INGRESO: d.ingreso, TIPO: d.tipo, UBICACION: d.ubicacion,
    PRODUCTO: d.producto, LOTE: d.lote, CANTIDAD: d.cantidad, UNIDAD: d.unidad,
    FECHA_VENCIMIENTO: d.vence || '', NO_VENCE: d.noVence ? 'SI' : '', REGISTRO_INVIMA: d.invima,
    LABORATORIO: d.laboratorio, PRESENTACION: d.presentacion, PRINCIPIO_ACTIVO: d.principio,
    CONCENTRACION: d.concentracion, FORMA_FARMACEUTICA: d.forma, MARCA: d.marca, SERIE: d.serie,
    CLASIF_RIESGO: d.riesgo, CONDICIONES_ALMACEN: d.condiciones, RESPONSABLE: d.responsable,
    OBSERVACIONES: d.observaciones, ESTADO_REGISTRO: 'ACTIVO', FECHA_BAJA: '', ULTIMO_ESTADO: estado
  };

  const ancho = inv.hoja.getLastColumn();
  const fila = [];
  for (let i = 0; i < ancho; i++) fila.push('');
  Object.keys(valores).forEach(function (nombre) { fila[inv.cols[nombre] - 1] = valores[nombre]; });

  const destino = inv.ultimaFila + 1;
  COLS_TEXTO_INVENTARIO.forEach(function (n) { inv.hoja.getRange(destino, inv.cols[n]).setNumberFormat('@'); });
  inv.hoja.getRange(destino, 1, 1, ancho).setValues([fila]);
  formatearFechas(inv.hoja, inv.cols, destino, 1);
  invalidarCacheInventario();

  return { ok: true, id: id, mensaje: d.producto + ' registrado (ID ' + id + ').' };
}

function formatearFechas(hoja, cols, desde, cuantas) {
  hoja.getRange(desde, cols.FECHA_REGISTRO, cuantas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  ['FECHA_INGRESO', 'FECHA_VENCIMIENTO', 'FECHA_BAJA'].forEach(function (n) {
    hoja.getRange(desde, cols[n], cuantas, 1).setNumberFormat('dd/mm/yyyy');
  });
}

function buscarRegistro(inv, id) {
  const r = inv.filas.filter(function (f) { return f.id === Number(id); })[0];
  if (!r) throw new Error('No encuentro el registro ' + id + '. Recarga el tablero.');
  return r;
}

/** Agrega una línea fechada a OBSERVACIONES sin borrar lo que había. */
function anotar(inv, r, texto) {
  const linea = '[' + Utilities.formatDate(new Date(), CONFIG_INV.zona, 'dd/MM/yyyy') + '] ' + texto;
  inv.hoja.getRange(r.fila, inv.cols.OBSERVACIONES).setValue(r.observaciones ? r.observaciones + '\n' + linea : linea);
}

/** Toda escritura pasa por aquí: dos personas guardando a la vez no se pisan la fila. */
function conCandado(accion) {
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) throw new Error('Otra persona está guardando en este momento. Intenta de nuevo en unos segundos.');
  try {
    return accion();
  } finally {
    candado.releaseLock();
  }
}

function fechaCorta(iso) {
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function agregarUnico(lista, valor) {
  const v = String(valor || '').trim();
  if (!v) return;
  if (lista.some(function (x) { return sinTildes(x) === sinTildes(v); })) return;
  lista.push(v);
}

/* ===================== CACHÉ ===================== */

/** CacheService no se puede vaciar entero: cada escritura cambia la versión y las claves viejas quedan huérfanas. */
function versionCacheInventario() {
  const cache = CacheService.getScriptCache();
  let version = cache.get('inv_version');
  if (!version) {
    version = String(Date.now());
    cache.put('inv_version', version, 21600);
  }
  return version;
}

function invalidarCacheInventario() {
  CacheService.getScriptCache().put('inv_version', String(Date.now()), 21600);
}
