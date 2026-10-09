/**
 * Logo.gs
 * El logo vive en Drive. En Configuración del proyecto → Propiedades del script se guarda
 * SOLO su ID en LOGO_ID (no la cadena base64: las propiedades admiten máximo 9 KB por valor).
 * La página convierte la imagen a base64 sola y la guarda 6 horas en caché.
 */

/**
 * Lo que usa la página (Index.html). Orden: LOGO_ID en Drive → LOGO viejo en propiedades → CONFIG.logo.
 * Se llama logoPagina (no getLogo) para no chocar con versiones viejas de getLogo que hayan quedado en Config.
 */
function logoPagina() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOGO_ID');
  if (id) {
    const cache = CacheService.getScriptCache();
    const guardado = cache.get('logo|' + id);
    if (guardado) return guardado;
    try {
      const logo = imagenABase64(id);
      if (logo.length < 100000) cache.put('logo|' + id, logo, 21600); // la caché admite hasta 100 KB
      return logo;
    } catch (e) {
      console.warn('No pude leer el logo ' + id + ': ' + e.message);
    }
  }
  return props.getProperty('LOGO') || CONFIG.logo || '';
}

/** Imagen de Drive como data URI (data:image/png;base64,...). */
function imagenABase64(idDrive) {
  const blob = DriveApp.getFileById(idDrive).getBlob();
  if (!/^image\//.test(blob.getContentType())) throw new Error('El archivo ' + idDrive + ' no es una imagen (' + blob.getContentType() + ').');
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/**
 * Convierte una imagen de Drive a base64 y la deja en un Google Docs nuevo.
 * Para correrla: cambia el ID en ejecutarLogoADocs() y ejecuta esa función.
 */
function logoADocs(idDrive) {
  const base64 = imagenABase64(idDrive);
  const archivo = DriveApp.getFileById(idDrive);
  const doc = DocumentApp.create('Logo en base64 · ' + archivo.getName());
  doc.getBody().setText(base64);
  doc.saveAndClose();
  Logger.log('Listo (' + Math.round(base64.length / 1024) + ' KB de texto). Documento: ' + doc.getUrl());
  return doc.getUrl();
}

function ejecutarLogoADocs() {
  logoADocs('PEGA_AQUI_EL_ID_DE_LA_IMAGEN');
}

/** Córrela desde el editor si el logo no aparece: dice paso a paso qué encuentra. */
function revisarLogo() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOGO_ID');
  Logger.log('1) LOGO_ID: ' + (id || '(vacío)'));
  if (id) {
    try {
      const archivo = DriveApp.getFileById(id);
      Logger.log('2) Archivo en Drive: "' + archivo.getName() + '" · ' + archivo.getMimeType() + ' · ' + Math.round(archivo.getSize() / 1024) + ' KB');
      const b64 = imagenABase64(id);
      Logger.log('3) Convertido a base64: ' + Math.round(b64.length / 1024) + ' KB. Empieza con ' + b64.substring(0, 30) + '…');
    } catch (e) {
      Logger.log('2) ERROR leyendo el archivo: ' + e.message);
    }
  }
  const viejo = props.getProperty('LOGO');
  if (viejo) {
    Logger.log('Ojo: existe la propiedad LOGO (' + viejo.length + ' caracteres). Ya no se necesita: bórrala. ' +
               (viejo.length >= 8000 ? 'Además parece cortada (las propiedades guardan máximo 9 KB).' : ''));
  }
  if (typeof getLogo === 'function') {
    Logger.log('Ojo: hay una función getLogo vieja en otro archivo (seguramente Config). Ya no se usa: bórrala.');
  }
  limpiarCacheLogo();
  Logger.log(logoPagina() ? 'Listo: la página tiene logo. Recarga el enlace.' : 'La página no tiene logo.');
}

/** Si cambias la imagen en Drive y quieres verla ya (sin esperar las 6 horas de caché). */
function limpiarCacheLogo() {
  const id = PropertiesService.getScriptProperties().getProperty('LOGO_ID');
  if (id) CacheService.getScriptCache().remove('logo|' + id);
}
