/* ==========================================================================
   services/http.js — simulação da camada de rede

   O protótipo não tem backend, mas TODA leitura passa por aqui e devolve
   Promise com latência. Isso força as telas a lidarem com loading e erro
   desde já — na migração, só o corpo dos services muda para fetch e
   nenhuma tela precisa ser reescrita.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  var config = {
    latenciaMin: 120,
    latenciaMax: 320,
    taxaErro: 0,        // suba para 0.1 e as telas exercitam o estado de erro
    ativarLatencia: true
  };

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function latenciaAleatoria() {
    if (!config.ativarLatencia) return 0;
    return config.latenciaMin + Math.random() * (config.latenciaMax - config.latenciaMin);
  }

  function ErroApi(mensagem, codigo) {
    var erro = new Error(mensagem);
    erro.name = 'ErroApi';
    erro.codigo = codigo || 500;
    return erro;
  }

  /**
   * Envolve uma operação síncrona sobre o "banco" em uma resposta assíncrona.
   * @param {Function} operacao  executada após a latência simulada
   */
  function requisicao(operacao) {
    return delay(latenciaAleatoria()).then(function () {
      if (config.taxaErro > 0 && Math.random() < config.taxaErro) {
        throw ErroApi('Falha de comunicação com o servidor. Tente novamente.', 503);
      }
      return operacao();
    });
  }

  /**
   * Requisição com PROGRESSO — usada pelo envio de documentos.
   *
   * O protótipo não transmite bytes: percorre uma escada de percentuais com
   * latência entre os passos, para a tela exercitar a barra de progresso e o
   * bloqueio do botão desde já.
   *
   * Na migração isto vira XMLHttpRequest com upload.onprogress (ou fetch com
   * ReadableStream) e a assinatura continua a mesma — nenhuma tela muda.
   *
   * @param {Function} operacao     executada ao final, quando chega a 100%
   * @param {Function} [aoProgresso] recebe o percentual (0–100)
   */
  function upload(operacao, aoProgresso) {
    var passos = [8, 26, 47, 68, 85, 96, 100];
    var corrente = Promise.resolve();

    passos.forEach(function (percentual) {
      corrente = corrente.then(function () {
        return delay(config.ativarLatencia ? 40 + Math.random() * 70 : 0).then(function () {
          if (aoProgresso) aoProgresso(percentual);
        });
      });
    });

    return corrente.then(function () { return requisicao(operacao); });
  }

  App.services.http = {
    config: config,
    delay: delay,
    requisicao: requisicao,
    upload: upload,
    ErroApi: ErroApi
  };
})(window.App = window.App || {});
