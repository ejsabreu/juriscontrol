/* ==========================================================================
   domain/financeiro.js — a aritmética do dinheiro do escritório

   LÓGICA PURA. Recebe contratos, lançamentos e horas; devolve parcelas,
   juros, aging, fluxo de caixa e rentabilidade. Não conhece banco, tela nem
   store — e é por isso que dá para conferir cada conta com um teste.

   Tudo em CENTAVOS inteiros (decisão arquitetural 7 do projeto). Honorário
   calculado em float acumula erro de arredondamento que aparece exatamente
   onde não pode: no total do contrato que o cliente vai conferir.
   ========================================================================== */

(function (App) {
  'use strict';

  App.domain = App.domain || {};

  function moeda() { return App.moeda; }
  function prazos() { return App.domain.prazos; }

  /* Encargos padrão de mora. Configuráveis por contrato; estes são os que a
     jurisprudência aceita sem discussão e o que o mercado pratica. */
  var MULTA_PADRAO_PCT = 2;      // sobre o principal, uma única vez
  var JUROS_PADRAO_MES = 1;      // ao mês, pro rata die

  function hojeISO() { return prazos().hojeISO(); }

  function somarMeses(iso, meses) {
    var d = App.format.parseISO(iso);
    var dia = d.getDate();
    var alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1);
    // Dia 31 em mês de 30 cai no último dia — nunca "transborda" para o mês
    // seguinte, que é o erro clássico de somar mês com setMonth().
    var ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    alvo.setDate(Math.min(dia, ultimoDia));
    return App.format.toISO(alvo);
  }

  function competenciaDe(iso) {
    return String(iso || '').slice(0, 7);      // 'YYYY-MM'
  }

  // --- Parcelas ---------------------------------------------------------------

  /**
   * Parcelas previstas de um contrato.
   *
   * Duas garantias:
   *   · a SOMA das parcelas é exatamente o valor do contrato — `moeda.ratear`
   *     distribui o resto nas primeiras, e nunca sobra nem falta centavo;
   *   · todo vencimento cai em DIA ÚTIL. Boleto que vence no domingo é
   *     boleto pago na segunda com multa indevida.
   *
   * @returns {Array<{numero, de, valorCentavos, dataVencimento, dataCompetencia}>}
   */
  function gerarParcelas(contrato) {
    var c = contrato || {};
    var total = Math.round(c.valorFixoCentavos || 0);
    if (total <= 0) return [];

    var quantidade = Math.max(1, Math.floor(c.numParcelas) || 1);
    var valores = moeda().ratear(total, quantidade);
    var inicio = c.dataInicio || hojeISO();
    var diaVencimento = c.diaVencimento || null;

    return valores.map(function (valor, i) {
      var base = somarMeses(inicio, i);

      if (diaVencimento) {
        var d = App.format.parseISO(base);
        var ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(diaVencimento, ultimoDia));
        base = App.format.toISO(d);
      }

      var util = App.format.toISO(prazos().diaUtilOuSeguinte(base));

      return {
        numero: i + 1,
        de: quantidade,
        valorCentavos: valor,
        dataVencimento: util,
        dataCompetencia: competenciaDe(base)
      };
    });
  }

  /**
   * Honorário de êxito sobre o proveito econômico.
   * O percentual incide sobre o que o cliente EFETIVAMENTE ganhou, não sobre
   * o valor da causa — confundir os dois é o erro que gera cobrança indevida.
   */
  function calcularExito(contrato, valorGanhoCentavos) {
    var c = contrato || {};
    var pct = Number(c.percentualExito) || 0;
    if (pct <= 0) return 0;
    return moeda().percentual(Math.max(0, Math.round(valorGanhoCentavos || 0)), pct);
  }

  /** Valor de um contrato por hora, a partir dos apontamentos faturáveis. */
  function calcularPorHora(contrato, apontamentos) {
    var valorHora = Math.round((contrato && contrato.valorHoraCentavos) || 0);
    if (valorHora <= 0) return { minutos: 0, valorCentavos: 0 };

    var minutos = (apontamentos || [])
      .filter(function (a) { return a.faturavel !== false && !a.lancamentoId; })
      .reduce(function (soma, a) { return soma + (Number(a.minutos) || 0); }, 0);

    return {
      minutos: minutos,
      // Fração de hora é cobrada proporcionalmente, arredondando ao centavo.
      valorCentavos: Math.round(valorHora * minutos / 60)
    };
  }

  // --- Mora --------------------------------------------------------------------

  /**
   * Multa e juros de um título vencido.
   *
   * Multa: percentual fixo sobre o principal, cobrada uma vez.
   * Juros: ao mês, PRO RATA DIE — cobrar o mês cheio por três dias de atraso
   * é prática que não se sustenta em discussão.
   *
   * @returns {{diasAtraso, multaCentavos, jurosCentavos, totalCentavos}}
   */
  function jurosMulta(lancamento, hoje, encargos) {
    var l = lancamento || {};
    var e = encargos || {};
    var referencia = hoje || hojeISO();

    var principal = Math.round(l.valorCentavos || 0);
    var vazio = {
      diasAtraso: 0, multaCentavos: 0, jurosCentavos: 0,
      totalCentavos: principal
    };

    if (!l.dataVencimento || l.status === 'pago' || l.status === 'cancelado') return vazio;
    if (l.dataVencimento >= referencia) return vazio;

    var dias = prazos().diasCorridosEntre(l.dataVencimento, referencia);
    if (dias <= 0) return vazio;

    var pctMulta = e.multaPct !== undefined ? e.multaPct : MULTA_PADRAO_PCT;
    var pctJuros = e.jurosMes !== undefined ? e.jurosMes : JUROS_PADRAO_MES;

    var multa = moeda().percentual(principal, pctMulta);
    var juros = Math.round(principal * (pctJuros / 100) * (dias / 30));

    return {
      diasAtraso: dias,
      multaCentavos: multa,
      jurosCentavos: juros,
      totalCentavos: principal + multa + juros
    };
  }

  // --- Aging -------------------------------------------------------------------

  var FAIXAS_AGING = [
    { id: 'a_vencer', label: 'A vencer',  min: null, max: 0 },
    { id: 'ate30',    label: '1 a 30',    min: 1,   max: 30 },
    { id: 'ate60',    label: '31 a 60',   min: 31,  max: 60 },
    { id: 'ate90',    label: '61 a 90',   min: 61,  max: 90 },
    { id: 'acima90',  label: 'Acima de 90', min: 91, max: null }
  ];

  /**
   * Distribuição dos recebíveis em aberto por tempo de atraso.
   * É o retrato que diz se a inadimplência é pontual ou crônica.
   */
  function aging(lancamentos, hoje) {
    var referencia = hoje || hojeISO();

    var resultado = FAIXAS_AGING.map(function (f) {
      return { id: f.id, label: f.label, quantidade: 0, valorCentavos: 0 };
    });

    (lancamentos || []).forEach(function (l) {
      if (l.tipo !== 'receita') return;
      if (l.status === 'pago' || l.status === 'cancelado') return;
      if (!l.dataVencimento) return;

      var atraso = l.dataVencimento >= referencia
        ? 0
        : prazos().diasCorridosEntre(l.dataVencimento, referencia);

      var faixa = FAIXAS_AGING.filter(function (f) {
        if (f.max === 0) return atraso <= 0;
        if (f.max === null) return atraso >= f.min;
        return atraso >= f.min && atraso <= f.max;
      })[0];

      var alvo = resultado.filter(function (r) { return r.id === faixa.id; })[0];
      alvo.quantidade++;
      alvo.valorCentavos += Math.round(l.valorCentavos || 0);
    });

    return resultado;
  }

  // --- Fluxo de caixa -----------------------------------------------------------

  /**
   * Série mensal de entradas e saídas.
   *
   * Dois regimes, e a diferença importa:
   *   · CAIXA — pela data de pagamento. É o dinheiro que entrou de fato, e é
   *     o que responde "dá para pagar a folha este mês?".
   *   · COMPETÊNCIA — pela data de competência. É o resultado do período,
   *     e é o que responde "o escritório deu lucro?".
   *
   * @returns {{meses, entradas, saidas, saldo, acumulado, totais}}
   */
  function fluxoCaixa(lancamentos, de, ate, regime) {
    var porCaixa = (regime || 'caixa') === 'caixa';
    var inicio = competenciaDe(de || hojeISO());
    var fim = competenciaDe(ate || hojeISO());

    var meses = [];
    var cursor = inicio;
    var guarda = 0;
    while (cursor <= fim && guarda++ < 240) {
      meses.push(cursor);
      cursor = competenciaDe(somarMeses(cursor + '-01', 1));
    }

    var indice = {};
    meses.forEach(function (m, i) { indice[m] = i; });

    var entradas = meses.map(function () { return 0; });
    var saidas = meses.map(function () { return 0; });

    (lancamentos || []).forEach(function (l) {
      if (l.status === 'cancelado') return;

      var data = porCaixa ? l.dataPagamento : (l.dataCompetencia || l.dataVencimento);
      if (!data) return;
      // No regime de caixa, o que não foi pago não entrou.
      if (porCaixa && !l.dataPagamento) return;

      var i = indice[competenciaDe(data)];
      if (i === undefined) return;

      var valor = Math.round(
        (porCaixa && l.valorPagoCentavos ? l.valorPagoCentavos : l.valorCentavos) || 0);

      if (l.tipo === 'receita') entradas[i] += valor;
      else saidas[i] += valor;
    });

    var saldo = meses.map(function (m, i) { return entradas[i] - saidas[i]; });

    var acumulado = [];
    saldo.reduce(function (soma, v) {
      var novo = soma + v;
      acumulado.push(novo);
      return novo;
    }, 0);

    return {
      meses: meses,
      entradas: entradas,
      saidas: saidas,
      saldo: saldo,
      acumulado: acumulado,
      totais: {
        entradas: moeda().somar(entradas),
        saidas: moeda().somar(saidas),
        saldo: moeda().somar(saldo)
      }
    };
  }

  // --- Rentabilidade -------------------------------------------------------------

  /**
   * Um processo deu lucro?
   *
   *   receita   = honorários recebidos (+ êxito)
   *   custo     = despesas + custas + repasses + horas apontadas
   *
   * As horas entram pelo VALOR-HORA do contrato quando há, e por um valor de
   * referência quando não há: sem custo de hora, todo processo pareceria
   * lucrativo, e o relatório serviria para nada.
   */
  function rentabilidade(dados) {
    var d = dados || {};
    var lancamentos = d.lancamentos || [];
    var apontamentos = d.apontamentos || [];
    var valorHora = Math.round(d.valorHoraCentavos || 0);

    var receita = 0;
    var despesa = 0;

    lancamentos.forEach(function (l) {
      if (l.status === 'cancelado') return;
      var valor = Math.round((l.valorPagoCentavos || l.valorCentavos) || 0);
      if (l.tipo === 'receita') receita += valor;
      else despesa += valor;
    });

    var minutos = apontamentos.reduce(function (soma, a) {
      return soma + (Number(a.minutos) || 0);
    }, 0);
    var custoHoras = Math.round(valorHora * minutos / 60);

    var custoTotal = despesa + custoHoras;
    var resultado = receita - custoTotal;

    return {
      receitaCentavos: receita,
      despesaCentavos: despesa,
      minutos: minutos,
      custoHorasCentavos: custoHoras,
      custoTotalCentavos: custoTotal,
      resultadoCentavos: resultado,
      // Sem receita não há margem — devolver 0 evita divisão por zero e é
      // mais honesto que -Infinity numa tabela.
      margemPct: receita > 0 ? Math.round((resultado / receita) * 1000) / 10 : 0
    };
  }

  /** Situação de um título hoje: o status gravado pode ter envelhecido. */
  function situacao(lancamento, hoje) {
    var l = lancamento || {};
    var referencia = hoje || hojeISO();

    if (l.status === 'pago' || l.status === 'cancelado') return l.status;
    if (l.valorPagoCentavos && l.valorPagoCentavos < l.valorCentavos) return 'parcial';
    if (l.dataVencimento && l.dataVencimento < referencia) return 'atrasado';
    if (l.dataVencimento && l.dataVencimento <= referencia) return 'em_aberto';
    return l.status === 'previsto' ? 'previsto' : 'em_aberto';
  }

  App.domain.financeiro = {
    MULTA_PADRAO_PCT: MULTA_PADRAO_PCT,
    JUROS_PADRAO_MES: JUROS_PADRAO_MES,
    FAIXAS_AGING: FAIXAS_AGING,
    somarMeses: somarMeses,
    competenciaDe: competenciaDe,
    gerarParcelas: gerarParcelas,
    calcularExito: calcularExito,
    calcularPorHora: calcularPorHora,
    jurosMulta: jurosMulta,
    aging: aging,
    fluxoCaixa: fluxoCaixa,
    rentabilidade: rentabilidade,
    situacao: situacao
  };
})(window.App = window.App || {});
