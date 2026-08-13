/* ==========================================================================
   services/simulado/sincronizacaoService.js — consulta ao diário SIMULADA

   Regra 2 da fase 2: o que vira chamada de rede na fase 3 mora aqui, com a
   assinatura final já correta.

   NADA é consultado. Não há Datajud, PJe, e-SAJ nem Projudi do outro lado —
   e não haveria como haver: o protótipo não tem servidor, e essas APIs
   exigem credencial e, em alguns casos, certificado digital.

   O que é REAL nesta simulação, e por isso vale a pena existir:
     · o ciclo completo funciona de ponta a ponta — publicação entra na
       fila, é classificada, vira prazo e notifica o responsável;
     · a DEDUPLICAÇÃO por hash do conteúdo é de verdade, e é o problema
       prático nº 1 de quem integra recorte: o mesmo ato sai em dois
       cadernos, ou a consulta se sobrepõe e traz o que já veio ontem;
     · falha de rede acontece, porque na vida real acontece — e a tela
       precisa saber lidar com sincronização que volta com erro.

   MIGRAÇÃO: `sincronizar()` vira GET /api/publicacoes/sincronizar, que do
   lado do servidor consulta os tribunais. A fila, a triagem e a geração de
   prazo não mudam nada.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  /* Integrações previstas para a fase 3. A lista aparece na tela para que
     ninguém confunda o que existe com o que está planejado. */
  var INTEGRACOES_PREVISTAS = [
    { id: 'datajud', nome: 'Datajud / CNJ', descricao: 'Base nacional de dados do Judiciário',
      cobertura: 'Todos os tribunais', situacao: 'prevista' },
    { id: 'pje', nome: 'PJe', descricao: 'Processo Judicial eletrônico',
      cobertura: 'Justiça do Trabalho e Federal', situacao: 'prevista' },
    { id: 'esaj', nome: 'e-SAJ', descricao: 'Sistema do TJSP e outros tribunais estaduais',
      cobertura: 'TJSP, TJAM, TJMS…', situacao: 'prevista' },
    { id: 'projudi', nome: 'Projudi', descricao: 'Sistema de tribunais estaduais',
      cobertura: 'TJPR, TJBA…', situacao: 'prevista' },
    { id: 'dje', nome: 'Diários eletrônicos', descricao: 'Recorte por OAB e por nome',
      cobertura: 'Diários dos tribunais monitorados', situacao: 'prevista' }
  ];

  /* Modelos usados para fabricar publicação nova. Deliberadamente variados:
     uma sincronização que só traz contestação faria o classificador parecer
     melhor do que é. */
  var MODELOS = [
    'Manifeste-se a parte autora, no prazo de 5 (cinco) dias, sobre os documentos ' +
    'juntados pela parte contrária.',

    'Fica a parte requerida CITADA para apresentar contestação no prazo de 15 (quinze) ' +
    'dias úteis, sob pena de revelia.',

    'Intimadas as partes da r. sentença, fluindo o prazo de 15 (quinze) dias úteis para ' +
    'interposição de recurso de apelação.',

    'Designada audiência de instrução e julgamento. Intimem-se as partes e seus ' +
    'patronos. Trata-se de despacho de mero expediente, sem prazo a ser observado.',

    'Intimado o executado para cumprimento voluntário no prazo de 15 (quinze) dias, ' +
    'sob pena de multa de 10%, nos termos do art. 523 do CPC.',

    'Intimadas as partes do v. acórdão, com prazo de 5 (cinco) dias para embargos de ' +
    'declaração.'
  ];

  function agoraISO() { return new Date().toISOString(); }

  function sortear(lista, semente) {
    return lista[Math.abs(semente) % lista.length];
  }

  /**
   * "Consulta" os tribunais monitorados.
   *
   * @param {object} [opcoes] { forcarErro }
   * @returns {Promise<{id, encontradas, novas, duplicadas, status}>}
   */
  function sincronizar(opcoes) {
    var op = opcoes || {};

    var registro = db().insert('sincronizacoes', {
      iniciadaEm: agoraISO(),
      concluidaEm: null,
      tribunais: [],
      encontradas: 0,
      novas: 0,
      duplicadas: 0,
      status: 'executando',
      mensagemErro: null
    }, 'SIN');

    return http().requisicao(function () {
      var monitoramentos = db().get('monitoramentos');

      if (!monitoramentos.length) {
        db().update('sincronizacoes', registro.id, {
          concluidaEm: agoraISO(),
          status: 'erro',
          mensagemErro: 'Nenhum monitoramento cadastrado.'
        });
        throw http().ErroApi(
          'Cadastre ao menos um monitoramento antes de sincronizar.', 409);
      }

      // Falha de rede: acontece de verdade, e a tela precisa saber lidar.
      if (op.forcarErro) {
        db().update('sincronizacoes', registro.id, {
          concluidaEm: agoraISO(),
          status: 'erro',
          mensagemErro: 'O serviço do tribunal não respondeu (tempo esgotado).'
        });
        throw http().ErroApi('O serviço do tribunal não respondeu.', 504);
      }

      var tribunais = {};
      monitoramentos.forEach(function (m) {
        (m.tribunais || []).forEach(function (t) { tribunais[t] = true; });
      });
      var listaTribunais = Object.keys(tribunais);

      /* As publicações fabricadas pertencem a processos REAIS do escritório:
         sem isso o vínculo automático por CNJ nunca casaria, e o passo mais
         importante do módulo ficaria sem exercício. */
      var candidatos = db().get('processos').filter(function (p) {
        return p.status === 'ativo';
      });
      if (!candidatos.length) {
        db().update('sincronizacoes', registro.id, {
          concluidaEm: agoraISO(), status: 'concluida'
        });
        return { id: registro.id, encontradas: 0, novas: 0, duplicadas: 0, status: 'concluida' };
      }

      var existentes = {};
      db().get('publicacoes').forEach(function (p) { existentes[p.hashConteudo] = true; });

      var quantidade = 2 + (Date.now() % 4);      // entre 2 e 5
      var encontradas = 0;
      var novas = 0;
      var duplicadas = 0;
      var hoje = App.domain.prazos.hojeISO();

      for (var i = 0; i < quantidade; i++) {
        var semente = Date.now() + i * 7919;
        var processo = sortear(candidatos, semente);
        var corpo = sortear(MODELOS, semente >> 3);
        var advogado = db().find('usuarios', processo.responsavelId);
        var tribunal = App.domain.enums.achar(App.domain.enums.TRIBUNAIS, processo.tribunalId);

        var texto =
          processo.vara + ' da Comarca de ' + processo.comarca + '\n' +
          'Processo n. ' + processo.numeroCnj + ' — ' + processo.classeProcessual + '\n' +
          (advogado ? 'Advogado: ' + advogado.nome + ' - OAB/' +
            (advogado.oab ? advogado.oab.uf + ' ' + advogado.oab.numero : 'SP 000000') + '\n' : '') +
          '\n' + corpo;

        encontradas++;
        var hash = App.token.hashLongo(texto);

        // Deduplicação: o mesmo ato sai em dois cadernos, e a consulta de
        // hoje se sobrepõe à de ontem. É o problema prático nº 1 do recorte.
        if (existentes[hash]) {
          duplicadas++;
          continue;
        }
        existentes[hash] = true;

        db().insert('publicacoes', {
          tribunalId: processo.tribunalId,
          diario: tribunal ? 'DJe ' + tribunal.label : 'DJe',
          caderno: 'Caderno Eletrônico',
          pagina: 100 + (semente % 3000),
          dataDisponibilizacao: hoje,
          textoIntegral: texto,
          numeroCnjDetectado: processo.numeroCnj,
          processoId: null,
          monitoramentoId: monitoramentos[i % monitoramentos.length].id,
          status: 'nova',
          prazoGeradoId: null,
          andamentoGeradoId: null,
          triadaPorId: null,
          triadaEm: null,
          hashConteudo: hash
        }, 'PUB');
        novas++;
      }

      monitoramentos.forEach(function (m) {
        db().update('monitoramentos', m.id, { ultimaSincronizacaoEm: agoraISO() });
      });

      var resultado = db().update('sincronizacoes', registro.id, {
        concluidaEm: agoraISO(),
        tribunais: listaTribunais,
        encontradas: encontradas,
        novas: novas,
        duplicadas: duplicadas,
        status: 'concluida'
      });

      if (novas && App.services.notificacaoService) {
        App.services.notificacaoService.sincronizar();
      }

      return resultado;
    });
  }

  function historico(limite) {
    return http().requisicao(function () {
      return db().get('sincronizacoes')
        .sort(function (a, b) { return a.iniciadaEm < b.iniciadaEm ? 1 : -1; })
        .slice(0, limite || 20);
    });
  }

  function ultima() {
    return db().get('sincronizacoes')
      .sort(function (a, b) { return a.iniciadaEm < b.iniciadaEm ? 1 : -1; })[0] || null;
  }

  App.services.sincronizacaoService = {
    sincronizar: sincronizar,
    historico: historico,
    ultima: ultima,
    INTEGRACOES_PREVISTAS: INTEGRACOES_PREVISTAS
  };
})(window.App = window.App || {});
