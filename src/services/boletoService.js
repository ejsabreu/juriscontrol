/* ==========================================================================
   services/boletoService.js — emissão de boleto

   REAL: a linha digitável. O código de barras de 44 posições, os três DVs de
   campo por módulo 10 e o DV geral por módulo 11 saem de `domain/boleto.js`
   e passam em qualquer validador.

   SIMULADO: o registro. Nenhum banco recebe este título — registrar exige
   convênio bancário e troca por CNAB ou API, ou seja, servidor. O banco 999
   não existe, e a tela diz isso.

   MIGRAÇÃO: `emitir()` vira POST /api/boletos, que registra no banco e
   devolve a MESMA estrutura. A linha digitável não muda de forma.
   ========================================================================== */

(function (App) {
  'use strict';

  App.services = App.services || {};

  function db()   { return App.services.db; }
  function http() { return App.services.http; }

  function enriquecer(b) {
    var lancamento = b.lancamentoId ? db().find('lancamentos', b.lancamentoId) : null;
    var hoje = App.domain.prazos.hojeISO();

    return Object.assign({}, b, {
      lancamento: lancamento,
      linhaFormatada: App.domain.boleto.formatarLinha(b.linhaDigitavel),
      vencido: b.status === 'emitido' && b.dataVencimento < hoje
    });
  }

  /**
   * Emite o boleto de um lançamento a receber.
   *
   * O título vencido é emitido com o valor ATUALIZADO (principal + multa +
   * juros), porque é isso que o cliente precisa pagar — emitir pelo valor
   * original obrigaria a uma segunda cobrança da diferença.
   */
  function emitir(lancamentoId, opcoes) {
    return http().requisicao(function () {
      var l = db().find('lancamentos', lancamentoId);
      if (!l) throw http().ErroApi('Lançamento não encontrado.', 404);
      if (l.tipo !== 'receita') {
        throw http().ErroApi('Só título a receber gera boleto.', 409);
      }
      if (l.status === 'pago') throw http().ErroApi('Este título já está pago.', 409);
      if (l.boletoId) {
        var existente = db().find('boletos', l.boletoId);
        if (existente && existente.status === 'emitido') {
          throw http().ErroApi('Este título já tem boleto emitido.', 409);
        }
      }

      var op = opcoes || {};
      var hoje = App.domain.prazos.hojeISO();
      var mora = App.domain.financeiro.jurosMulta(l, hoje);

      var vencimento = op.dataVencimento || (l.dataVencimento < hoje
        ? App.format.toISO(App.domain.prazos.somarDiasUteis(hoje, 4))
        : l.dataVencimento);

      var valor = op.valorCentavos !== undefined
        ? Math.round(op.valorCentavos)
        : mora.totalCentavos;

      var sequencial = db().getTodos('boletos').length + 1;
      var titulo = App.domain.boleto.emitir({
        sequencial: sequencial,
        valorCentavos: valor,
        dataVencimento: vencimento
      });

      var boleto = db().insert('boletos', {
        lancamentoId: l.id,
        banco: titulo.banco,
        nossoNumero: titulo.nossoNumero,
        linhaDigitavel: titulo.linhaDigitavel,
        codigoBarras: titulo.codigoBarras,
        dataVencimento: vencimento,
        valorCentavos: valor,
        principalCentavos: Math.round(l.valorCentavos || 0),
        multaCentavos: mora.multaCentavos,
        jurosCentavos: mora.jurosCentavos,
        status: 'emitido',
        emitidoEm: new Date().toISOString(),
        pagoEm: null
      }, 'BOL');

      db().update('lancamentos', l.id, { boletoId: boleto.id });

      App.services.auditoriaService.registrar({
        acao: 'criar',
        colecao: 'boletos',
        entidadeId: boleto.id,
        resumo: 'Boleto emitido — ' + App.format.moeda(valor)
      });

      return enriquecer(boleto);
    });
  }

  function obter(id) {
    return http().requisicao(function () {
      var b = db().find('boletos', id);
      if (!b) throw http().ErroApi('Boleto não encontrado.', 404);
      return enriquecer(b);
    });
  }

  function listar(f) {
    return http().requisicao(function () {
      var filtros = f || {};
      return db().get('boletos')
        .map(enriquecer)
        .filter(function (b) {
          if (filtros.status && b.status !== filtros.status) return false;
          if (filtros.lancamentoId && b.lancamentoId !== filtros.lancamentoId) return false;
          return true;
        })
        .sort(function (a, b) { return a.emitidoEm < b.emitidoEm ? 1 : -1; });
    });
  }

  function cancelar(id) {
    return http().requisicao(function () {
      var b = db().find('boletos', id);
      if (!b) throw http().ErroApi('Boleto não encontrado.', 404);
      if (b.status === 'pago') throw http().ErroApi('Boleto pago não é cancelado.', 409);

      var atualizado = db().update('boletos', id, { status: 'cancelado' });
      if (b.lancamentoId) db().update('lancamentos', b.lancamentoId, { boletoId: null });
      return enriquecer(atualizado);
    });
  }

  /**
   * HTML do boleto para impressão.
   *
   * O PDF sai pelo diálogo de impressão do navegador — mesma decisão da fase
   * 1 para os documentos: quem sabe fazer PDF é o navegador, e gerar um
   * arquivo à mão daria um PDF pior e uma dependência a mais.
   */
  function montarImpressao(boleto) {
    var b = boleto;
    var lancamento = b.lancamento || {};
    var cliente = lancamento.clienteId ? db().find('pessoas', lancamento.clienteId) : null;
    var esc = App.dom.esc;

    function linha(rotulo, valor) {
      return '<div class="bol-print__campo"><span>' + esc(rotulo) + '</span><strong>' +
             esc(valor) + '</strong></div>';
    }

    return '' +
      '<div class="bol-print">' +
        '<div class="bol-print__topo">' +
          '<span class="bol-print__banco">' + esc(b.banco) + '-9</span>' +
          '<span class="bol-print__linha">' + esc(b.linhaFormatada) + '</span>' +
        '</div>' +
        '<div class="bol-print__corpo">' +
          linha('Cedente', 'JurisControl Sociedade de Advogados') +
          linha('Sacado', cliente ? cliente.nome : '—') +
          linha('Nosso número', b.nossoNumero) +
          linha('Vencimento', App.format.data(b.dataVencimento)) +
          linha('Valor do documento', App.format.moeda(b.principalCentavos)) +
          (b.multaCentavos ? linha('Multa', App.format.moeda(b.multaCentavos)) : '') +
          (b.jurosCentavos ? linha('Juros de mora', App.format.moeda(b.jurosCentavos)) : '') +
          linha('Valor cobrado', App.format.moeda(b.valorCentavos)) +
          linha('Descrição', lancamento.descricao || '—') +
        '</div>' +
        '<div class="bol-print__codigo">' + esc(b.codigoBarras) + '</div>' +
        '<p class="bol-print__aviso">' +
          'DOCUMENTO SEM VALOR — protótipo de demonstração. A linha digitável é ' +
          'matematicamente válida no padrão FEBRABAN, mas o título não está registrado ' +
          'em banco nenhum e o código 999 não corresponde a instituição real.' +
        '</p>' +
      '</div>';
  }

  App.services.boletoService = {
    emitir: emitir,
    obter: obter,
    listar: listar,
    cancelar: cancelar,
    montarImpressao: montarImpressao,
    enriquecer: enriquecer
  };
})(window.App = window.App || {});
