function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function incluir(archivo) {
  return HtmlService.createHtmlOutputFromFile(archivo).getContent();
}