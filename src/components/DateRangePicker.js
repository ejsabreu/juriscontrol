/* ==========================================================================
   components/DateRangePicker.js — seleção de período

   Todo relatório de F2.9 e todo extrato de F2.5 começam por "de quando até
   quando". Predefinições primeiro (é o que se escolhe em 95% das vezes) e
   as datas soltas atrás de um "Personalizado".

   Convenção do projeto: datas trafegam como ISO 'YYYY-MM-DD'.
   ========================================================================== */

(function (App) {
  'use strict';

  App.components = App.components || {};

  var esc = null;
  function e(v) {
    if (!esc) esc = App.dom.esc;
    return esc(v);
  }

  function iso(d) { return App.format.toISO(d); }

  function somarDias(base, dias) {
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + dias);
    return d;
  }

  /**
   * Predefinições. `calcular` devolve { de, ate } em ISO — funções puras de
   * uma data de referência, então o teste não depende do relógio.
   */
  var PREDEFINICOES = [
    { id: 'hoje', label: 'Hoje', calcular: function (h) {
      return { de: iso(h), ate: iso(h) };
    } },
    { id: '7d', label: 'Últimos 7 dias', calcular: function (h) {
      return { de: iso(somarDias(h, -6)), ate: iso(h) };
    } },
    { id: '30d', label: 'Últimos 30 dias', calcular: function (h) {
      return { de: iso(somarDias(h, -29)), ate: iso(h) };
    } },
    { id: 'mes', label: 'Mês atual', calcular: function (h) {
      return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate: iso(h) };
    } },
    { id: 'mes_anterior', label: 'Mês anterior', calcular: function (h) {
      return {
        de: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)),
        ate: iso(new Date(h.getFullYear(), h.getMonth(), 0))
      };
    } },
    { id: 'trimestre', label: 'Últimos 3 meses', calcular: function (h) {
      return { de: iso(new Date(h.getFullYear(), h.getMonth() - 2, 1)), ate: iso(h) };
    } },
    { id: 'ano', label: 'Ano atual', calcular: function (h) {
      return { de: iso(new Date(h.getFullYear(), 0, 1)), ate: iso(h) };
    } },
    { id: '12m', label: 'Últimos 12 meses', calcular: function (h) {
      return { de: iso(new Date(h.getFullYear() - 1, h.getMonth(), 1)), ate: iso(h) };
    } }
  ];

  /** Resolve uma predefinição pelo id. Data de referência injetável. */
  function resolver(idPredefinicao, referencia) {
    var hoje = referencia ? App.format.parseISO(referencia) : new Date();
    for (var i = 0; i < PREDEFINICOES.length; i++) {
      if (PREDEFINICOES[i].id === idPredefinicao) return PREDEFINICOES[i].calcular(hoje);
    }
    return null;
  }

  /** Rótulo humano do período selecionado — vai para o cabeçalho do relatório. */
  function descrever(periodo) {
    var p = periodo || {};
    if (p.predefinicao) {
      for (var i = 0; i < PREDEFINICOES.length; i++) {
        if (PREDEFINICOES[i].id === p.predefinicao) return PREDEFINICOES[i].label;
      }
    }
    if (p.de && p.ate) return App.format.data(p.de) + ' a ' + App.format.data(p.ate);
    if (p.de) return 'a partir de ' + App.format.data(p.de);
    if (p.ate) return 'até ' + App.format.data(p.ate);
    return 'Período completo';
  }

  /**
   * @param {object} p
   * @param {object} p.valor  { predefinicao, de, ate }
   * @param {string} p.acao   nome do data-action emitido (padrão 'periodo')
   */
  function DateRangePicker(props) {
    var p = props || {};
    var valor = p.valor || { predefinicao: '30d' };
    var personalizado = !valor.predefinicao;

    var botoes = '<div class="daterange__presets" role="group" aria-label="Período">';
    PREDEFINICOES.forEach(function (pre) {
      var ativo = valor.predefinicao === pre.id;
      botoes += '<button type="button" class="daterange__preset' +
                  (ativo ? ' daterange__preset--active' : '') + '"' +
                  ' data-action="' + e(p.acao || 'periodo') + '" data-value="' + e(pre.id) + '"' +
                  ' aria-pressed="' + ativo + '">' + e(pre.label) + '</button>';
    });
    botoes += '<button type="button" class="daterange__preset' +
                (personalizado ? ' daterange__preset--active' : '') + '"' +
                ' data-action="' + e(p.acao || 'periodo') + '" data-value="personalizado"' +
                ' aria-pressed="' + personalizado + '">Personalizado</button>' +
              '</div>';

    var campos = '';
    if (personalizado) {
      campos = '<div class="daterange__custom">' +
        '<label class="daterange__field"><span>De</span>' +
          '<input class="input input--sm" type="date" name="periodoDe" value="' +
            e(valor.de || '') + '"></label>' +
        '<label class="daterange__field"><span>Até</span>' +
          '<input class="input input--sm" type="date" name="periodoAte" value="' +
            e(valor.ate || '') + '"></label>' +
        '</div>';
    }

    return '<div class="daterange' + (p.classe ? ' ' + p.classe : '') + '">' +
             botoes + campos +
             '<span class="daterange__summary">' + e(descrever(valor)) + '</span>' +
           '</div>';
  }

  /**
   * @param {Function} onChange  recebe { predefinicao, de, ate }
   */
  DateRangePicker.mount = function (root, props) {
    if (!root) return function () {};
    var p = props || {};
    var acao = p.acao || 'periodo';
    var onChange = p.onChange || function () {};

    var offPreset = App.dom.delegate(root, 'click', '[data-action="' + acao + '"]',
      function (evento, alvo) {
        var id = alvo.getAttribute('data-value');
        if (id === 'personalizado') {
          onChange({ predefinicao: null, de: p.valor && p.valor.de, ate: p.valor && p.valor.ate });
          return;
        }
        var faixa = resolver(id, p.referencia);
        onChange({ predefinicao: id, de: faixa.de, ate: faixa.ate });
      });

    var offCampo = App.dom.delegate(root, 'change', 'input[type="date"]', function () {
      var de = App.dom.qs('input[name="periodoDe"]', root);
      var ate = App.dom.qs('input[name="periodoAte"]', root);
      onChange({
        predefinicao: null,
        de: de ? de.value : null,
        ate: ate ? ate.value : null
      });
    });

    return function desmontar() { offPreset(); offCampo(); };
  };

  DateRangePicker.PREDEFINICOES = PREDEFINICOES;
  DateRangePicker.resolver = resolver;
  DateRangePicker.descrever = descrever;

  App.components.DateRangePicker = DateRangePicker;
})(window.App = window.App || {});
