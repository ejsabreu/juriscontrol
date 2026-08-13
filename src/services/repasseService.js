/* ==========================================================================
   services/repasseService.js — repasses a correspondentes, parceiros e sócios

   Parte do honorário recebido pertence a quem não é o escritório: o
   correspondente que fez a audiência em outra comarca, o parceiro que
   indicou o caso, o sócio que tem participação no resultado.

   O repasse nasce SEMPRE de uma receita já existente e vira despesa
   vinculada a ela. Lançar repasse solto quebraria a conta: o dinheiro sairia
   sem que se soubesse de qual entrada.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(r) {
    var origem = r.lancamentoOrigemId ? db().find('lancamentos', r.lancamentoOrigemId) : null;
    var beneficiario = r.beneficiarioId
      ? (db().find('pessoas', r.beneficiarioId) || db().find('usuarios', r.beneficiarioId))
      : null;

    return Object.assign({}, r, {
      lancamentoOrigem: origem,
      origemDescricao: origem ? origem.descricao : '—',
      beneficiario: beneficiario,
      beneficiarioNome: beneficiario ? beneficiario.nome : '—'
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      return db().get('repasses')
        .map(enriquecer)
        .filter(function (r) {
          if (filtros.status && r.status !== filtros.status) return false;
          if (filtros.beneficiarioId && r.beneficiarioId !== filtros.beneficiarioId) return false;
          if (filtros.lancamentoOrigemId &&
              r.lancamentoOrigemId !== filtros.lancamentoOrigemId) return false;
          return true;
        })
        .sort(function (a, b) { return a.dataPrevista < b.dataPrevista ? -1 : 1; });
    });
  }

  /**
   * @param {object} dados  { lancamentoOrigemId, beneficiarioId, tipo,
   *                          percentual | valorCentavos, dataPrevista }
   */
  function criar(dados) {
    return http().requisicao(function () {
      var origem = db().find('lancamentos', dados.lancamentoOrigemId);
      if (!origem) throw http().ErroApi('Lançamento de origem não encontrado.', 404);
      if (origem.tipo !== 'receita') {
        throw http().ErroApi('Repasse sai de uma receita, não de uma despesa.', 409);
      }

      var valor = dados.valorCentavos !== undefined
        ? Math.round(dados.valorCentavos)
        : App.moeda.percentual(origem.valorCentavos, Number(dados.percentual) || 0);

      if (valor <= 0) throw http().ErroApi('Informe o percentual ou o valor do repasse.', 400);

      // O que sai não pode passar do que entrou.
      var jaRepassado = db().where('repasses', function (r) {
        return r.lancamentoOrigemId === origem.id && r.status !== 'cancelado';
      }).reduce(function (s, r) { return s + Math.round(r.valorCentavos || 0); }, 0);

      if (jaRepassado + valor > Math.round(origem.valorCentavos || 0)) {
        throw http().ErroApi(
          'A soma dos repasses ultrapassaria o valor da receita de origem ' +
          '(' + App.format.moeda(origem.valorCentavos) + ').', 409);
      }

      var repasse = db().insert('repasses', {
        lancamentoOrigemId: origem.id,
        beneficiarioId: dados.beneficiarioId || null,
        tipo: dados.tipo || 'correspondente',
        percentual: Number(dados.percentual) || 0,
        valorCentavos: valor,
        dataPrevista: dados.dataPrevista || origem.dataVencimento,
        dataPagamento: null,
        status: 'previsto'
      }, 'REP');

      // O repasse também é despesa: sem o lançamento, o fluxo de caixa
      // mostraria a entrada inteira como se fosse do escritório.
      var lancamento = db().insert('lancamentos', {
        tipo: 'despesa',
        origem: 'repasse',
        contratoId: origem.contratoId || null,
        processoId: origem.processoId || null,
        clienteId: null,
        descricao: 'Repasse — ' + (origem.descricao || ''),
        valorCentavos: valor,
        valorPagoCentavos: 0,
        dataCompetencia: origem.dataCompetencia,
        dataVencimento: repasse.dataPrevista,
        dataPagamento: null,
        status: 'previsto',
        reembolsavel: false,
        boletoId: null,
        repasseId: repasse.id,
        parcela: null
      }, 'LAN');

      db().update('repasses', repasse.id, { lancamentoId: lancamento.id });
      return enriquecer(db().find('repasses', repasse.id));
    });
  }

  function pagar(id) {
    return http().requisicao(function () {
      var r = db().find('repasses', id);
      if (!r) throw http().ErroApi('Repasse não encontrado.', 404);
      if (r.status === 'pago') throw http().ErroApi('Repasse já pago.', 409);

      var hoje = App.domain.prazos.hojeISO();
      var atualizado = db().update('repasses', id, { status: 'pago', dataPagamento: hoje });

      if (r.lancamentoId) {
        db().update('lancamentos', r.lancamentoId, {
          status: 'pago', dataPagamento: hoje, valorPagoCentavos: r.valorCentavos
        });
      }
      return enriquecer(atualizado);
    });
  }

  function cancelar(id) {
    return http().requisicao(function () {
      var r = db().find('repasses', id);
      if (!r) throw http().ErroApi('Repasse não encontrado.', 404);
      if (r.status === 'pago') throw http().ErroApi('Repasse pago não é cancelado.', 409);

      var atualizado = db().update('repasses', id, { status: 'cancelado' });
      if (r.lancamentoId) db().update('lancamentos', r.lancamentoId, { status: 'cancelado' });
      return enriquecer(atualizado);
    });
  }

  App.services.repasseService = {
    listar: listar,
    criar: criar,
    pagar: pagar,
    cancelar: cancelar,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
