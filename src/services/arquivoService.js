/* ==========================================================================
   services/arquivoService.js — o "storage" do protótipo

   O banco (localStorage) guarda apenas METADADOS do documento. O binário
   escolhido no envio fica aqui, em memória, e VIVE SÓ ENQUANTO A ABA ESTÁ
   ABERTA: recarregar a página perde o arquivo, mas o registro permanece.
   É a mentira mínima necessária para o envio parecer real sem backend.

   Por que não guardar no localStorage: um PDF de 3 MB em base64 passa de
   4 MB e estoura a cota de ~5 MB do navegador no primeiro documento.

   Na migração este módulo DESAPARECE — o upload vai para o storage do
   backend (S3, disco) e o documento passa a ter uma URL de verdade.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  var porDocumento = {};   // documentoId → { arquivo, url }

  /** Sem createObjectURL não há como abrir o arquivo — some o botão "Abrir". */
  function suportado() {
    return typeof window.URL !== 'undefined' &&
           typeof window.URL.createObjectURL === 'function';
  }

  function guardar(documentoId, arquivo) {
    if (!documentoId || !arquivo) return false;
    porDocumento[documentoId] = { arquivo: arquivo, url: null };
    return true;
  }

  /** true = o binário deste documento está nesta sessão. */
  function tem(documentoId) {
    return !!porDocumento[documentoId];
  }

  /** O File original — o visor usa para ler texto sem passar por URL. */
  function arquivo(documentoId) {
    var registro = porDocumento[documentoId];
    return registro ? registro.arquivo : null;
  }

  /** URL temporária criada por demanda e reaproveitada. */
  function url(documentoId) {
    var registro = porDocumento[documentoId];
    if (!registro || !suportado()) return null;

    if (!registro.url) {
      try {
        registro.url = window.URL.createObjectURL(registro.arquivo);
      } catch (e) {
        console.warn('[arquivoService] Não foi possível criar a URL do arquivo:', e.message);
        return null;
      }
    }
    return registro.url;
  }

  function esquecer(documentoId) {
    var registro = porDocumento[documentoId];
    if (!registro) return;

    if (registro.url && suportado()) {
      try { window.URL.revokeObjectURL(registro.url); } catch (e) { /* ignora */ }
    }
    delete porDocumento[documentoId];
  }

  function limpar() {
    Object.keys(porDocumento).forEach(esquecer);
  }

  function total() {
    return Object.keys(porDocumento).length;
  }

  App.services.arquivoService = {
    guardar: guardar,
    tem: tem,
    arquivo: arquivo,
    url: url,
    esquecer: esquecer,
    limpar: limpar,
    total: total,
    suportado: suportado
  };
})(window.App = window.App || {});
