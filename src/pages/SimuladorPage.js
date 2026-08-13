/* ==========================================================================
   pages/SimuladorPage.js — simulador de contagem de prazo

   Existe para tornar o motor AUDITÁVEL: mostra não só a data fatal, mas a
   memória de cálculo passo a passo e a lista de dias pulados com o motivo.
   Advogado não confia em caixa-preta quando o erro custa o direito do cliente.

   renderResultado() é reaproveitado pela prévia ao vivo do modal de prazo.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var container = null;

  function esc(v) { return App.dom.esc(v); }

  /** Bloco de resultado — compartilhado entre esta página e o modal de prazo. */
  function renderResultado(calculo) {
    if (!calculo) {
      return '<p class="u-sm u-muted">Preencha os campos para ver o cálculo.</p>';
    }

    var fmt = App.format;
    var ui = App.components.ui;

    function bloco(rotulo, valor, destaque) {
      return '<div>' +
               '<div class="cnj-preview__item-label">' + esc(rotulo) + '</div>' +
               '<div class="' + (destaque ? 'processo-hero__stat-value' : 'u-sm u-bold') + '">' +
                 esc(valor) +
               '</div>' +
             '</div>';
    }

    var html = '<div class="simulador-result">' +
      bloco('Publicação', fmt.data(calculo.dataPublicacao)) +
      bloco('Início da contagem', fmt.data(calculo.dataInicioContagem)) +
      bloco('Data fatal', fmt.data(calculo.dataFatal), true) +
      bloco('Prazo interno', fmt.data(calculo.dataInterna)) +
      '<div>' +
        '<div class="cnj-preview__item-label">Situação</div>' +
        ui.PrazoChip({ semaforo: calculo.semaforo, diasRestantes: calculo.diasRestantes }) +
      '</div>' +
    '</div>';

    html += '<div style="margin-top:var(--space-4)">' +
              '<div class="fieldset__legend">Memória de cálculo</div>';

    calculo.memoria.forEach(function (passo, indice) {
      html += '<div class="simulador-step">' +
                '<span class="simulador-step__marker">' + (indice + 1) + '</span>' +
                '<div>' +
                  '<strong>' + esc(passo.passo) + '</strong>' +
                  (passo.data ? ' — <span class="u-mono">' + esc(fmt.data(passo.data)) + '</span>' : '') +
                  '<div class="u-xs u-muted">' + esc(passo.texto) + '</div>' +
                '</div>' +
              '</div>';
    });

    html += '</div>';

    if (calculo.diasPulados && calculo.diasPulados.length) {
      html += '<details style="margin-top:var(--space-3)">' +
                '<summary class="u-sm u-muted" style="cursor:pointer">' +
                  'Ver os ' + calculo.diasPulados.length + ' dias não contados' +
                '</summary>' +
                '<div class="u-xs u-muted" style="margin-top:var(--space-2);line-height:1.9">';

      calculo.diasPulados.forEach(function (dia) {
        html += '<div><span class="u-mono">' + esc(fmt.data(dia.data)) + '</span> — ' +
                esc(dia.motivo) + '</div>';
      });

      html += '</div></details>';
    }

    return html;
  }

  function render(elemento) {
    container = elemento;
    desenhar();
  }

  function desenhar() {
    var ui = App.components.ui;
    var enums = App.domain.enums;

    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="page-header__title">Simulador de prazo</h1>' +
          '<p class="page-header__subtitle">' +
            'Contagem em dias úteis conforme os arts. 219, 220 e 224 do CPC' +
          '</p>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid--main-aside">' +

        ui.Card({
          titulo: 'Parâmetros',
          conteudo:
            '<form id="form-simulador" class="form-grid">' +
              ui.Field({
                nome: 'tipoPrazoId', rotulo: 'Tipo de prazo', tipo: 'select', largura: 6,
                opcoes: enums.opcoes(enums.TIPOS_PRAZO, 'contestacao')
              }) +
              ui.Field({
                nome: 'dataDisponibilizacao', rotulo: 'Disponibilização no DJe', tipo: 'date',
                largura: 6, valor: App.domain.prazos.hojeISO(),
                dica: 'A publicação ocorre no 1º dia útil seguinte (art. 224 §2º)'
              }) +
              ui.Field({
                nome: 'dias', rotulo: 'Prazo (dias)', tipo: 'number', largura: 4, valor: 15
              }) +
              ui.Field({
                nome: 'tipoContagem', rotulo: 'Contagem', tipo: 'select', largura: 4,
                opcoes: enums.opcoes([
                  { id: 'uteis', label: 'Dias úteis (art. 219)' },
                  { id: 'corridos', label: 'Dias corridos' }
                ], 'uteis')
              }) +
              ui.Field({
                nome: 'diasAntecedencia', rotulo: 'Antecedência interna', tipo: 'number',
                largura: 4, valor: 3, dica: 'Folga de segurança em dias úteis'
              }) +
              ui.Field({
                nome: 'dobro', rotulo: 'Prazo em dobro (art. 229)', tipo: 'checkbox'
              }) +
            '</form>' +
            '<div id="resultado-simulador" style="margin-top:var(--space-4)"></div>'
        }) +

        ui.Card({
          titulo: 'Regras aplicadas',
          conteudo:
            regra('Art. 219', 'Os prazos processuais contam-se apenas em dias úteis.') +
            regra('Art. 224', 'Exclui-se o dia do começo e inclui-se o do vencimento.') +
            regra('Art. 224 §1º', 'Vencendo em dia sem expediente, o prazo prorroga-se para o dia útil seguinte.') +
            regra('Art. 224 §2º', 'A data da publicação é o 1º dia útil seguinte à disponibilização no DJe.') +
            regra('Art. 224 §3º', 'A contagem inicia no 1º dia útil seguinte à publicação.') +
            regra('Art. 220', 'Suspendem-se os prazos entre 20 de dezembro e 20 de janeiro, inclusive.') +
            regra('Art. 229', 'Prazo em dobro para litisconsortes com procuradores distintos.') +
            '<div class="divider"></div>' +
            '<p class="u-xs u-subtle">' +
              'O calendário considera feriados nacionais (inclusive os móveis, ancorados na Páscoa) ' +
              'e feriados forenses como Carnaval, Corpus Christi, Dia do Advogado e Dia da Justiça.' +
            '</p>'
        }) +

      '</div>';

    ligarEventos();
  }

  function regra(artigo, texto) {
    return '<div class="simulador-step">' +
             '<span class="simulador-step__marker" style="width:auto;padding:0 5px;border-radius:var(--radius-sm)">' +
               esc(artigo.replace('Art. ', '')) +
             '</span>' +
             '<div class="u-sm u-muted">' + esc(texto) + '</div>' +
           '</div>';
  }

  function ligarEventos() {
    var form = App.dom.qs('#form-simulador', container);
    var saida = App.dom.qs('#resultado-simulador', container);

    function calcular() {
      var dados = App.dom.formToObject(form);
      var calculo = App.services.prazoService.simular({
        dataDisponibilizacao: dados.dataDisponibilizacao,
        dias: Number(dados.dias),
        tipoContagem: dados.tipoContagem,
        diasAntecedencia: Number(dados.diasAntecedencia),
        dobro: dados.dobro
      });
      saida.innerHTML = renderResultado(calculo);
    }

    form.addEventListener('change', function (evento) {
      if (evento.target.name === 'tipoPrazoId') {
        var tipo = App.domain.enums.achar(App.domain.enums.TIPOS_PRAZO, evento.target.value);
        if (tipo) {
          form.elements.dias.value = tipo.dias;
          form.elements.tipoContagem.value = tipo.contagem;
        }
      }
      calcular();
    });

    form.addEventListener('input', App.dom.debounce(calcular, 180));
    calcular();
  }

  App.pages.SimuladorPage = {
    render: render,
    renderResultado: renderResultado
  };
})(window.App = window.App || {});
