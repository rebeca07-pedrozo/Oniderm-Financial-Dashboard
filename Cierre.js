/**
 * Oniderm · Gestión financiera y logística
 * Copyright (c) 2026 Rebeca Pedrozo. Todos los derechos reservados.
 * Software propietario y confidencial. Prohibido copiar, modificar, distribuir
 * o usar este archivo, total o parcialmente, sin autorización escrita de la autora.
 * Ver el archivo LICENSE.
 */

/**
 * Cierre.gs
 * Cierre de caja: lo que entró en un día, por forma de pago.
 * Solo lee la hoja de ingresos del semestre de ese día; no escribe nada en la hoja.
 */

/**
 * Lo que llama el botón "Cierre de caja".
 * fechaTexto: 'yyyy-MM-dd'. Si no llega, toma el día de hoy.
 */
function getCierreDelDia(fechaTexto) {
  const zona = Session.getScriptTimeZone();
  const fecha = fechaTexto ? aFecha(fechaTexto) : new Date();
  if (!fecha) throw new Error('La fecha del cierre no es válida.');
  const dia = Utilities.formatDate(fecha, zona, 'yyyy-MM-dd');
  if (dia > Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd')) {
    throw new Error('No se puede hacer el cierre de un día que todavía no llega.');
  }

  const hoja = getHojaPorFecha(fecha, CONFIG.ingresos);
  const cols = getColumnas(hoja, COLS_INGRESO);
  const datos = hoja.getDataRange().getValues();

  const atenciones = [];
  for (let i = cols.filaEncabezado; i < datos.length; i++) {
    const r = filaAIngreso(datos[i], cols, hoja.getName(), i + 1, zona);
    if (!r || r.fecha !== dia || !(r.valor > 0)) continue;
    // mismo criterio del tablero: si TOTAL no es creíble, neto = valor - comisión
    const neto = r.total > 0 && r.total <= r.valor ? r.total : r.valor - r.comision;
    atenciones.push({
      paciente: r.paciente,
      cedula: r.cedula,
      codigo: r.codigo,
      procedimiento: r.procedimiento,
      profesional: r.profesional,
      formaPago: r.formaPago || 'Sin forma de pago',
      valor: r.valor,
      comision: r.valor - neto,
      neto: neto,
      pendienteFactura: esPendienteFactura(r)
    });
  }

  const formas = agruparPorFormaDePago(atenciones);
  const total = { atenciones: 0, valor: 0, comision: 0, neto: 0 };
  formas.forEach(function (f) {
    total.atenciones += f.atenciones;
    total.valor += f.valor;
    total.comision += f.comision;
    total.neto += f.neto;
  });

  return {
    fecha: dia,
    esHoy: dia === Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd'),
    hoja: hoja.getName().trim(),
    formas: formas,
    total: total,
    atenciones: atenciones,
    pendientesFactura: atenciones.filter(function (a) { return a.pendienteFactura; }).length,
    calculado: Utilities.formatDate(new Date(), zona, "h:mm a")
  };
}

/**
 * Una tarjeta por forma de pago, en el orden de la lista de la hoja.
 * Las formas sin movimientos salen en $0 para que el cierre muestre que no entró nada por ahí.
 * Una forma que no está en la lista (dato viejo o escrito a mano) se agrega al final.
 */
function agruparPorFormaDePago(atenciones) {
  const formas = [];
  const porClave = {};
  const agregar = function (nombre) {
    const clave = sinTildes(nombre);
    if (!porClave[clave]) {
      porClave[clave] = {
        nombre: nombre,
        atenciones: 0, valor: 0, comision: 0, neto: 0,
        efectivo: clave.indexOf('EFECTIVO') >= 0,
        conComision: CONFIG.pagosConComision.some(function (p) { return sinTildes(p) === clave; })
      };
      formas.push(porClave[clave]);
    }
    return porClave[clave];
  };

  let lista = [];
  try { lista = getCatalogo().formasPago || []; } catch (e) { /* sin catálogo: solo las que tengan movimientos */ }
  lista.forEach(agregar);

  atenciones.forEach(function (a) {
    const f = agregar(a.formaPago);
    f.atenciones += 1;
    f.valor += a.valor;
    f.comision += a.comision;
    f.neto += a.neto;
  });
  return formas;
}
