/**
 * Oniderm · Gestión financiera y logística
 * Copyright (c) 2026 Rebeca Pedrozo. Todos los derechos reservados.
 * Software propietario y confidencial. Prohibido copiar, modificar, distribuir
 * o usar este archivo, total o parcialmente, sin autorización escrita de la autora.
 * Ver el archivo LICENSE.
 */

/**
 * Pacientes.gs  ·  ARCHIVO NUEVO (crearlo completo en el editor: + → Secuencia de comandos → "Pacientes")
 *
 * - Nombres, apellidos y cédula separados y normalizados (desde ahora obligatorios; los registros viejos no cambian).
 * - Buscar ingresos por nombre (en cualquier orden) o por cédula.
 * - Lista de ingresos pendientes de número de factura.
 * - Editar un ingreso ya guardado (por ejemplo, ponerle el número de factura al final del día).
 *
 * Las columnas NOMBRES, APELLIDOS y CEDULA se crean solas al final del encabezado de las hojas
 * de ingresos la primera vez que se guarda un paciente con este formulario.
 */

const CONFIG_PACIENTES = {
  diasPendientes: 45,      // la lista de pendientes mira solo los ingresos de los últimos N días
  soloSiSolicita: true,    // true: pendiente = "¿Factura?" en SI y sin número. false: todo ingreso sin número
  maxResultados: 40,       // máximo de resultados en una búsqueda
  columnasNuevas: { nombres: 'NOMBRES', apellidos: 'APELLIDOS', cedula: 'CEDULA' }
};

// palabras que van en minúscula dentro de un nombre: "María de los Ángeles"
const PARTICULAS_NOMBRE = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'];

/* ===================== NORMALIZACIÓN ===================== */

/** "LINA  marcela" → "Lina Marcela". Respeta tildes y guiones (María-José). */
function nombrePropio(texto) {
  const palabras = String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase().split(' ');
  return palabras.map(function (p, i) {
    if (i > 0 && PARTICULAS_NOMBRE.indexOf(p) >= 0) return p;
    return p.split('-').map(function (s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join('-');
  }).join(' ').trim();
}

/** "1.023.456.789" → "1023456789". Deja letras para pasaporte o cédula de extranjería. */
function limpiarCedula(texto) {
  return String(texto === null || texto === undefined ? '' : texto).toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Valida y normaliza los datos del paciente que llegan del formulario. */
function validarPaciente(datos) {
  const nombres = nombrePropio(datos.nombres);
  const apellidos = nombrePropio(datos.apellidos);
  const cedula = limpiarCedula(datos.cedula);
  if (!cedula) throw new Error('Falta la cédula del paciente.');
  if (cedula.length < 5 || cedula.length > 15) throw new Error('La cédula debe tener entre 5 y 15 caracteres.');
  if (!nombres) throw new Error('Faltan los nombres del paciente.');
  if (!apellidos) throw new Error('Faltan los apellidos del paciente.');
  return { nombres: nombres, apellidos: apellidos, cedula: cedula, completo: nombres + ' ' + apellidos };
}

/** Comisión del datáfono: misma regla que guardarIngreso. Devuelve '' si no aplica. */
function calcularComision(valor, formaPago) {
  const aplica = CONFIG.pagosConComision.map(sinTildes).indexOf(sinTildes(formaPago)) >= 0;
  return aplica ? Math.round(Number(valor) * CONFIG.comision) : '';
}

/**
 * Crea al final del encabezado las columnas NOMBRES, APELLIDOS y CEDULA si la hoja no las tiene.
 * Solo escribe el título de la columna; no toca datos.
 */
function asegurarColumnasPaciente(hoja) {
  let cols = getColumnas(hoja, COLS_INGRESO);
  const nuevas = CONFIG_PACIENTES.columnasNuevas;
  const faltan = Object.keys(nuevas).filter(function (campo) { return !cols[campo]; });
  if (!faltan.length) return cols;

  const filaEnc = cols.filaEncabezado;
  let col = hoja.getLastColumn();
  faltan.forEach(function (campo) {
    col++;
    const celda = hoja.getRange(filaEnc, col);
    celda.setValue(nuevas[campo]);
    try { hoja.getRange(filaEnc, col - 1).copyFormatToRange(hoja, col, col, filaEnc, filaEnc); } catch (e) { /* solo estética */ }
  });
  return getColumnas(hoja, COLS_INGRESO);
}

/** Para dejar las columnas creadas de una vez en las dos hojas (opcional; se crean solas al guardar). */
function prepararColumnasPacientes() {
  [CONFIG.ingresos[1], CONFIG.ingresos[2]].forEach(function (nombre) {
    asegurarColumnasPaciente(getHoja(nombre));
    Logger.log('Listo: ' + nombre);
  });
}

/* ===================== LECTURA ===================== */

/** Lee las dos hojas de ingresos y devuelve cada registro con su ubicación (hoja + fila). */
function leerIngresos() {
  const zona = Session.getScriptTimeZone();
  const registros = [];
  [CONFIG.ingresos[1], CONFIG.ingresos[2]].forEach(function (nombre) {
    const hoja = getHoja(nombre);
    const cols = getColumnas(hoja, COLS_INGRESO);
    const datos = hoja.getDataRange().getValues();
    for (let i = cols.filaEncabezado; i < datos.length; i++) {
      const r = filaAIngreso(datos[i], cols, hoja.getName(), i + 1, zona);
      if (r) registros.push(r);
    }
  });
  return registros;
}

function filaAIngreso(fila, cols, nombreHoja, numFila, zona) {
  const dato = function (campo) { return cols[campo] ? fila[cols[campo] - 1] : ''; };
  const texto = function (campo) { return textoCelda(dato(campo)); };
  const fecha = aFecha(dato('fecha'));
  if (!fecha) return null;
  const nombres = texto('nombres'), apellidos = texto('apellidos');
  return {
    hoja: nombreHoja.trim(),
    fila: numFila,
    fecha: Utilities.formatDate(fecha, zona || Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    nombres: nombres,
    apellidos: apellidos,
    paciente: texto('paciente') || (nombres + ' ' + apellidos).trim(),
    cedula: texto('cedula'),
    codigo: texto('codigo'),
    procedimiento: texto('procedimiento'),
    profesional: texto('profesional'),
    cantidad: aNumero(dato('cantidad')) || 1,
    valor: aNumero(dato('valor')),
    formaPago: texto('formaPago'),
    comision: aNumero(dato('comision')),
    total: aNumero(dato('total')),
    factura: sinTildes(texto('factura')) || 'NO',
    numFactura: texto('numFactura'),
    observaciones: texto('observaciones')
  };
}

/**
 * Huella del registro: si alguien inserta o borra filas en la hoja entre la búsqueda y el guardado,
 * la fila ya no corresponde y se rechaza la edición en vez de escribir en el paciente equivocado.
 */
function huellaIngreso(r) {
  return [r.fecha, sinTildes(r.paciente), sinTildes(r.codigo), r.valor].join('|');
}

function paraNavegador(r) {
  r.huella = huellaIngreso(r);
  return r;
}

function esPendienteFactura(r) {
  if (r.numFactura) return false;
  return CONFIG_PACIENTES.soloSiSolicita ? r.factura === 'SI' : true;
}

function ordenarRecientes(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return b.fila - a.fila;
}

/* ===================== FUNCIONES QUE LLAMA LA PÁGINA ===================== */

/** Busca por cédula o por nombre. "primo lina" encuentra a "Lina Primo": no importa el orden. */
function buscarIngresos(texto) {
  const buscado = sinTildes(texto);
  if (buscado.length < 3) throw new Error('Escribe al menos 3 letras o números para buscar.');
  const soloCedula = limpiarCedula(texto);
  const palabras = buscado.split(' ').filter(String);

  const encontrados = leerIngresos().filter(function (r) {
    if (soloCedula.length >= 5 && /\d/.test(soloCedula) && r.cedula && r.cedula.indexOf(soloCedula) >= 0) return true;
    const nombre = sinTildes(r.paciente + ' ' + r.nombres + ' ' + r.apellidos);
    return palabras.every(function (p) { return nombre.indexOf(p) >= 0; });
  }).sort(ordenarRecientes);

  return {
    resultados: encontrados.slice(0, CONFIG_PACIENTES.maxResultados).map(paraNavegador),
    total: encontrados.length
  };
}

/** Ingresos de los últimos días que todavía no tienen número de factura. */
function getPendientesFactura() {
  const hoy = hoyISO();
  const pendientes = leerIngresos().filter(function (r) {
    return esPendienteFactura(r) && diasEntre(r.fecha, hoy) <= CONFIG_PACIENTES.diasPendientes;
  }).sort(ordenarRecientes);
  return { pendientes: pendientes.map(paraNavegador), dias: CONFIG_PACIENTES.diasPendientes };
}

/** Para autocompletar el formulario: el nombre con que ya está registrada esa cédula. */
function buscarPacientePorCedula(cedula) {
  const cc = limpiarCedula(cedula);
  if (cc.length < 5) return null;
  const r = leerIngresos().filter(function (x) { return x.cedula === cc && x.nombres; }).sort(ordenarRecientes)[0];
  return r ? { nombres: r.nombres, apellidos: r.apellidos, cedula: r.cedula, ultimaVisita: r.fecha } : null;
}

/**
 * Edita un ingreso ya guardado. ref = { hoja, fila, huella } (viene de la búsqueda o de pendientes).
 * cambios: nombres, apellidos, cedula, profesional, valor, formaPago, factura, numFactura, observaciones.
 * La fecha y el servicio no se editan aquí porque cambian la hoja y el mes del registro.
 */
function actualizarIngreso(ref, cambios) {
  if (!ref || !ref.hoja || !ref.fila) throw new Error('No sé qué registro editar. Búscalo de nuevo.');
  const permitidas = [CONFIG.ingresos[1], CONFIG.ingresos[2]].map(normalizar);
  if (permitidas.indexOf(normalizar(ref.hoja)) < 0) throw new Error('Solo se pueden editar las hojas de ingresos.');
  cambios = cambios || {};

  return conCandado(function () {
    const hoja = getHoja(ref.hoja);
    const cols = asegurarColumnasPaciente(hoja);
    const fila = hoja.getRange(ref.fila, 1, 1, hoja.getLastColumn()).getValues()[0];
    const actual = filaAIngreso(fila, cols, hoja.getName(), Number(ref.fila));
    if (!actual || huellaIngreso(actual) !== ref.huella) {
      throw new Error('Este registro cambió en la hoja desde que lo buscaste. Búscalo de nuevo antes de editar.');
    }

    const nuevos = {};
    const tiene = function (campo) { return cambios[campo] !== undefined && cambios[campo] !== null; };

    // nombres y apellidos: van juntos y actualizan también "NOMBRE Y APELLIDO"
    if (tiene('nombres') || tiene('apellidos')) {
      const nombres = nombrePropio(tiene('nombres') ? cambios.nombres : actual.nombres);
      const apellidos = nombrePropio(tiene('apellidos') ? cambios.apellidos : actual.apellidos);
      if (nombres || apellidos) {
        if (!nombres || !apellidos) throw new Error('Escribe nombres y apellidos.');
        if (nombres !== actual.nombres) nuevos.nombres = nombres;
        if (apellidos !== actual.apellidos) nuevos.apellidos = apellidos;
        const completo = nombres + ' ' + apellidos;
        if (completo !== actual.paciente) nuevos.paciente = completo;
      }
    }
    if (tiene('cedula')) {
      const cc = limpiarCedula(cambios.cedula);
      if (cc && (cc.length < 5 || cc.length > 15)) throw new Error('La cédula debe tener entre 5 y 15 caracteres.');
      if (!cc && actual.cedula) throw new Error('La cédula no se puede dejar vacía.');
      if (cc !== actual.cedula) nuevos.cedula = cc;
    }
    if (tiene('profesional') && String(cambios.profesional).trim() !== actual.profesional) nuevos.profesional = String(cambios.profesional).trim();
    if (tiene('observaciones') && String(cambios.observaciones).trim() !== actual.observaciones) nuevos.observaciones = String(cambios.observaciones).trim();

    // valor o forma de pago: se recalculan comisión y total con la misma regla del formulario
    const valor = tiene('valor') ? Number(cambios.valor) : actual.valor;
    if (!(valor > 0)) throw new Error('El valor debe ser mayor a cero.');
    const formaPago = tiene('formaPago') ? String(cambios.formaPago).trim() : actual.formaPago;
    if (valor !== actual.valor || formaPago !== actual.formaPago) {
      const comision = calcularComision(valor, formaPago);
      nuevos.valor = valor;
      nuevos.formaPago = formaPago;
      nuevos.comision = comision;
      nuevos.total = valor - (comision || 0);
    }

    // factura: escribir un número marca automáticamente "SI"
    const numFactura = tiene('numFactura') ? String(cambios.numFactura).trim() : actual.numFactura;
    let factura = tiene('factura') ? sinTildes(cambios.factura) : actual.factura;
    if (numFactura) factura = 'SI';
    if (factura !== 'SI' && factura !== 'NO') throw new Error('"¿Factura?" debe ser SI o NO.');
    if (numFactura !== actual.numFactura) nuevos.numFactura = numFactura;
    if (factura !== actual.factura) nuevos.factura = factura;

    if (!Object.keys(nuevos).length) return { ok: true, mensaje: 'No había cambios que guardar.', registro: paraNavegador(actual) };

    actualizarCeldas(hoja, cols, Number(ref.fila), nuevos);

    const despues = filaAIngreso(hoja.getRange(ref.fila, 1, 1, hoja.getLastColumn()).getValues()[0], cols, hoja.getName(), Number(ref.fila));
    return {
      ok: true,
      mensaje: (nuevos.numFactura ? 'Factura ' + nuevos.numFactura + ' guardada' : 'Cambios guardados') + ' para ' + despues.paciente + '.',
      registro: paraNavegador(despues)
    };
  });
}

/* ===================== AYUDANTES ===================== */

/** Escribe celdas sueltas de una fila, respetando las listas desplegables y deshaciendo si la hoja rechaza algo. */
function actualizarCeldas(hoja, cols, fila, valores) {
  const cambios = [];
  Object.keys(valores).forEach(function (campo) {
    if (!cols[campo]) return;
    const celda = hoja.getRange(fila, cols[campo]);
    const valor = valores[campo] === '' ? '' : ajustarAValidacion(hoja, celda, campo, valores[campo]);
    cambios.push({ campo: campo, celda: celda, valor: valor });
  });
  const escritas = [];
  try {
    cambios.forEach(function (c) {
      escritas.push({ celda: c.celda, antes: c.celda.getValue() });
      if (c.campo === 'cedula' || c.campo === 'numFactura') c.celda.setNumberFormat('@'); // texto: no perder ceros
      c.celda.setValue(c.valor);
      SpreadsheetApp.flush();
    });
  } catch (e) {
    escritas.reverse().forEach(function (x) { try { x.celda.setValue(x.antes); } catch (e2) { /* se intentó */ } });
    const c = cambios[escritas.length - 1];
    throw new Error('La hoja no aceptó ' + (c ? 'la columna ' + c.campo.toUpperCase() + ' (valor "' + c.valor + '")' : 'el cambio') +
                    '. No se guardó nada. Detalle: ' + e.message);
  }
}
