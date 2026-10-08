/**
 * InventarioAlertas.gs
 * Revisión diaria: compara el semáforo de hoy con ULTIMO_ESTADO y manda correo
 * SOLO si algo empeoró (verde→amarillo, amarillo→rojo, rojo→vencido…).
 * Destinatarios: propiedad CORREOS_ALERTA (separados por coma).
 */

// Cuanto más alto, peor. SIN_FECHA y NO_APLICA no participan en la comparación.
const GRAVEDAD = { VERDE: 0, AMARILLO: 1, ROJO: 2, VENCIDO: 3 };

/** La corre el disparador diario. También se puede correr a mano para probar. */
function revisarVencimientos() {
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(10000)) return;
  try {
    const inv = leerInventario();
    const cambios = [];
    const columna = inv.hoja.getRange(2, inv.cols.ULTIMO_ESTADO, Math.max(inv.ultimaFila - 1, 1), 1).getValues();

    inv.filas.forEach(function (f) {
      if (f.estadoRegistro !== 'ACTIVO') return;
      const ayer = f.ultimoEstado;
      if (ayer in GRAVEDAD && f.estado in GRAVEDAD && GRAVEDAD[f.estado] > GRAVEDAD[ayer]) {
        cambios.push({ producto: f.producto, lote: f.lote, ubicacion: f.ubicacion, estadoAyer: ayer, estadoHoy: f.estado, vence: f.vence, dias: f.dias });
      }
      columna[f.fila - 2][0] = f.estado;
    });

    inv.hoja.getRange(2, inv.cols.ULTIMO_ESTADO, columna.length, 1).setValues(columna);
    if (cambios.length) enviarCorreoAlerta(cambios, contarEstados(inv.filas.filter(function (f) { return f.estadoRegistro === 'ACTIVO'; })));
    Logger.log(cambios.length ? 'Correo enviado: ' + cambios.length + ' cambios.' : 'Sin cambios; no se envió correo.');
  } finally {
    candado.releaseLock();
  }
}

function enviarCorreoAlerta(cambios, conteo) {
  const destino = PropertiesService.getScriptProperties().getProperty('CORREOS_ALERTA');
  if (!destino) { Logger.log('Falta la propiedad CORREOS_ALERTA; no se envía correo.'); return; }

  const color = { VERDE: '#4BB69E', AMARILLO: '#D9A441', ROJO: '#B9736B', VENCIDO: '#6B6560' };
  const punto = function (e) {
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color[e] +
           ';margin-right:6px"></span>' + NOMBRE_ESTADO[e];
  };
  // lo más grave primero; dentro de cada estado, lo que vence antes
  cambios.sort(function (a, b) {
    if (GRAVEDAD[a.estadoHoy] !== GRAVEDAD[b.estadoHoy]) return GRAVEDAD[b.estadoHoy] - GRAVEDAD[a.estadoHoy];
    return a.vence < b.vence ? -1 : 1;
  });
  const filas = cambios.map(function (c) {
    return '<tr>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #F4F1EC">' + escaparHtml(c.producto) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #F4F1EC">' + escaparHtml(c.lote) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #F4F1EC;color:#858581">' + punto(c.estadoAyer) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #F4F1EC">' + punto(c.estadoHoy) + '</td>' +
      '<td style="padding:8px 10px;border-bottom:1px solid #F4F1EC">' + (c.vence ? fechaCorta(c.vence) : '') +
        ' <span style="color:#858581">· ' + textoRestante(c.dias) + '</span></td>' +
      '</tr>';
  }).join('');

  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { /* sin implementación publicada */ }

  const html =
    '<div style="font-family:Arial,sans-serif;color:#4A4A46;max-width:640px">' +
    '<h2 style="color:#4BB69E;font-weight:600;margin:0 0 4px">Oniderm · Logística</h2>' +
    '<p style="margin:0 0 18px;color:#858581">' + cambios.length + (cambios.length === 1 ? ' producto empeoró' : ' productos empeoraron') +
    ' su estado de vencimiento desde la última revisión.</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
    '<tr style="text-align:left;color:#858581;font-size:12px"><th style="padding:6px 10px">Producto</th><th style="padding:6px 10px">Lote</th>' +
    '<th style="padding:6px 10px">Antes</th><th style="padding:6px 10px">Ahora</th><th style="padding:6px 10px">Vence</th></tr>' +
    filas + '</table>' +
    '<p style="margin:20px 0;font-size:13px;color:#858581">Inventario activo: ' +
    conteo.vencidos + ' vencidos · ' + conteo.rojo + ' en rojo · ' + conteo.amarillo + ' en amarillo · ' +
    conteo.verde + ' en verde · ' + conteo.sinFecha + ' sin fecha.</p>' +
    (url ? '<a href="' + url + '?tab=log" style="display:inline-block;background:#4BB69E;color:#fff;padding:11px 18px;' +
           'border-radius:10px;text-decoration:none;font-weight:600">Abrir Logística</a>' : '') +
    '</div>';

  MailApp.sendEmail({
    to: destino,
    subject: 'Oniderm · ' + cambios.length + (cambios.length === 1 ? ' producto cambió' : ' productos cambiaron') + ' de estado de vencimiento',
    htmlBody: html
  });
}

/**
 * Córrela UNA vez a mano. Borra disparadores previos de revisarVencimientos (no se duplican)
 * y crea uno diario a las 7 a. m. hora de Bogotá, sin importar la zona del proyecto.
 */
function instalarRevisionDiaria() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'revisarVencimientos'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('revisarVencimientos')
    .timeBased().atHour(CONFIG_INV.horaRevision).everyDays(1).inTimezone(CONFIG_INV.zona).create();

  Logger.log('Revisión diaria instalada: todos los días a las ' + CONFIG_INV.horaRevision + ' a. m. (' + CONFIG_INV.zona + ').');
  if (Session.getScriptTimeZone() !== CONFIG_INV.zona) {
    Logger.log('Ojo: la zona horaria del proyecto es ' + Session.getScriptTimeZone() +
               '. Cámbiala a ' + CONFIG_INV.zona + ' en Configuración del proyecto.');
  }
}

function escaparHtml(texto) {
  return String(texto || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
