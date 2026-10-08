/**
 * InventarioTablero.gs
 * Agrega el inventario para el tablero de la pestaña Logística.
 */

const NOMBRE_ESTADO = {
  VENCIDO: 'Vencido', ROJO: 'Rojo', AMARILLO: 'Amarillo', VERDE: 'Verde', SIN_FECHA: 'Sin fecha', NO_APLICA: 'No vence'
};

/**
 * filtros: { tipo, ubicacion, estado, texto, registro } — todos opcionales, null = sin filtrar.
 * registro: 'ACTIVO' (por defecto) o 'TODOS' para ver también agotados y descartados.
 */
function getTableroInventario(filtros) {
  filtros = filtros || {};
  const cache = CacheService.getScriptCache();
  const clave = 'inv|' + versionCacheInventario() + '|' + hoyISO() + '|' +
    [filtros.tipo, filtros.ubicacion, filtros.estado, filtros.texto, filtros.registro].join('|');
  try {
    const guardado = cache.get(clave);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* se recalcula */ }

  const resultado = armarTablero(leerInventario(), filtros);

  // CacheService admite 100 KB por valor: si no cabe, simplemente no se guarda
  try {
    const json = JSON.stringify(resultado);
    if (json.length < 95000) cache.put(clave, json, CONFIG_INV.cacheSegundos);
  } catch (e) { /* no pasa nada */ }
  return resultado;
}

/** Llamada ligera para el contador de la pestaña: vencidos + rojos activos. */
function getContadorLogistica() {
  const cache = CacheService.getScriptCache();
  const clave = 'inv_cont|' + versionCacheInventario() + '|' + hoyISO();
  const guardado = cache.get(clave);
  if (guardado !== null) return Number(guardado);

  let n = 0;
  leerInventario().filas.forEach(function (f) {
    if (f.estadoRegistro === 'ACTIVO' && (f.estado === 'VENCIDO' || f.estado === 'ROJO')) n++;
  });
  cache.put(clave, String(n), CONFIG_INV.cacheSegundos);
  return n;
}

function armarTablero(inv, filtros) {
  const registro = filtros.registro === 'TODOS' ? 'TODOS' : 'ACTIVO';
  const buscado = sinTildes(filtros.texto || '');

  const filas = inv.filas.filter(function (f) {
    if (registro === 'ACTIVO' && f.estadoRegistro !== 'ACTIVO') return false;
    if (filtros.tipo && f.tipo !== filtros.tipo) return false;
    if (filtros.ubicacion && sinTildes(f.ubicacion) !== sinTildes(filtros.ubicacion)) return false;
    if (filtros.estado && f.estado !== filtros.estado) return false;
    if (buscado && sinTildes([f.producto, f.lote, f.laboratorio, f.invima].join(' ')).indexOf(buscado) < 0) return false;
    return true;
  });

  const totales = contarEstados(filas);
  totales.unidades = filas.reduce(function (s, f) { return s + f.cantidad; }, 0);
  totales.enCero = filas.filter(function (f) { return f.cantidad === 0; }).length;
  totales.sinLote = filas.filter(function (f) { return sinTildes(f.lote) === 'SIN LOTE' || !f.lote; }).length;

  const porTipo = {
    M: contarEstados(filas.filter(function (f) { return f.tipo === 'M'; })),
    DM: contarEstados(filas.filter(function (f) { return f.tipo === 'DM'; }))
  };

  const ubic = {};
  filas.forEach(function (f) {
    const n = f.ubicacion || 'Sin ubicación';
    if (!ubic[n]) ubic[n] = { nombre: n, registros: 0, vencidos: 0 };
    ubic[n].registros++;
    if (f.estado === 'VENCIDO') ubic[n].vencidos++;
  });

  const ordenadas = filas.slice().sort(ordenPrioridad);
  const porMes = vencimientosPorMes(filas);

  return {
    hoy: hoyISO(),
    totales: totales,
    porTipo: porTipo,
    porUbicacion: Object.keys(ubic).map(function (k) { return ubic[k]; }),
    porMes: porMes,
    filas: ordenadas.slice(0, CONFIG_INV.maxFilas).map(filaParaTabla),
    hayMas: ordenadas.length > CONFIG_INV.maxFilas,
    total: ordenadas.length,
    revisar: paraRevisarInventario(filas, totales),
    lecturaMeses: lecturaMeses(filas, porMes),
    lecturaTipos: lecturaTipos(porTipo, totales),
    avisos: inv.avisos
  };
}

function contarEstados(filas) {
  const c = { registros: filas.length, vencidos: 0, rojo: 0, amarillo: 0, verde: 0, sinFecha: 0, noAplica: 0 };
  const campo = { VENCIDO: 'vencidos', ROJO: 'rojo', AMARILLO: 'amarillo', VERDE: 'verde', SIN_FECHA: 'sinFecha', NO_APLICA: 'noAplica' };
  filas.forEach(function (f) { c[campo[f.estado]]++; });
  return c;
}

/** Lo que va al navegador: sin objetos Date ni campos que la tabla no usa. */
function filaParaTabla(f) {
  return {
    id: f.id, producto: f.producto, tipo: f.tipo, ubicacion: f.ubicacion, lote: f.lote,
    cantidad: f.cantidad, unidad: f.unidad, vence: f.vence, dias: f.dias,
    textoRestante: f.estado === 'NO_APLICA' ? 'No vence' : f.estado === 'SIN_FECHA' ? 'Falta la fecha' : textoRestante(f.dias),
    estado: f.estado, invima: f.invima, laboratorio: f.laboratorio, estadoRegistro: f.estadoRegistro
  };
}

/** Próximos 12 meses desde el mes actual. Cada mes lleva el color del estado en que entra. */
function vencimientosPorMes(filas) {
  const hoy = hoyISO().split('-');
  let anio = Number(hoy[0]), mes = Number(hoy[1]);
  const meses = [];
  for (let i = 0; i < 12; i++) {
    const clave = anio + '-' + (mes < 10 ? '0' : '') + mes;
    meses.push({ mes: clave, cantidad: 0, estado: i < CONFIG_INV.mesesRojo ? 'ROJO' : 'AMARILLO' });
    mes++;
    if (mes > 12) { mes = 1; anio++; }
  }
  filas.forEach(function (f) {
    if (!f.vence || f.dias < 0) return;
    const m = meses.filter(function (x) { return x.mes === f.vence.substring(0, 7); })[0];
    if (m) m.cantidad++;
  });
  return meses;
}

/** Máximo cinco avisos, de más grave a menos. */
function paraRevisarInventario(filas, totales) {
  const puntos = [];

  const vencidos = filas.filter(function (f) { return f.estado === 'VENCIDO'; })
    .sort(function (a, b) { return a.vence < b.vence ? -1 : 1; });
  if (vencidos.length) {
    puntos.push(plural(vencidos.length, 'producto ya vencido', 'productos ya vencidos') +
      '. El más antiguo venció en ' + nombreMesAnio(vencidos[0].vence) + '.');
  }

  // cruzaron la raya de los 6 meses en los últimos 7 días
  const limite = CONFIG_INV.mesesRojo * 30.44;
  const nuevosRojo = filas.filter(function (f) { return f.estado === 'ROJO' && f.dias + 7 >= limite; }).length;
  if (nuevosRojo) {
    puntos.push(plural(nuevosRojo, 'producto pasó', 'productos pasaron') + ' a rojo en los últimos 7 días.');
  }

  if (totales.sinFecha) {
    puntos.push(plural(totales.sinFecha, 'registro', 'registros') + ' sin fecha de vencimiento. No entran al semáforo.');
  }
  if (totales.enCero) {
    puntos.push(plural(totales.enCero, 'registro', 'registros') + ' con cantidad en cero. Verificar conteo físico; ' +
      'mientras tanto el total de unidades está subestimado.');
  }
  if (totales.sinLote) {
    puntos.push(plural(totales.sinLote, 'registro', 'registros') + ' sin lote.');
  }

  const invimaRaro = filas.filter(function (f) { return f.invima && !invimaValido(f.invima); }).length;
  if (invimaRaro) {
    puntos.push(plural(invimaRaro, 'registro tiene', 'registros tienen') + ' el registro INVIMA con un formato que no parece válido.');
  }

  return puntos.slice(0, 5);
}

/** Formatos reales: 2020DM-0022731, 2017M-3895-R4, 2023-DM-0010024-R1, NSOC47247-12CO. */
function invimaValido(texto) {
  const t = sinTildes(texto).replace(/\s/g, '');
  return /^\d{4}-?(DM|M)-?\d+(-R\d+)?$/.test(t) || /^NSO?C[0-9A-Z-]+$/.test(t);
}

function lecturaMeses(filas, porMes) {
  const tres = porMes.slice(0, 3).map(function (m) { return m.mes; });
  const proximos = filas.filter(function (f) { return f.vence && f.dias >= 0 && tres.indexOf(f.vence.substring(0, 7)) >= 0; });
  if (!proximos.length) {
    const siguiente = filas.filter(function (f) { return f.vence && f.dias >= 0; })
      .sort(function (a, b) { return a.vence < b.vence ? -1 : 1; })[0];
    return 'En los próximos 3 meses no vence ningún producto.' +
      (siguiente ? ' El siguiente vence en ' + nombreMesAnio(siguiente.vence) + ' (' + siguiente.producto + ').' : '');
  }
  const ubic = {};
  proximos.forEach(function (f) { ubic[f.ubicacion] = (ubic[f.ubicacion] || 0) + 1; });
  const nombres = Object.keys(ubic);
  const donde = nombres.length === 1
    ? (proximos.length === 1 ? 'en ' : 'todos en ') + nombres[0].toLowerCase()
    : nombres.map(function (n) { return ubic[n] + ' en ' + n.toLowerCase(); }).join(', ');
  return 'En los próximos 3 meses ' + (proximos.length === 1 ? 'vence 1 producto' : 'vencen ' + proximos.length + ' productos') +
    ', ' + donde + '.';
}

function lecturaTipos(porTipo, totales) {
  const urgentes = function (c) { return c.vencidos + c.rojo; };
  const total = urgentes(totales);
  if (!total) return 'No hay productos vencidos ni en rojo.';
  const m = urgentes(porTipo.M), dm = urgentes(porTipo.DM);
  const mayor = m >= dm ? 'medicamentos' : 'dispositivos';
  return 'De los ' + total + ' productos vencidos o en rojo, ' + Math.max(m, dm) + ' son ' + mayor +
    '. Sin fecha: ' + porTipo.M.sinFecha + ' medicamentos y ' + porTipo.DM.sinFecha + ' dispositivos.';
}

function plural(n, uno, varios) {
  return n + ' ' + (n === 1 ? uno : varios);
}

function nombreMesAnio(iso) {
  const p = iso.split('-');
  return MESES[Number(p[1]) - 1].toLowerCase() + ' de ' + p[0];
}
