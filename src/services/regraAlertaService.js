/* ==========================================================================
   services/regraAlertaService.js — regras de alerta do escritório

   Enquanto ninguém editar, valem as REGRAS_PADRAO de `domain/alertas.js`.
   Salvar uma regra materializa a coleção; a partir daí ela manda.

   A regra da DUPLA CONFERÊNCIA mora aqui e não em `alertas.js` porque não é
   um aviso: é uma trava de processo. Escritório com seguro de
   responsabilidade civil costuma ser obrigado a ter exatamente isso — o
   prazo baixado por um advogado precisa ser conferido por outro.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  var CHAVE_CONFERENCIA = 'exigirDuplaConferencia';

  /** Regras vigentes: as gravadas ou, na ausência delas, as padrão. */
  function vigentes() {
    var gravadas = db().get('regrasAlerta');
    if (gravadas.length) return gravadas;

    return App.domain.alertas.REGRAS_PADRAO.map(function (r) {
      return Object.assign({ id: 'padrao-' + r.gatilho, padrao: true }, r);
    });
  }

  function listar() {
    return http().requisicao(function () { return vigentes(); });
  }

  /**
   * Grava a regra de um gatilho. Na primeira gravação, MATERIALIZA todas as
   * padrão — senão o escritório ficaria com uma regra sua e cinco inexistentes,
   * e `alertas.regraDe()` não acharia as demais.
   */
  function salvar(gatilho, alteracoes) {
    return http().requisicao(function () {
      if (!db().get('regrasAlerta').length) {
        App.domain.alertas.REGRAS_PADRAO.forEach(function (r) {
          db().insert('regrasAlerta', {
            gatilho: r.gatilho,
            antecedenciaDias: r.antecedenciaDias.slice(),
            canais: r.canais.slice(),
            horaEnvio: App.domain.alertas.HORA_DIGEST,
            ativo: r.ativo !== false,
            usuarioId: null
          }, 'RGA');
        });
      }

      var alvo = db().get('regrasAlerta').filter(function (r) {
        return r.gatilho === gatilho;
      })[0];
      if (!alvo) throw http().ErroApi('Gatilho desconhecido: ' + gatilho, 400);

      return db().update('regrasAlerta', alvo.id, alteracoes);
    });
  }

  function restaurarPadrao() {
    return http().requisicao(function () {
      db().get('regrasAlerta').forEach(function (r) { db().remove('regrasAlerta', r.id); });
      return vigentes();
    });
  }

  // --- Configurações do escritório -------------------------------------------

  function config(chave, valorPadrao) {
    var achada = db().get('configuracoes').filter(function (c) {
      return c.chave === chave;
    })[0];
    return achada ? achada.valor : valorPadrao;
  }

  function definirConfig(chave, valor) {
    var achada = db().get('configuracoes').filter(function (c) {
      return c.chave === chave;
    })[0];

    if (achada) return db().update('configuracoes', achada.id, { valor: valor });
    return db().insert('configuracoes', { chave: chave, valor: valor }, 'CFG');
  }

  /** Padrão LIGADO: a trava protege o escritório, e desligá-la é a exceção. */
  function exigeDuplaConferencia() {
    return config(CHAVE_CONFERENCIA, true) !== false;
  }

  function definirDuplaConferencia(ativa) {
    return http().requisicao(function () {
      definirConfig(CHAVE_CONFERENCIA, !!ativa);
      return { exigeDuplaConferencia: !!ativa };
    });
  }

  App.services.regraAlertaService = {
    listar: listar,
    vigentes: vigentes,
    salvar: salvar,
    restaurarPadrao: restaurarPadrao,
    exigeDuplaConferencia: exigeDuplaConferencia,
    definirDuplaConferencia: definirDuplaConferencia,
    config: config,
    definirConfig: definirConfig
  };
})(window.App = window.App || {});
