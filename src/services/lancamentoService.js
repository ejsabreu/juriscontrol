/* ==========================================================================
   services/lancamentoService.js — contas a receber e a pagar

   O coração do módulo. Todo dinheiro que entra ou sai do escritório passa
   por aqui: honorário, êxito, custa, despesa reembolsável, repasse.

   Regra que atravessa o arquivo: o STATUS gravado envelhece. Um título
   "em aberto" cujo vencimento passou está atrasado, e quem decide isso é
   `domain/financeiro.situacao()` na leitura — não um job que precisaria
   rodar todo dia à meia-noite para o sistema não mentir.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function fin()  { return App.domain.financeiro; }

  function enriquecer(l, ctx) {
    var contexto = ctx || {
      pessoas: db().get('pessoas'),
      processos: db().get('processos')
    };
    var hoje = App.domain.prazos.hojeISO();

    var cliente = l.clienteId
      ? contexto.pessoas.filter(function (p) { return p.id === l.clienteId; })[0] || null
      : null;
    var processo = l.processoId
      ? contexto.processos.filter(function (p) { return p.id === l.processoId; })[0] || null
      : null;

    var situacao = fin().situacao(l, hoje);
    var mora = fin().jurosMulta(Object.assign({}, l, { status: situacao }), hoje);

    return Object.assign({}, l, {
      cliente: cliente,
      clienteNome: cliente ? cliente.nome : '—',
      processo: processo,
      processoNumero: processo ? processo.numeroCnj : null,
      situacao: situacao,
      atrasado: situacao === 'atrasado',
      diasAtraso: mora.diasAtraso,
      moraCentavos: mora.multaCentavos + mora.jurosCentavos,
      totalComMoraCentavos: mora.totalCentavos,
      rotuloOrigem: App.domain.enums.rotulo(App.domain.enums.ORIGENS_LANCAMENTO, l.origem)
    });
  }

  /**
   * @param {object} f  tipo, origem, status, clienteId, processoId,
   *                    contratoId, de, ate, busca, apenasAtrasados,
   *                    pagina, porPagina
   */
  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = { pessoas: db().get('pessoas'), processos: db().get('processos') };

      var lista = db().get('lancamentos')
        .map(function (l) { return enriquecer(l, contexto); })
        .filter(function (l) {
          if (filtros.tipo && l.tipo !== filtros.tipo) return false;
          if (filtros.origem && l.origem !== filtros.origem) return false;
          if (filtros.status && l.situacao !== filtros.status) return false;
          if (filtros.clienteId && l.clienteId !== filtros.clienteId) return false;
          if (filtros.processoId && l.processoId !== filtros.processoId) return false;
          if (filtros.contratoId && l.contratoId !== filtros.contratoId) return false;
          if (filtros.apenasAtrasados && !l.atrasado) return false;
          if (filtros.de && l.dataVencimento < filtros.de) return false;
          if (filtros.ate && l.dataVencimento > filtros.ate) return false;

          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = (l.descricao + ' ' + l.clienteNome + ' ' +
                        (l.processoNumero || '')).toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) {
          return a.dataVencimento < b.dataVencimento ? -1 :
                 a.dataVencimento > b.dataVencimento ? 1 : 0;
        });

      var total = lista.length;
      var pagina = filtros.pagina || 1;
      var porPagina = filtros.porPagina || total || 1;
      var inicio = (pagina - 1) * porPagina;

      return {
        itens: filtros.porPagina ? lista.slice(inicio, inicio + porPagina) : lista,
        total: total,
        somaCentavos: lista.reduce(function (s, l) {
          return s + Math.round(l.valorCentavos || 0);
        }, 0),
        pagina: pagina,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina))
      };
    });
  }

  function criar(dados) {
    return http().requisicao(function () {
      var valor = Math.round(dados.valorCentavos || 0);
      if (valor <= 0) throw http().ErroApi('Informe um valor maior que zero.', 400);

      var origem = App.domain.enums.achar(App.domain.enums.ORIGENS_LANCAMENTO, dados.origem);
      if (!origem) throw http().ErroApi('Origem do lançamento inválida.', 400);

      var hoje = App.domain.prazos.hojeISO();

      return enriquecer(db().insert('lancamentos', {
        // O tipo vem do enum, não do formulário: custa é despesa por
        // natureza, e deixar a tela decidir permitiria lançar custa como
        // receita e inverter o sinal do caixa.
        tipo: origem.tipo,
        origem: dados.origem,
        contratoId: dados.contratoId || null,
        processoId: dados.processoId || null,
        clienteId: dados.clienteId || null,
        descricao: dados.descricao || origem.label,
        valorCentavos: valor,
        valorPagoCentavos: 0,
        dataCompetencia: dados.dataCompetencia || fin().competenciaDe(hoje),
        dataVencimento: dados.dataVencimento || hoje,
        dataPagamento: null,
        status: 'em_aberto',
        formaPagamento: dados.formaPagamento || null,
        reembolsavel: !!dados.reembolsavel,
        comprovanteDocumentoId: null,
        boletoId: null,
        parcela: null
      }, 'LAN'));
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('lancamentos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Lançamento não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  /**
   * Baixa do título.
   *
   * Aceita pagamento PARCIAL: na vida real o cliente paga metade e combina o
   * resto, e um sistema que só admite "pago" ou "em aberto" força o usuário
   * a mentir num dos dois lados.
   */
  function baixar(id, dados) {
    return http().requisicao(function () {
      var l = db().find('lancamentos', id);
      if (!l) throw http().ErroApi('Lançamento não encontrado.', 404);
      if (l.status === 'pago') throw http().ErroApi('Este título já está baixado.', 409);
      if (l.status === 'cancelado') throw http().ErroApi('Título cancelado não recebe baixa.', 409);

      var d = dados || {};
      var pago = Math.round(d.valorPagoCentavos !== undefined
        ? d.valorPagoCentavos
        : l.valorCentavos);
      if (pago <= 0) throw http().ErroApi('Informe o valor pago.', 400);

      var acumulado = Math.round(l.valorPagoCentavos || 0) + pago;
      var quitou = acumulado >= Math.round(l.valorCentavos || 0);
      var hoje = App.domain.prazos.hojeISO();

      var atualizado = db().update('lancamentos', id, {
        valorPagoCentavos: acumulado,
        dataPagamento: quitou ? (d.dataPagamento || hoje) : null,
        status: quitou ? 'pago' : 'parcial',
        formaPagamento: d.formaPagamento || l.formaPagamento
      });

      if (quitou && l.boletoId) {
        db().update('boletos', l.boletoId, {
          status: 'pago', pagoEm: new Date().toISOString()
        });
      }

      return enriquecer(atualizado);
    });
  }

  function estornar(id) {
    return http().requisicao(function () {
      var l = db().find('lancamentos', id);
      if (!l) throw http().ErroApi('Lançamento não encontrado.', 404);

      var atualizado = db().update('lancamentos', id, {
        valorPagoCentavos: 0, dataPagamento: null, status: 'em_aberto'
      });
      if (l.boletoId) db().update('boletos', l.boletoId, { status: 'emitido', pagoEm: null });

      return enriquecer(atualizado);
    });
  }

  function cancelar(id, motivo) {
    return atualizar(id, { status: 'cancelado', motivoCancelamento: motivo || null });
  }

  function remover(id) {
    return http().requisicao(function () {
      var l = db().find('lancamentos', id);
      if (!l) throw http().ErroApi('Lançamento não encontrado.', 404);
      if (l.status === 'pago') {
        throw http().ErroApi('Título pago não é excluído — estorne antes.', 409);
      }
      db().remove('lancamentos', id);
      return { id: id };
    });
  }

  // --- Indicadores --------------------------------------------------------------

  /** Painel do financeiro em uma passada só. */
  function resumo(periodo) {
    return http().requisicao(function () {
      var p = periodo || {};
      var hoje = App.domain.prazos.hojeISO();
      var todos = db().get('lancamentos');

      var receber = 0, pagar = 0, recebido = 0, pago = 0, atrasado = 0, atrasados = 0;

      todos.forEach(function (l) {
        if (l.status === 'cancelado') return;
        var situacao = fin().situacao(l, hoje);
        var valor = Math.round(l.valorCentavos || 0);
        var quitado = Math.round(l.valorPagoCentavos || 0);

        if (l.tipo === 'receita') {
          if (situacao === 'pago') recebido += quitado;
          else {
            receber += valor - quitado;
            if (situacao === 'atrasado') { atrasado += valor - quitado; atrasados++; }
          }
        } else {
          if (situacao === 'pago') pago += quitado;
          else pagar += valor - quitado;
        }
      });

      var de = p.de || fin().somarMeses(hoje, -11);
      var ate = p.ate || hoje;

      return {
        aReceberCentavos: receber,
        aPagarCentavos: pagar,
        recebidoCentavos: recebido,
        pagoCentavos: pago,
        atrasadoCentavos: atrasado,
        titulosAtrasados: atrasados,
        saldoPrevistoCentavos: receber - pagar,
        aging: fin().aging(todos, hoje),
        fluxo: fin().fluxoCaixa(todos, de, ate, p.regime || 'caixa'),
        inadimplenciaPct: (recebido + atrasado) > 0
          ? Math.round((atrasado / (recebido + atrasado)) * 1000) / 10
          : 0
      };
    });
  }

  /** Rentabilidade de um processo — receita menos despesas e horas. */
  function rentabilidadeDoProcesso(processoId) {
    return http().requisicao(function () {
      var lancamentos = db().where('lancamentos', function (l) {
        return l.processoId === processoId;
      });
      var apontamentos = db().where('apontamentos', function (a) {
        return a.processoId === processoId;
      });
      var contrato = db().where('contratos', function (c) {
        return c.processoId === processoId;
      })[0] || null;

      return Object.assign(
        App.domain.financeiro.rentabilidade({
          lancamentos: lancamentos,
          apontamentos: apontamentos,
          // Sem valor-hora contratado, usa-se uma referência do escritório:
          // custo de hora zero faria todo processo parecer lucrativo.
          valorHoraCentavos: (contrato && contrato.valorHoraCentavos) || 25000
        }),
        { contrato: contrato, totalLancamentos: lancamentos.length }
      );
    });
  }

  App.services.lancamentoService = {
    listar: listar,
    criar: criar,
    atualizar: atualizar,
    baixar: baixar,
    estornar: estornar,
    cancelar: cancelar,
    remover: remover,
    resumo: resumo,
    rentabilidadeDoProcesso: rentabilidadeDoProcesso,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
