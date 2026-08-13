/* ==========================================================================
   services/contratoService.js — contratos de honorários

   Salvar um contrato GERA as parcelas previstas. É o ponto do módulo: sem
   isso, o financeiro seria um caderno de anotações — o contrato existe
   justamente para dizer o que vai entrar e quando.

   MIGRAÇÃO: criar(dados) → POST /api/contratos, e o servidor faz a mesma
   geração de parcelas com a mesma função pura de `domain/financeiro.js`.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }
  function fin()  { return App.domain.financeiro; }

  function enriquecer(contrato, ctx) {
    var contexto = ctx || {
      pessoas: db().get('pessoas'),
      processos: db().get('processos'),
      lancamentos: db().get('lancamentos')
    };

    var cliente = contexto.pessoas.filter(function (p) {
      return p.id === contrato.clienteId;
    })[0] || null;

    var processo = contrato.processoId
      ? contexto.processos.filter(function (p) { return p.id === contrato.processoId; })[0] || null
      : null;

    var doContrato = contexto.lancamentos.filter(function (l) {
      return l.contratoId === contrato.id && l.status !== 'cancelado';
    });

    var previsto = 0;
    var recebido = 0;
    var emAberto = 0;
    var hoje = App.domain.prazos.hojeISO();
    var atrasado = 0;

    doContrato.forEach(function (l) {
      if (l.tipo !== 'receita') return;
      previsto += Math.round(l.valorCentavos || 0);
      if (l.status === 'pago') {
        recebido += Math.round(l.valorPagoCentavos || l.valorCentavos || 0);
      } else {
        emAberto += Math.round(l.valorCentavos || 0);
        if (l.dataVencimento && l.dataVencimento < hoje) {
          atrasado += Math.round(l.valorCentavos || 0);
        }
      }
    });

    return Object.assign({}, contrato, {
      cliente: cliente,
      clienteNome: cliente ? cliente.nome : '—',
      processo: processo,
      processoNumero: processo ? processo.numeroCnj : null,
      rotuloModalidade: App.domain.enums.rotulo(
        App.domain.enums.MODALIDADES_HONORARIO, contrato.modalidade),
      totalParcelas: doContrato.length,
      previstoCentavos: previsto,
      recebidoCentavos: recebido,
      emAbertoCentavos: emAberto,
      atrasadoCentavos: atrasado,
      percentualRecebido: previsto > 0 ? Math.round((recebido / previsto) * 100) : 0
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      var contexto = {
        pessoas: db().get('pessoas'),
        processos: db().get('processos'),
        lancamentos: db().get('lancamentos')
      };

      return db().get('contratos')
        .map(function (c) { return enriquecer(c, contexto); })
        .filter(function (c) {
          if (filtros.clienteId && c.clienteId !== filtros.clienteId) return false;
          if (filtros.processoId && c.processoId !== filtros.processoId) return false;
          if (filtros.modalidade && c.modalidade !== filtros.modalidade) return false;
          if (filtros.status && c.status !== filtros.status) return false;
          if (filtros.busca) {
            var termo = String(filtros.busca).toLowerCase();
            var alvo = (c.clienteNome + ' ' + (c.processoNumero || '') + ' ' +
                        (c.descricao || '')).toLowerCase();
            if (alvo.indexOf(termo) === -1) return false;
          }
          return true;
        })
        .sort(function (a, b) { return a.dataInicio < b.dataInicio ? 1 : -1; });
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var contrato = db().find('contratos', id);
      if (!contrato) throw http().ErroApi('Contrato não encontrado.', 404);

      var parcelas = db().where('lancamentos', function (l) {
        return l.contratoId === id;
      }).sort(function (a, b) { return a.dataVencimento < b.dataVencimento ? -1 : 1; });

      return Object.assign(enriquecer(contrato), { parcelas: parcelas });
    });
  }

  /**
   * Cria o contrato e, na mesma operação, as parcelas previstas.
   *
   * Só a parte FIXA vira parcela: êxito depende do desfecho e por hora
   * depende do timesheet — lançar previsão de algo que ainda não aconteceu
   * poluiria o fluxo de caixa com dinheiro que talvez nunca entre.
   */
  function criar(dados) {
    return http().requisicao(function () {
      if (!dados.clienteId) throw http().ErroApi('Informe o cliente.', 400);

      var modalidade = App.domain.enums.achar(
        App.domain.enums.MODALIDADES_HONORARIO, dados.modalidade);
      if (!modalidade) throw http().ErroApi('Modalidade de honorário inválida.', 400);

      var contrato = db().insert('contratos', {
        clienteId: dados.clienteId,
        processoId: dados.processoId || null,
        modalidade: dados.modalidade,
        descricao: dados.descricao || '',
        valorFixoCentavos: Math.round(dados.valorFixoCentavos || 0),
        percentualExito: Number(dados.percentualExito) || 0,
        valorHoraCentavos: Math.round(dados.valorHoraCentavos || 0),
        valorMensalCentavos: Math.round(dados.valorMensalCentavos || 0),
        numParcelas: Math.max(1, Math.floor(dados.numParcelas) || 1),
        diaVencimento: dados.diaVencimento || null,
        dataInicio: dados.dataInicio || App.domain.prazos.hojeISO(),
        dataFim: dados.dataFim || null,
        status: 'ativo'
      }, 'CTR');

      var parcelas = fin().gerarParcelas(contrato);
      parcelas.forEach(function (p) {
        db().insert('lancamentos', {
          tipo: 'receita',
          origem: 'honorario',
          contratoId: contrato.id,
          processoId: contrato.processoId,
          clienteId: contrato.clienteId,
          descricao: 'Honorários ' + p.numero + '/' + p.de,
          valorCentavos: p.valorCentavos,
          valorPagoCentavos: 0,
          dataCompetencia: p.dataCompetencia,
          dataVencimento: p.dataVencimento,
          dataPagamento: null,
          status: 'previsto',
          formaPagamento: null,
          reembolsavel: false,
          boletoId: null,
          parcela: { n: p.numero, de: p.de }
        }, 'LAN');
      });

      return Object.assign(enriquecer(db().find('contratos', contrato.id)), {
        parcelasGeradas: parcelas.length
      });
    });
  }

  function atualizar(id, alteracoes) {
    return http().requisicao(function () {
      var atualizado = db().update('contratos', id, alteracoes);
      if (!atualizado) throw http().ErroApi('Contrato não encontrado.', 404);
      return enriquecer(atualizado);
    });
  }

  function encerrar(id) {
    return atualizar(id, { status: 'encerrado', dataFim: App.domain.prazos.hojeISO() });
  }

  function remover(id) {
    return http().requisicao(function () {
      var contrato = db().find('contratos', id);
      if (!contrato) throw http().ErroApi('Contrato não encontrado.', 404);

      // Parcela já paga é fato consumado: cancelar o contrato não desfaz
      // dinheiro que entrou, e apagá-la sumiria com receita do caixa.
      var pagas = db().where('lancamentos', function (l) {
        return l.contratoId === id && l.status === 'pago';
      });
      if (pagas.length) {
        throw http().ErroApi(
          'Este contrato tem ' + pagas.length + ' parcela(s) paga(s). Encerre em vez de excluir.',
          409);
      }

      db().where('lancamentos', function (l) { return l.contratoId === id; })
        .forEach(function (l) { db().remove('lancamentos', l.id); });
      db().remove('contratos', id);

      return { id: id };
    });
  }

  /**
   * Lança o honorário de êxito quando o processo termina bem.
   * Entra como lançamento avulso: não é parcela prevista, é resultado.
   */
  function lancarExito(id, valorGanhoCentavos, dataVencimento) {
    return http().requisicao(function () {
      var contrato = db().find('contratos', id);
      if (!contrato) throw http().ErroApi('Contrato não encontrado.', 404);
      if (!contrato.percentualExito) {
        throw http().ErroApi('Este contrato não prevê honorário de êxito.', 409);
      }

      var valor = fin().calcularExito(contrato, valorGanhoCentavos);
      if (valor <= 0) throw http().ErroApi('O proveito econômico informado é zero.', 400);

      var hoje = App.domain.prazos.hojeISO();
      var vencimento = dataVencimento ||
        App.format.toISO(App.domain.prazos.somarDiasUteis(hoje, 11));   // ~10 dias úteis

      return db().insert('lancamentos', {
        tipo: 'receita',
        origem: 'exito',
        contratoId: contrato.id,
        processoId: contrato.processoId,
        clienteId: contrato.clienteId,
        descricao: 'Honorário de êxito (' + contrato.percentualExito + '% sobre ' +
                   App.format.moeda(valorGanhoCentavos) + ')',
        valorCentavos: valor,
        valorPagoCentavos: 0,
        dataCompetencia: fin().competenciaDe(hoje),
        dataVencimento: vencimento,
        dataPagamento: null,
        status: 'em_aberto',
        reembolsavel: false,
        boletoId: null,
        parcela: null
      }, 'LAN');
    });
  }

  App.services.contratoService = {
    listar: listar,
    obter: obter,
    criar: criar,
    atualizar: atualizar,
    encerrar: encerrar,
    remover: remover,
    lancarExito: lancarExito,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
