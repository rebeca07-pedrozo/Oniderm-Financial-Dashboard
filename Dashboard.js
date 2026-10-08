/**
 * Dashboard.gs
 * Lee las 4 hojas, limpia los datos y entrega los totales agregados.
 */

const TOPE_RARO = 50000000; // por encima de esto es error de digitación

function getResumen() {
  const avisos = [];
  const nombres = mapaServicios();

  const meses = {};
  const serv = {};
  const gast = {};

  leerHoja(CONFIG.ingresos, COLS_INGRESO, avisos, function (f, cols, fila, mes) {
    const valor = aNumero(fila[cols.valor - 1]);
    const bold = aNumero(fila[cols.comision - 1]);
    let total = aNumero(fila[cols.total - 1]);
    if (total <= 0 || total > valor) total = valor - bold;

    const caja = iniciarMes(meses, mes);
    caja.ingreso += total;
    caja.comision += bold;
    caja.atenciones += 1;

    const cod = codigoLimpio(fila[cols.codigo - 1]);
    const nombre = nombres[cod] || String(fila[cols.procedimiento - 1] || '').trim() || 'Sin servicio';
    sumar(serv, mes + '|' + nombre, total);
  });

  leerHoja(CONFIG.egresos, COLS_EGRESO, avisos, function (f, cols, fila, mes) {
    const valor = aNumero(fila[cols.valor - 1]);
    iniciarMes(meses, mes).egreso += valor;
    const concepto = String(fila[cols.concepto - 1] || 'Sin concepto').trim();
    sumar(gast, mes + '|' + concepto, valor);
  });

  return {
    meses: Object.keys(meses).sort().map(function (k) { return meses[k]; }),
    servicios: desarmar(serv),
    gastos: desarmar(gast),
    avisos: avisos
  };
}

function leerHoja(hojas, mapa, avisos, procesar) {
  [hojas[1], hojas[2]].forEach(function (nombre) {
    const hoja = getHoja(nombre);
    const cols = getColumnas(hoja, mapa);
    const ultima = ultimaFilaConDatos(hoja, cols.fecha);
    if (ultima < 2) return;

    const datos = hoja.getRange(1, 1, ultima, hoja.getLastColumn()).getValues();
    const tope = new Date().getFullYear() + 1;

    for (let i = 0; i < datos.length; i++) {
      const cruda = datos[i][cols.fecha - 1];
      if (cruda === '' || cruda === null) continue;

      const fecha = aFecha(cruda);
      if (!fecha) {
        if (i > 4) avisos.push({ hoja: nombre.trim(), fila: i + 1, que: 'fecha ilegible' });
        continue;
      }
      if (fecha.getFullYear() < 2024 || fecha.getFullYear() > tope) {
        avisos.push({ hoja: nombre.trim(), fila: i + 1, que: 'fecha fuera de rango' });
        continue;
      }

      const columnaValor = cols.valor;
      if (aNumero(datos[i][columnaValor - 1]) > TOPE_RARO) {
        avisos.push({ hoja: nombre.trim(), fila: i + 1, que: 'valor atípico' });
        continue;
      }

      const m = fecha.getMonth() + 1;
      procesar(fecha, cols, datos[i], fecha.getFullYear() + '-' + (m < 10 ? '0' : '') + m);
    }
  });
}

function mapaServicios() {
  const mapa = {};
  getCatalogo().servicios.forEach(function (s) {
    const c = codigoLimpio(s.codigo);
    if (c && !mapa[c]) mapa[c] = s.nombre;
  });
  return mapa;
}

/** C01 y CO1 (con letra O) se tratan como el mismo código */
function codigoLimpio(valor) {
  return String(valor || '').toUpperCase().replace(/\s+/g, '').replace(/O/g, '0');
}

/** Acepta fecha real o texto tipo 22/09/2025 */
function aFecha(valor) {
  if (valor instanceof Date) return valor;
  const t = String(valor).trim();
  const p = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  return p ? new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1])) : null;
}

/** Acepta 210000 y también "$ 210.000,00" */
function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return valor;

  let s = String(valor).replace(/[^0-9.,-]/g, '');
  if (!/\d/.test(s)) return 0;

  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf(',') >= 0) {
    const cola = s.split(',').pop();
    s = cola.length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  } else if (s.indexOf('.') >= 0 && s.split('.').pop().length === 3) {
    s = s.replace(/\./g, '');
  }

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function iniciarMes(meses, mes) {
  if (!meses[mes]) meses[mes] = { mes: mes, ingreso: 0, egreso: 0, comision: 0, atenciones: 0 };
  return meses[mes];
}

function sumar(objeto, clave, valor) {
  objeto[clave] = (objeto[clave] || 0) + valor;
}

function desarmar(objeto) {
  return Object.keys(objeto).map(function (k) {
    const p = k.split('|');
    return { mes: p[0], nombre: p[1], valor: objeto[k] };
  });
}