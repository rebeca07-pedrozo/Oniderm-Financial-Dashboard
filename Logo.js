/**
 * Logo.gs
 * El logo vive en Drive. En Configuración del proyecto → Propiedades del script se guarda
 * SOLO su ID en LOGO_ID (no la cadena base64: las propiedades admiten máximo 9 KB por valor).
 * La página convierte la imagen a base64 sola y la guarda 6 horas en caché.
 */

/** Lo que usa la página (Index.html). Orden: LOGO_ID en Drive → LOGO viejo en propiedades → CONFIG.logo. */
function getLogo() {
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

/** Para revisar qué está usando la página. */
function revisarLogo() {
  const b64 = getLogo();
  Logger.log(b64 ? 'Logo encontrado: ' + Math.round(b64.length / 1024) + ' KB · ' + b64.substring(0, 40) + '…' : 'No hay logo configurado.');
}
